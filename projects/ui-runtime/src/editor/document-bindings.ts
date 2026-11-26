/** SPDX-License-Identifier: Apache-2.0 */
import type { FieldRendererContext } from '../field-types/renderer-context.js';
import type {
    FormDefinition,
    FormFieldChange,
    FormFieldEdit,
    FormFieldContexts,
    ValuePath,
} from '../form/form-definition.js';
import { formPathKey } from '../form/value-path.js';
import type {
    DetailGridChange,
    DetailGridEdit,
    DetailGridColumn,
    FormCollectionContexts,
} from '../grid/grid-definition.js';
import type { DocumentNode, DocumentRow } from '../state/document-state.js';
import { DocumentSession } from '../state/document-session.js';
import {
    validateDocument,
    type ObjectValidationPlan,
    type ValidationPlanNode,
    type DocumentValidationResult,
} from '../validation/validate-document.js';

export interface EditorFeedback {
    readonly source: 'local' | 'deferred' | 'server' | 'definition';
    readonly path: ValuePath;
    readonly message: string;
}
export interface DocumentBindingOptions {
    readonly definition: FormDefinition;
    readonly plan: ObjectValidationPlan;
    readonly fields: Readonly<
        Record<string, Omit<FieldRendererContext, 'value' | 'documentInput' | 'dateConstraints'>>
    >;
    readonly collections: Readonly<
        Record<
            string,
            {
                readonly label: string;
                readonly columns: readonly DetailGridColumn[];
                /** Per-property presentation only; document identity/input remain session-owned. */
                readonly fields?: Readonly<
                    Record<
                        string,
                        Omit<
                            FieldRendererContext,
                            'id' | 'label' | 'value' | 'documentInput' | 'dateConstraints'
                        >
                    >
                >;
            }
        >
    >;
}
export interface DocumentEditorSnapshot {
    readonly contexts: FormFieldContexts;
    readonly collectionContexts: FormCollectionContexts;
    readonly validation: DocumentValidationResult;
    readonly feedback: readonly EditorFeedback[];
}
/** Walk real nodes using keys, accumulating effective inherited edit restrictions. */
function at(root: DocumentNode, path: ValuePath) {
    let node = root,
        readOnly = !!node.readOnly,
        disabled = !!node.disabled;
    for (const segment of path) {
        const next =
            node.kind === 'object' && segment.kind === 'property'
                ? node.properties[segment.name]
                : node.kind === 'collection' && segment.kind === 'row'
                  ? node.rows.find((row) => row.key === segment.key)?.value
                  : undefined;
        if (!next) throw new Error('Unknown document binding path');
        node = next;
        readOnly ||= !!node.readOnly;
        disabled ||= !!node.disabled;
    }
    return { node, readOnly, disabled };
}
const same = (a: ValuePath, b: ValuePath) =>
    (a.length ? formPathKey(a) : '[]') === (b.length ? formPathKey(b) : '[]');
const below = (path: ValuePath, parent: ValuePath) =>
    path.length >= parent.length && same(path.slice(0, parent.length), parent);
/** Derived projection only; session.current is the sole editing tree. Call after transitions. */
export function bindDocumentEditor(
    session: DocumentSession,
    options: DocumentBindingOptions,
): DocumentEditorSnapshot {
    const root = session.state.current;
    const validation = validateDocument({ document: root, plan: options.plan });
    const feedback: readonly EditorFeedback[] = Object.freeze([
        ...validation.issues.map((issue) =>
            Object.freeze({ source: 'local' as const, path: issue.path, message: issue.message }),
        ),
        ...validation.diagnostics.map((issue) =>
            Object.freeze({
                source: 'definition' as const,
                path: issue.path,
                message: issue.message,
            }),
        ),
        ...validation.checks.map((check) =>
            Object.freeze({
                source: 'deferred' as const,
                path: check.path,
                message: 'Authoritative check pending.',
            }),
        ),
        ...(session.save.kind === 'idle' ? (session.save.rejection?.issues ?? []) : []).map(
            (issue) =>
                Object.freeze({
                    source: 'server' as const,
                    path: issue.path,
                    message: issue.message,
                }),
        ),
    ]);
    function field(
        path: ValuePath,
        base: Omit<FieldRendererContext, 'value' | 'documentInput' | 'dateConstraints'>,
    ): FieldRendererContext {
        const result = at(root, path);
        if (result.node.kind !== 'field') throw new Error('Binding requires a document field');
        let plan: ValidationPlanNode | undefined = options.plan;
        for (const segment of path)
            plan =
                plan?.kind === 'object' && segment.kind === 'property'
                    ? plan.properties?.[segment.name]
                    : plan?.kind === 'collection' && segment.kind === 'row'
                      ? plan.row
                      : undefined;
        const definition = plan?.kind === 'field' ? plan.definition : undefined;
        const dateConstraints = definition?.type === 'DATE' ? definition.constraints : undefined;
        const input = result.node.input;
        const messages = feedback.filter((item) => same(item.path, path));
        return Object.freeze({
            ...base,
            value: input.kind === 'raw' ? input.text : input.kind === 'value' ? input.value : '',
            documentInput: input,
            dateConstraints,
            readOnly: !!base.readOnly || result.readOnly,
            disabled: session.locked || !!base.disabled || result.disabled,
            invalid: messages.some((item) => item.source !== 'deferred'),
            feedback: Object.freeze(messages.map((item) => `${item.source}: ${item.message}`)),
        });
    }
    const contexts: Record<string, FieldRendererContext> = {};
    for (const descriptor of options.definition.fields) {
        if (descriptor.excluded) continue;
        const base = options.fields[descriptor.id];
        if (!base) throw new Error('Missing field binding options');
        contexts[descriptor.id] = field(descriptor.path, base);
    }
    const collectionContexts: Record<string, FormCollectionContexts[string]> = {};
    for (const descriptor of options.definition.collections ?? []) {
        if (descriptor.excluded) continue;
        const result = at(root, descriptor.path),
            base = options.collections[descriptor.id];
        if (result.node.kind !== 'collection' || !base)
            throw new Error('Missing collection binding options');
        const node = result.node;
        const messages = feedback.filter(
            (item) => below(item.path, descriptor.path) && item.source !== 'deferred',
        );
        collectionContexts[descriptor.id] = Object.freeze({
            id: descriptor.id,
            path: descriptor.path,
            label: base.label,
            columns: base.columns,
            ordered: node.ordered,
            readOnly: session.locked || result.readOnly,
            disabled: result.disabled,
            allowAdd: node.allowAdd,
            allowRemove: node.allowRemove,
            allowReorder: node.allowReorder,
            ...(messages.length
                ? { message: messages.map((item) => `${item.source}: ${item.message}`).join(' ') }
                : {}),
            rows: Object.freeze(
                node.rows.map((row) => {
                    const path: ValuePath = [...descriptor.path, { kind: 'row', key: row.key }];
                    const cells = base.columns.map(
                        (column) =>
                            [
                                column.field,
                                field([...path, { kind: 'property', name: column.field }], {
                                    ...base.fields?.[column.field],
                                    id: descriptor.id + '-' + row.key + '-' + column.id,
                                    label: column.label,
                                }),
                            ] as const,
                    );
                    const rowMessages = messages.filter((item) => below(item.path, path));
                    return Object.freeze({
                        key: row.key,
                        label: 'Row ' + row.key,
                        values: Object.freeze(
                            Object.fromEntries(
                                cells.map(([name, context]) => [name, context.value]),
                            ),
                        ),
                        contexts: Object.freeze(
                            Object.fromEntries(cells.map(([name, context]) => [name, context])),
                        ),
                        ...(rowMessages.length
                            ? {
                                  message: rowMessages
                                      .map((item) => `${item.source}: ${item.message}`)
                                      .join(' '),
                              }
                            : {}),
                    });
                }),
            ),
        });
    }
    return Object.freeze({
        contexts: Object.freeze(contexts),
        collectionContexts: Object.freeze(collectionContexts),
        validation,
        feedback,
    });
}
/** Call with form-generated intents; scalar legacy values remain scalar slots. */
export function applyDocumentFieldIntent(
    session: DocumentSession,
    intent: FormFieldChange | FormFieldEdit,
): void {
    session.change({
        kind: 'field',
        path: intent.path,
        input: 'input' in intent ? intent.input : { kind: 'value', value: intent.value },
    });
}
/** Add requires an application-prepared row/key; AUR invents no defaults or identity. */
export function applyDocumentCollectionIntent(
    session: DocumentSession,
    intent: DetailGridChange | DetailGridEdit,
    preparedRow?: DocumentRow,
): void {
    if (!('kind' in intent) || intent.kind === 'cell') {
        const expected: ValuePath = [
            ...intent.collectionPath,
            { kind: 'row', key: intent.key },
            { kind: 'property', name: intent.field },
        ];
        if (!same(expected, intent.path)) throw new Error('Inconsistent document cell intent');
        session.change({
            kind: 'field',
            path: expected,
            input: 'input' in intent ? intent.input : { kind: 'value', value: intent.value },
        });
    } else if (intent.kind === 'add-row') {
        if (!preparedRow) throw new Error('Add requires a prepared row');
        session.change({ kind: 'add-row', path: intent.collectionPath, row: preparedRow });
    } else if (intent.kind === 'remove-row')
        session.change({ kind: 'remove-row', path: intent.collectionPath, key: intent.key });
    else
        session.change({
            kind: 'move-row',
            path: intent.collectionPath,
            key: intent.key,
            before: intent.before,
        });
}
