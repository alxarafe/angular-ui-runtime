import type { EditingInput } from '../state/document-state.js';
/** SPDX-License-Identifier: Apache-2.0 */
import type { FieldRendererContext, FieldValue } from '../field-types/renderer-context.js';
import type { FormFieldDefinition, ValuePath } from '../form/form-definition.js';
import { formPathKey } from '../form/value-path.js';
import { validateFormFieldRenderer } from '../form/form-field-renderer.js';

export interface GridColumn {
    readonly id: string;
    readonly label: string;
    /** Immediate property, never a dotted query or array position. */
    readonly field: string;
}
export interface GridRow {
    readonly key: string;
    readonly label: string;
    readonly values: Readonly<Record<string, FieldValue>>;
    /** Application-owned accessible feedback; no validation is performed. */
    readonly message?: string;
}
export interface ListGridContext {
    readonly id: string;
    readonly label: string;
    readonly columns: readonly GridColumn[];
    readonly rows: readonly GridRow[];
    readonly selectable?: boolean;
    readonly emptyLabel?: string;
}
export type DetailGridColumn = GridColumn &
    (
        | {
              readonly kind?: 'artifact';
              readonly artifact: import('../theme/theme-definition.js').FieldArtifact;
              readonly controlId?: never;
          }
        | { readonly kind: 'control'; readonly controlId: string; readonly artifact?: never }
    );
export interface DetailGridRow extends GridRow {
    /** Per-property renderer options. Identity, label and exact value are host-owned. */
    readonly contexts?: Readonly<
        Record<string, Omit<FieldRendererContext, 'id' | 'label' | 'value'>>
    >;
}
export interface DetailGridContext extends Omit<
    ListGridContext,
    'columns' | 'rows' | 'selectable'
> {
    readonly path: ValuePath;
    readonly message?: string;
    readonly columns: readonly DetailGridColumn[];
    readonly rows: readonly DetailGridRow[];
    readonly ordered: boolean;
    readonly readOnly: boolean;
    readonly disabled?: boolean;
    readonly allowAdd: boolean;
    readonly allowRemove: boolean;
    readonly allowReorder: boolean;
}
export interface FormCollection {
    readonly id: string;
    readonly path: ValuePath;
    readonly excluded?: boolean;
}
export type FormCollectionContexts = Readonly<Record<string, DetailGridContext>>;
export type DetailGridChange = {
    readonly collectionId: string;
    readonly collectionPath: ValuePath;
} & (
    | {
          readonly kind: 'cell';
          readonly key: string;
          readonly field: string;
          readonly path: ValuePath;
          readonly value: FieldValue;
      }
    | { readonly kind: 'add-row' }
    | { readonly kind: 'remove-row'; readonly key: string }
    | { readonly kind: 'move-row'; readonly key: string; readonly before: string | null }
);
/** Lossless cell editing is separate from the legacy scalar/structural channel. */
export interface DetailGridEdit {
    readonly collectionId: string;
    readonly collectionPath: ValuePath;
    readonly key: string;
    readonly field: string;
    readonly path: ValuePath;
    readonly input: EditingInput;
}
export interface DetailGridPage extends Omit<DetailGridEdit, 'input'> {
    readonly direction: import('../selector/choice-options.js').ChoicePageDirection;
}
export function gridIdentity(value: unknown): asserts value is string {
    if (typeof value !== 'string' || !value.trim())
        throw new Error('Invalid grid identity or label');
}
export function exactGridValue(value: unknown): asserts value is FieldValue {
    if (value !== null && typeof value !== 'string' && typeof value !== 'boolean')
        throw new Error('Invalid exact grid value');
}
export function snapshotGridPath(path: ValuePath): ValuePath {
    formPathKey(path);
    if (
        path[0]?.kind !== 'property' ||
        path.at(-1)?.kind !== 'property' ||
        path.some((part, index) => part.kind === 'row' && path[index - 1]?.kind !== 'property')
    )
        throw new Error('Invalid collection path');
    for (const segment of path) {
        const keys = Object.keys(segment);
        if (
            keys.length !== 2 ||
            !keys.includes('kind') ||
            !keys.includes(segment.kind === 'property' ? 'name' : 'key')
        )
            throw new Error('Malformed collection path segment');
    }
    return Object.freeze(path.map((part) => Object.freeze({ ...part })));
}
/** Binding admission only; malformed data never becomes a guessed cell target. */
export function validateGrid(context: ListGridContext, detail = false): void {
    gridIdentity(context.id);
    gridIdentity(context.label);
    if (!Array.isArray(context.columns) || !context.columns.length || !Array.isArray(context.rows))
        throw new Error('Invalid grid collections');
    if (context.emptyLabel !== undefined) gridIdentity(context.emptyLabel);
    if (context.selectable !== undefined && typeof context.selectable !== 'boolean')
        throw new Error('Invalid selection flag');
    const ids = new Set<string>(),
        properties = new Set<string>(),
        keys = new Set<string>();
    for (const column of context.columns) {
        gridIdentity(column.id);
        gridIdentity(column.label);
        gridIdentity(column.field);
        if (ids.has(column.id) || properties.has(column.field))
            throw new Error('Duplicate grid column');
        ids.add(column.id);
        properties.add(column.field);
        if (detail)
            validateFormFieldRenderer({
                ...column,
                path: [{ kind: 'property', name: column.field }],
            } as FormFieldDefinition);
    }
    for (const row of context.rows) {
        gridIdentity(row.key);
        gridIdentity(row.label);
        if (keys.has(row.key)) throw new Error('Duplicate grid row key');
        keys.add(row.key);
        if (row.message !== undefined) gridIdentity(row.message);
        if (!row.values || typeof row.values !== 'object' || Array.isArray(row.values))
            throw new Error('Invalid grid row values');
        const contexts = (row as DetailGridRow).contexts;
        if (
            detail &&
            contexts !== undefined &&
            (!contexts || typeof contexts !== 'object' || Array.isArray(contexts))
        )
            throw new Error('Invalid grid cell contexts');
        for (const column of context.columns) {
            if (!row.values || !Object.hasOwn(row.values, column.field))
                throw new Error('Missing grid column value');
            exactGridValue(row.values[column.field]);
            const options = (row as DetailGridRow).contexts?.[column.field];
            if (
                detail &&
                options !== undefined &&
                (!options || typeof options !== 'object' || Array.isArray(options))
            )
                throw new Error('Invalid grid cell options');
            for (const flag of [options?.readOnly, options?.disabled])
                if (flag !== undefined && typeof flag !== 'boolean')
                    throw new Error('Invalid cell capability');
            if (
                detail &&
                options?.describedBy !== undefined &&
                (!Array.isArray(options.describedBy) ||
                    options.describedBy.some(
                        (id) => typeof id !== 'string' || !id || /\s/.test(id),
                    ))
            )
                throw new Error('Invalid feedback reference');
            if (
                detail &&
                options?.choices !== undefined &&
                (!Array.isArray(options.choices) ||
                    options.choices.some((value) => typeof value !== 'string'))
            )
                throw new Error('Invalid cell choices');
        }
        if (
            detail &&
            Object.keys((row as DetailGridRow).contexts ?? {}).some((key) => !properties.has(key))
        )
            throw new Error('Unknown cell context');
    }
    if (detail) {
        const collection = context as DetailGridContext;
        if (collection.message !== undefined) gridIdentity(collection.message);
        snapshotGridPath(collection.path);
        for (const flag of [
            collection.ordered,
            collection.readOnly,
            collection.allowAdd,
            collection.allowRemove,
            collection.allowReorder,
        ])
            if (typeof flag !== 'boolean') throw new Error('Invalid collection capability');
        if (collection.disabled !== undefined && typeof collection.disabled !== 'boolean')
            throw new Error('Invalid collection capability');
    }
}
