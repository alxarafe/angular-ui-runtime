/** SPDX-License-Identifier: Apache-2.0
 * Repository-local save lifecycle probe with a manual synthetic adapter; no I/O.
 */
import { Component, computed, inject, signal } from '@angular/core';
import {
    FormComposition,
    ThemeService,
    DocumentSession,
    type DocumentSubmission,
    type DocumentSaveOutcome,
    createDocumentState,
    validateDocument,
    type DetailGridChange,
    type DetailGridContext,
    type DocumentCollection,
    type DocumentField,
    type DocumentObject,
    type DocumentRow,
    type FieldValue,
    type FormDefinition,
    type FormFieldChange,
    type ObjectValidationPlan,
    type ValidationFieldDefinition,
} from '@alxarafe/ui-runtime';

const property = (name: string) => ({ kind: 'property' as const, name });
const path = (name: string) => [property(name)];
const field = (value: FieldValue, equality: DocumentField['equality'] = { type: 'exact' }) =>
    ({
        kind: 'field',
        equality,
        input: { kind: 'value', value },
    }) satisfies DocumentField;
const object = (properties: DocumentObject['properties']): DocumentObject => ({
    kind: 'object',
    properties,
});
const row = (key: string, value: string): DocumentRow => ({
    key,
    value: object({
        quantity: field(value, { type: 'INTEGER' }),
        persistenceId: field('initial-' + key),
    }),
});
const collection = (rows: readonly DocumentRow[]): DocumentCollection => ({
    kind: 'collection',
    ordered: true,
    allowAdd: true,
    allowRemove: true,
    allowReorder: true,
    rows,
});
const definitions = {
    title: { type: 'STRING', required: true, nullable: false },
    external: {
        type: 'INTEGER',
        required: true,
        nullable: false,
        capacity: { bits: 32, signed: true },
    },
    customerCode: { type: 'STRING', required: true, nullable: false },
    serverCode: {
        type: 'STRING',
        required: true,
        nullable: false,
        constraints: { pattern: { dialect: 'server', source: '^SERVER_[A-Z]+$' } },
    },
    quantity: {
        type: 'INTEGER',
        required: true,
        nullable: false,
        capacity: { bits: 32, signed: true },
    },
} satisfies Record<string, ValidationFieldDefinition>;

const document: DocumentObject = object({
    title: field('Accepted title'),
    external: field('1', { type: 'INTEGER' }),
    serverCode: field('SERVER_ONE'),
    customer: object({ code: field('C-1') }),
    first: collection([row('a', '1'), row('b', '2')]),
    second: collection([row('x', '3')]),
});

const plan: ObjectValidationPlan = {
    kind: 'object',
    properties: {
        title: { kind: 'field', definition: definitions.title },
        external: { kind: 'field', definition: definitions.external },
        serverCode: { kind: 'field', definition: definitions.serverCode },
        customer: {
            kind: 'object',
            properties: { code: { kind: 'field', definition: definitions.customerCode } },
        },
        first: {
            kind: 'collection',
            row: {
                kind: 'object',
                properties: {
                    quantity: { kind: 'field', definition: definitions.quantity },
                    persistenceId: { kind: 'field', definition: definitions.title },
                },
            },
        },
        second: {
            kind: 'collection',
            row: {
                kind: 'object',
                properties: {
                    quantity: { kind: 'field', definition: definitions.quantity },
                    persistenceId: { kind: 'field', definition: definitions.title },
                },
            },
        },
    },
};

@Component({
    selector: 'qa-testbed',
    imports: [FormComposition],
    template: `<main>
        <h1>Document save lifecycle QA</h1>
        <div class="controls">
            @for (id of themes; track id) {
                <button
                    (click)="theme.activate(id)"
                    [attr.aria-pressed]="theme.current().id === id"
                >
                    {{ id }}
                </button>
            }
        </div>
        <section aria-label="Synthetic save adapter">
            <p>
                Save status: <output data-testid="save-status">{{ save().kind }}</output>
            </p>
            <p role="status" data-testid="save-message">{{ message() }}</p>
            <output data-testid="save-feedback">{{ encode(save()) }}</output>
            <output data-testid="submission">{{ encode(submission()) }}</output>
            <button (click)="submit()" [disabled]="locked()">Save document</button>
            <button (click)="submit()">Probe duplicate submission</button>
            <button (click)="forcedEdit()">Probe locked edit</button>
            <button (click)="respond('accepted')">Adapter accepts</button>
            <button (click)="respond('validation')">Adapter validation rejection</button>
            <button (click)="respond('transport')">Adapter transport failure</button>
            <button (click)="respond('conflict')">Adapter conflict</button>
            <button (click)="respond('committed')">Adapter committed</button>
            <button (click)="respond('uncertain')">Adapter uncertain</button>
            <button (click)="partial()">Adapter incomplete acceptance</button>
            <button (click)="recover()">Authoritative recovery</button>
            <button (click)="stale()">Replay stale acceptance</button>
        </section>
        <section aria-labelledby="document-validation-heading">
            <h2 id="document-validation-heading">Application-owned document summary</h2>
            <p>
                Document status:
                <output data-testid="document-state">{{ result().state }}</output>
                · Editing:
                <output data-testid="document-dirty">{{
                    state().dirty ? 'dirty' : 'clean'
                }}</output>
                · Revision:
                <output data-testid="document-revision">{{ state().revision }}</output>
            </p>
            <p>Local issues</p>
            <ul data-testid="document-issues">
                @for (issue of result().issues; track $index) {
                    <li data-testid="document-issue">
                        {{ issue.code }}: {{ issue.message }}
                        <code data-testid="document-issue-path">{{ formatPath(issue.path) }}</code>
                    </li>
                }
            </ul>
            <p>Deferred server checks</p>
            <ul data-testid="document-checks">
                @for (check of result().checks; track $index) {
                    <li data-testid="document-check">
                        {{ check.reason }}
                        <code data-testid="document-check-path">{{ formatPath(check.path) }}</code>
                    </li>
                }
            </ul>
            <output data-testid="document-diagnostics"
                >{{ result().diagnostics.length }} definition diagnostics</output
            >
            <output data-testid="document-snapshot">{{ encode(state().current) }}</output>
            <output data-testid="document-paths">{{ encode(fieldPaths()) }}</output>
        </section>
        <aur-form
            [definition]="definition"
            [contexts]="contexts()"
            [collectionContexts]="collections()"
            (fieldChange)="edit($event)"
            (collectionChange)="apply($event)"
        />
    </main>`,
    styles: [
        ':host{display:block;padding:1rem;min-width:0;}main{max-width:1000px;margin:auto;min-width:0}.controls{display:flex;flex-wrap:wrap;gap:.5rem}button{font:inherit;padding:.5rem}output{display:inline;overflow-wrap:anywhere}ul{min-height:1.5rem}code{overflow-wrap:anywhere}',
    ],
})
export class DocumentSaveTestbed {
    readonly theme = inject(ThemeService);
    readonly themes = [
        'default',
        'alternative',
        'cyberpunk',
        'vintage',
        'high-contrast',
        'grid-frame',
    ];
    readonly session = new DocumentSession(createDocumentState(document));
    readonly state = signal(this.session.state);
    readonly save = signal(this.session.save);
    readonly message = signal('');
    readonly submission = signal<DocumentSubmission | undefined>(undefined);
    private previous: DocumentSubmission | undefined;
    readonly locked = computed(() => this.save().kind !== 'idle');
    private sync(): void {
        this.state.set(this.session.state);
        this.save.set(this.session.save);
    }
    submit(): void {
        try {
            const result = this.session.submit(plan);
            this.message.set(result.kind);
            if (result.kind === 'ready') {
                this.previous = this.submission();
                this.submission.set(result.submission);
            }
        } catch {
            this.message.set('submission locked');
        }
        this.sync();
    }
    respond(
        kind: 'accepted' | 'validation' | 'transport' | 'conflict' | 'committed' | 'uncertain',
    ): void {
        const attempt = this.submission();
        if (!attempt) return;
        const outcome: DocumentSaveOutcome =
            kind === 'accepted'
                ? { kind, document: this.authoritative(attempt), checksConfirmed: true }
                : kind === 'committed' || kind === 'uncertain'
                  ? { kind }
                  : {
                        kind: 'rejected',
                        reason: kind,
                        issues: [
                            {
                                path: path('title'),
                                code: kind,
                                message: 'Synthetic adapter rejection',
                            },
                        ],
                    };
        this.session.resolve(attempt, outcome);
        this.sync();
    }
    private authoritative(attempt: DocumentSubmission): DocumentObject {
        // This synthetic adapter maps regenerated persistence IDs to the submitted
        // UI keys before supplying readback. No position-based mapping occurs in AUR.
        const accepted = structuredClone(attempt.document);
        const properties: Record<string, DocumentObject['properties'][string]> = {
            ...accepted.properties,
            title: field('Authoritative title'),
        };
        for (const id of ['first', 'second']) {
            const collection = accepted.properties[id] as DocumentCollection;
            // Adapter correlation survives a response order different from UI order.
            const response = [...collection.rows].reverse().map((row) => ({
                uiKey: row.key,
                persistenceId: 'regenerated-' + row.key,
            }));
            const mapped = new Map(response.map((row) => [row.uiKey, row.persistenceId]));
            properties[id] = {
                ...collection,
                rows: collection.rows.map((row) => ({
                    key: row.key,
                    value: {
                        ...row.value,
                        properties: {
                            ...row.value.properties,
                            persistenceId: field(mapped.get(row.key)!),
                        },
                    },
                })),
            };
        }
        return { ...accepted, properties };
    }
    recover(): void {
        const attempt = this.submission();
        if (attempt) this.session.recover(attempt, this.authoritative(attempt), true);
        this.sync();
    }
    partial(): void {
        const attempt = this.submission();
        if (attempt) {
            // Simulate an id/version-only response incorrectly passed as a document.
            this.session.resolve(attempt, {
                kind: 'accepted',
                document: { kind: 'object', properties: {} },
                checksConfirmed: true,
            });
        }
        this.sync();
    }
    stale(): void {
        if (this.previous)
            this.session.resolve(this.previous, {
                kind: 'accepted',
                document: this.previous.document,
                checksConfirmed: true,
            });
        this.sync();
    }
    forcedEdit(): void {
        try {
            this.session.change({
                kind: 'field',
                path: path('title'),
                input: { kind: 'value', value: 'Forbidden edit' },
            });
        } catch {
            this.message.set('editing locked');
        }
        this.sync();
    }
    readonly encode = JSON.stringify;
    private counter = 0;
    readonly definition: FormDefinition = {
        id: 'document-save-parent',
        label: 'Document save parent',
        fields: [
            { id: 'title', path: path('title'), artifact: 'field.STRING' },
            { id: 'external', path: path('external'), artifact: 'field.INTEGER' },
            { id: 'serverCode', path: path('serverCode'), artifact: 'field.STRING' },
            {
                id: 'customerCode',
                path: [property('customer'), property('code')],
                artifact: 'field.STRING',
            },
        ],
        collections: [
            { id: 'first', path: path('first') },
            { id: 'second', path: path('second') },
        ],
    };
    readonly result = computed(() => validateDocument({ document: this.state().current, plan }));
    readonly fieldPaths = computed(() => this.result().fields.map((entry) => entry.path));
    formatPath(value: readonly { kind: string; name?: string; key?: string }[]): string {
        return value
            .map((segment) => (segment.kind === 'row' ? `row:${segment.key}` : segment.name))
            .join(' / ');
    }
    private value(field: DocumentField): FieldValue {
        if (field.input.kind !== 'value') throw new Error('QA projection requires a value slot');
        return field.input.value;
    }
    readonly contexts = computed(() => {
        const current = this.state().current;
        return {
            title: {
                id: 'document-title',
                disabled: this.locked(),
                label: 'Document title',
                value: this.value(current.properties['title'] as DocumentField),
            },
            external: {
                id: 'document-external',
                disabled: this.locked(),
                label: 'External quantity',
                value: this.value(current.properties['external'] as DocumentField),
            },
            serverCode: {
                id: 'document-server-code',
                disabled: this.locked(),
                label: 'Server pattern code',
                value: this.value(current.properties['serverCode'] as DocumentField),
            },
            customerCode: {
                id: 'document-customer-code',
                disabled: this.locked(),
                label: 'Customer code',
                value: this.value(
                    (current.properties['customer'] as DocumentObject).properties[
                        'code'
                    ] as DocumentField,
                ),
            },
        };
    });
    readonly collections = computed(() =>
        Object.fromEntries(
            ['first', 'second'].map((id) => {
                const node = this.state().current.properties[id] as DocumentCollection;
                return [
                    id,
                    {
                        id,
                        path: path(id),
                        label: id === 'first' ? 'First detail rows' : 'Second detail rows',
                        ordered: node.ordered,
                        readOnly: this.locked(),
                        allowAdd: node.allowAdd,
                        allowRemove: node.allowRemove,
                        allowReorder: node.allowReorder,
                        columns: [
                            {
                                id: 'quantity',
                                label: 'Quantity',
                                field: 'quantity',
                                artifact: 'field.INTEGER',
                            },
                        ],
                        rows: node.rows.map((row) => ({
                            key: row.key,
                            label: 'Row ' + row.key,
                            values: {
                                quantity: this.value(
                                    row.value.properties['quantity'] as DocumentField,
                                ),
                            },
                        })),
                    } satisfies DetailGridContext,
                ];
            }),
        ),
    );
    edit(intent: FormFieldChange): void {
        this.session.change({
            kind: 'field',
            path: intent.path,
            input: { kind: 'value', value: intent.value },
        });
        this.sync();
    }
    apply(intent: DetailGridChange): void {
        if (intent.kind === 'cell')
            this.session.change({
                kind: 'field',
                path: intent.path,
                input: { kind: 'value', value: intent.value },
            });
        else if (intent.kind === 'add-row')
            this.session.change({
                kind: 'add-row',
                path: intent.collectionPath,
                row: row('new-' + ++this.counter, '0'),
            });
        else if (intent.kind === 'remove-row')
            this.session.change({
                kind: 'remove-row',
                path: intent.collectionPath,
                key: intent.key,
            });
        else
            this.session.change({
                kind: 'move-row',
                path: intent.collectionPath,
                key: intent.key,
                before: intent.before,
            });
        this.sync();
    }
}
