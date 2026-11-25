/** SPDX-License-Identifier: Apache-2.0 */
import type { ValuePath } from '../form/form-definition.js';
import {
    validateDocument,
    type DocumentValidationResult,
    type ObjectValidationPlan,
} from '../validation/validate-document.js';
import {
    applyDocumentChange,
    assertDocumentState,
    createDocumentState,
    resetDocumentState,
    type DocumentChange,
    type DocumentNode,
    type DocumentObject,
    type DocumentState,
} from './document-state.js';

/** Adapter-owned feedback; codes and messages carry no transport contract. */
export interface DocumentSaveIssue {
    readonly path: ValuePath;
    readonly code: string;
    readonly message: string;
}
/** The object itself is the attempt token. Never reconstruct it from its display ID. */
export interface DocumentSubmission {
    readonly id: string;
    readonly revision: number;
    readonly document: DocumentObject;
    readonly validation: DocumentValidationResult;
}
export type DocumentSaveOutcome =
    | {
          readonly kind: 'accepted';
          readonly document: DocumentObject;
          readonly checksConfirmed?: boolean;
      }
    | {
          readonly kind: 'rejected';
          readonly reason: 'validation' | 'transport' | 'conflict';
          readonly issues?: readonly DocumentSaveIssue[];
      }
    | { readonly kind: 'committed' }
    | { readonly kind: 'uncertain' };
export type DocumentSaveState =
    | {
          readonly kind: 'idle';
          readonly rejection?: {
              readonly reason: 'validation' | 'transport' | 'conflict';
              readonly issues: readonly DocumentSaveIssue[];
          };
      }
    | { readonly kind: 'saving' | 'reconciling'; readonly submission: DocumentSubmission }
    | {
          readonly kind: 'recovery';
          readonly submission: DocumentSubmission;
          readonly reason:
              'uncertain' | 'invalid-acceptance' | 'unconfirmed-checks' | 'reconciliation-failed';
      };
export type DocumentSubmitResult =
    | { readonly kind: 'blocked'; readonly validation: DocumentValidationResult }
    | { readonly kind: 'ready'; readonly submission: DocumentSubmission };

/** The application owns the dialog and its accessible focus restoration. */
export interface DiscardRequest {
    readonly revision: number;
    readonly reason: string;
}
export type ConfirmDiscard = (request: DiscardRequest) => Promise<boolean>;
export type DiscardResult = 'allowed' | 'cancelled' | 'blocked' | 'stale';

let nextSession = 0n;
const pathKey = (path: ValuePath): string => JSON.stringify(path);

function parsedDocument(
    document: DocumentObject,
    validation: DocumentValidationResult,
): DocumentObject {
    const fields = new Map(validation.fields.map((field) => [pathKey(field.path), field.result]));
    function visit(node: DocumentNode, path: ValuePath): DocumentNode {
        if (node.kind === 'field') {
            const result = fields.get(pathKey(path));
            if (!result || (result.state !== 'valid' && result.state !== 'pending'))
                throw new Error('Submission requires complete successful field validation');
            return { ...node, input: result.parsed };
        }
        if (node.kind === 'object')
            return {
                ...node,
                properties: Object.fromEntries(
                    Object.entries(node.properties).map(([name, child]) => [
                        name,
                        visit(child, [...path, { kind: 'property', name }]),
                    ]),
                ),
            };
        return {
            ...node,
            rows: node.rows.map((row) => ({
                key: row.key,
                value: visit(row.value, [...path, { kind: 'row', key: row.key }]) as DocumentObject,
            })),
        };
    }
    return createDocumentState(visit(document, []) as DocumentObject).current;
}
/** No positional/server-ID guesses: the adapter supplies the submitted UI keys. */
function compatible(submitted: DocumentNode, accepted: DocumentNode): boolean {
    if (submitted.kind === 'field' && accepted.kind === 'field')
        return (
            submitted.equality.type === accepted.equality.type &&
            (submitted.equality.type !== 'DECIMAL' ||
                (accepted.equality.type === 'DECIMAL' &&
                    submitted.equality.allowExponent === accepted.equality.allowExponent))
        );
    if (submitted.kind === 'object' && accepted.kind === 'object') {
        const names = Object.keys(submitted.properties);
        return (
            names.length === Object.keys(accepted.properties).length &&
            names.every(
                (name) =>
                    Object.hasOwn(accepted.properties, name) &&
                    compatible(submitted.properties[name]!, accepted.properties[name]!),
            )
        );
    }
    if (
        submitted.kind !== 'collection' ||
        accepted.kind !== 'collection' ||
        submitted.ordered !== accepted.ordered ||
        submitted.rows.length !== accepted.rows.length
    )
        return false;
    const rows = new Map(accepted.rows.map((row) => [row.key, row.value]));
    return submitted.rows.every(
        (row) => rows.has(row.key) && compatible(row.value, rows.get(row.key)!),
    );
}
function snapshotIssues(issues: readonly DocumentSaveIssue[]): readonly DocumentSaveIssue[] {
    if (!Array.isArray(issues) || Object.keys(issues).length !== issues.length)
        throw new Error('Invalid save feedback');
    return Object.freeze(
        issues.map((issue) => {
            if (
                !issue ||
                typeof issue.code !== 'string' ||
                typeof issue.message !== 'string' ||
                !Array.isArray(issue.path) ||
                issue.path.length > 128 ||
                Object.keys(issue.path).length !== issue.path.length
            )
                throw new Error('Invalid save feedback');
            const path = Object.freeze(
                issue.path.map((segment: ValuePath[number]) => {
                    if (
                        segment?.kind === 'property' &&
                        typeof segment.name === 'string' &&
                        segment.name.trim()
                    )
                        return Object.freeze({ kind: 'property' as const, name: segment.name });
                    if (
                        segment?.kind === 'row' &&
                        typeof segment.key === 'string' &&
                        segment.key.trim()
                    )
                        return Object.freeze({ kind: 'row' as const, key: segment.key });
                    throw new Error('Invalid save feedback path');
                }),
            );
            return Object.freeze({ path, code: issue.code, message: issue.message });
        }),
    );
}

/**
 * One editing lifetime, wrapping the existing immutable STATE core. No I/O occurs.
 * Keep this owner outside replaceable views. All edits in this lifetime use change().
 */
export class DocumentSession {
    readonly #id = `document-${++nextSession}`;
    #attempt = 0n;
    #state: DocumentState;
    #saveValue: DocumentSaveState = Object.freeze({ kind: 'idle' });
    #generation = 0;
    #confirming = false;
    readonly #listeners = new Set<() => void>();
    get #save(): DocumentSaveState {
        return this.#saveValue;
    }
    set #save(value: DocumentSaveState) {
        this.#saveValue = value;
        this.#generation++;
        // Observers cannot interrupt a completed state transition.
        for (const listener of [...this.#listeners]) {
            try {
                listener();
            } catch {
                /* Observers own their errors. */
            }
        }
    }
    /** Observe completed transitions; returns an idempotent unsubscribe function. */
    subscribe(listener: () => void): () => void {
        this.#listeners.add(listener);
        return () => {
            this.#listeners.delete(listener);
        };
    }
    get requiresProtection(): boolean {
        return this.#state.dirty || this.locked;
    }
    /** Only the captured idle editing lifetime may be reset after confirmation. */
    async requestDiscard(reason: string, confirm: ConfirmDiscard): Promise<DiscardResult> {
        if (this.locked || this.#confirming) return 'blocked';
        if (!this.#state.dirty) return 'allowed';
        const captured = this.#state;
        const generation = this.#generation;
        this.#confirming = true;
        try {
            const confirmed = await confirm(Object.freeze({ revision: captured.revision, reason }));
            if (this.locked) return 'blocked';
            if (this.#state !== captured || this.#generation !== generation) return 'stale';
            if (confirmed !== true) return 'cancelled';
            this.#state = resetDocumentState(captured);
            this.#save = Object.freeze({ kind: 'idle' });
            return 'allowed';
        } finally {
            this.#confirming = false;
        }
    }
    constructor(state: DocumentState) {
        assertDocumentState(state);
        this.#state = state;
    }
    get state(): DocumentState {
        return this.#state;
    }
    get save(): DocumentSaveState {
        return this.#save;
    }
    get locked(): boolean {
        return this.#save.kind !== 'idle';
    }
    change(change: DocumentChange): DocumentState {
        if (this.#save.kind !== 'idle') throw new Error('Document session is locked');
        const next = applyDocumentChange(this.#state, change);
        this.#state = next;
        // Feedback is stale after an explicit edit; revalidation is application-owned.
        this.#save = Object.freeze({ kind: 'idle' });
        return next;
    }
    submit(plan: ObjectValidationPlan): DocumentSubmitResult {
        if (this.#save.kind !== 'idle') throw new Error('Document submission already active');
        if (this.#state.revision === Number.MAX_SAFE_INTEGER)
            throw new Error('Document revision exhausted');
        const validation = validateDocument({ document: this.#state.current, plan });
        if (validation.state === 'invalid' || validation.state === 'definition-error')
            return Object.freeze({ kind: 'blocked', validation });
        const submission: DocumentSubmission = Object.freeze({
            id: `${this.#id}/attempt-${++this.#attempt}`,
            revision: this.#state.revision,
            document: parsedDocument(this.#state.current, validation),
            validation,
        });
        this.#save = Object.freeze({ kind: 'saving', submission });
        return Object.freeze({ kind: 'ready', submission });
    }
    /** False means stale/foreign response; no supplied payload is inspected in that case. */
    resolve(submission: DocumentSubmission, outcome: DocumentSaveOutcome): boolean {
        if (this.#save.kind === 'idle' || this.#save.submission !== submission) return false;
        if (outcome.kind === 'accepted')
            return this.#accept(submission, outcome.document, outcome.checksConfirmed === true);
        if (outcome.kind === 'uncertain') {
            this.#save = Object.freeze({ kind: 'recovery', submission, reason: 'uncertain' });
        } else if (outcome.kind === 'committed') {
            // A committed write needs authoritative readback, not another submission.
            this.#save = Object.freeze({ kind: 'reconciling', submission });
        } else if (
            outcome.kind === 'rejected' &&
            ['validation', 'transport', 'conflict'].includes(outcome.reason)
        ) {
            if (this.#save.kind !== 'saving') {
                this.#save = Object.freeze({
                    kind: 'recovery',
                    submission,
                    reason: 'reconciliation-failed',
                });
            } else {
                const rejection = Object.freeze({
                    reason: outcome.reason,
                    issues: snapshotIssues(outcome.issues ?? []),
                });
                this.#save = Object.freeze({ kind: 'idle', rejection });
            }
        } else throw new Error('Invalid save outcome');
        return true;
    }
    /** Recovery/readback uses the original attempt token and a complete mapped tree. */
    recover(
        submission: DocumentSubmission,
        document: DocumentObject,
        checksConfirmed = false,
    ): boolean {
        if (this.#save.kind === 'idle' || this.#save.submission !== submission) return false;
        if (this.#save.kind === 'saving')
            throw new Error('Recovery requires reconciliation or recovery state');
        return this.#accept(submission, document, checksConfirmed);
    }
    #accept(
        submission: DocumentSubmission,
        document: DocumentObject,
        checksConfirmed: boolean,
    ): boolean {
        if (submission.validation.checks.length && !checksConfirmed) {
            this.#save = Object.freeze({
                kind: 'recovery',
                submission,
                reason: 'unconfirmed-checks',
            });
            return true;
        }
        try {
            const accepted = createDocumentState(document, this.#state.revision + 1);
            if (!compatible(submission.document, accepted.current))
                throw new Error('Incomplete or unmapped accepted document');
            this.#state = accepted;
            this.#save = Object.freeze({ kind: 'idle' });
        } catch {
            this.#save = Object.freeze({
                kind: 'recovery',
                submission,
                reason: 'invalid-acceptance',
            });
        }
        return true;
    }
}
