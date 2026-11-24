/** SPDX-License-Identifier: Apache-2.0 */
import type { FieldValue } from '../field-types/renderer-context.js';
import type { ValuePath } from '../form/form-definition.js';
import { exactNumericEqual, type NumericSemantics } from './exact-numeric.js';

export type ValueSlot =
    { readonly kind: 'absent' } | { readonly kind: 'value'; readonly value: FieldValue };
export type EditingInput = ValueSlot | { readonly kind: 'raw'; readonly text: string };
export type FieldEquality = { readonly type: 'exact' } | NumericSemantics;
interface EditCapabilities {
    readonly readOnly?: boolean;
    readonly disabled?: boolean;
}
export interface DocumentField extends EditCapabilities {
    readonly kind: 'field';
    readonly equality: FieldEquality;
    readonly input: EditingInput;
}
export interface DocumentObject extends EditCapabilities {
    readonly kind: 'object';
    readonly properties: Readonly<Record<string, DocumentNode>>;
}
export interface DocumentRow {
    readonly key: string;
    readonly value: DocumentObject;
}
export interface DocumentCollection extends EditCapabilities {
    readonly kind: 'collection';
    readonly ordered: boolean;
    readonly allowAdd: boolean;
    readonly allowRemove: boolean;
    readonly allowReorder: boolean;
    readonly rows: readonly DocumentRow[];
}
export type DocumentNode = DocumentField | DocumentObject | DocumentCollection;
export interface DocumentState {
    readonly original: DocumentObject;
    readonly current: DocumentObject;
    readonly revision: number;
    readonly dirty: boolean;
}
export type DocumentChange =
    | { readonly kind: 'field'; readonly path: ValuePath; readonly input: EditingInput }
    | { readonly kind: 'add-row'; readonly path: ValuePath; readonly row: DocumentRow }
    | { readonly kind: 'remove-row'; readonly path: ValuePath; readonly key: string }
    | {
          readonly kind: 'move-row';
          readonly path: ValuePath;
          readonly key: string;
          readonly before: string | null;
      };

const states = new WeakSet<DocumentState>();

function fail(): never {
    throw new Error('Invalid document state or operation');
}
function plainRecord(value: unknown): value is Record<string, unknown> {
    return (
        !!value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        [Object.prototype, null].includes(Object.getPrototypeOf(value))
    );
}
function record(value: unknown): asserts value is Record<string, unknown> {
    if (!plainRecord(value)) fail();
}
function identity(value: unknown): asserts value is string {
    if (typeof value !== 'string' || !value.trim()) fail();
}
function onlyKeys(value: object, required: string[], optional: string[] = []): boolean {
    return (
        required.every((key) => Object.hasOwn(value, key)) &&
        Reflect.ownKeys(value).every(
            (key) => typeof key === 'string' && [...required, ...optional].includes(key),
        )
    );
}
function keys(value: object, required: string[], optional: string[] = []): void {
    if (!onlyKeys(value, required, optional)) fail();
}
function validInput(value: unknown, accepted: boolean): boolean {
    if (!plainRecord(value)) return false;
    if (value['kind'] === 'absent') return onlyKeys(value, ['kind']);
    if (value['kind'] === 'raw' && !accepted)
        return onlyKeys(value, ['kind', 'text']) && typeof value['text'] === 'string';
    if (value['kind'] !== 'value' || !onlyKeys(value, ['kind', 'value'])) return false;
    const input = value['value'];
    return input === null || typeof input === 'string' || typeof input === 'boolean';
}
/** Structural STATE admission problem for a single node, without child traversal. */
export type DocumentNodeProblem =
    | 'not-record'
    | 'unsupported-kind'
    | 'members'
    | 'flags'
    | 'equality'
    | 'input'
    | 'properties'
    | 'collection'
    | 'row';
/**
 * Describes the first local STATE-contract violation in a document node.
 * Raw edits remain admissible; semantic validity is not evaluated here.
 */
export function documentNodeProblem(
    value: unknown,
    accepted = false,
): DocumentNodeProblem | undefined {
    if (!plainRecord(value)) return 'not-record';
    for (const flag of ['readOnly', 'disabled']) {
        if (value[flag] !== undefined && typeof value[flag] !== 'boolean') return 'flags';
    }
    const kind = value['kind'];
    if (kind === 'field') {
        if (!onlyKeys(value, ['kind', 'equality', 'input'], ['readOnly', 'disabled']))
            return 'members';
        const equality = value['equality'];
        if (!plainRecord(equality)) return 'equality';
        if (equality['type'] === 'DECIMAL') {
            if (
                !onlyKeys(equality, ['type', 'allowExponent']) ||
                typeof equality['allowExponent'] !== 'boolean'
            )
                return 'equality';
        } else if (
            !onlyKeys(equality, ['type']) ||
            (equality['type'] !== 'exact' && equality['type'] !== 'INTEGER')
        ) {
            return 'equality';
        }
        return validInput(value['input'], accepted) ? undefined : 'input';
    }
    if (kind === 'object') {
        if (!onlyKeys(value, ['kind', 'properties'], ['readOnly', 'disabled'])) return 'members';
        const properties = value['properties'];
        if (!plainRecord(properties)) return 'properties';
        if (Reflect.ownKeys(properties).length !== Object.keys(properties).length)
            return 'properties';
        if (Object.keys(properties).some((name) => !name.trim())) return 'properties';
        return undefined;
    }
    if (kind === 'collection') {
        if (
            !onlyKeys(
                value,
                ['kind', 'ordered', 'allowAdd', 'allowRemove', 'allowReorder', 'rows'],
                ['readOnly', 'disabled'],
            )
        )
            return 'members';
        for (const flag of ['ordered', 'allowAdd', 'allowRemove', 'allowReorder']) {
            if (typeof value[flag] !== 'boolean') return 'collection';
        }
        const rows = value['rows'];
        if (!Array.isArray(rows) || Object.keys(rows).length !== rows.length) return 'collection';
        const seen = new Set<string>();
        for (const row of rows) {
            if (!plainRecord(row) || !onlyKeys(row, ['key', 'value'])) return 'row';
            const key = row['key'];
            if (typeof key !== 'string' || !key.trim() || seen.has(key)) return 'row';
            seen.add(key);
            const rowValue = row['value'];
            if (!plainRecord(rowValue) || rowValue['kind'] !== 'object') return 'row';
        }
        return undefined;
    }
    return 'unsupported-kind';
}
function inputSnapshot(input: EditingInput, accepted = false): EditingInput {
    record(input);
    if (input.kind === 'absent') {
        keys(input, ['kind']);
        return Object.freeze({ kind: 'absent' });
    }
    if (input.kind === 'raw' && !accepted) {
        keys(input, ['kind', 'text']);
        if (typeof input.text !== 'string') fail();
        return Object.freeze({ kind: 'raw', text: input.text });
    }
    if (input.kind !== 'value') fail();
    keys(input, ['kind', 'value']);
    if (input.value !== null && typeof input.value !== 'string' && typeof input.value !== 'boolean')
        fail();
    return Object.freeze({ kind: 'value', value: input.value });
}
function snapshot(
    node: DocumentNode,
    accepted = false,
    ancestors = new Set<object>(),
    depth = 0,
): DocumentNode {
    record(node);
    if (depth > 128 || ancestors.has(node)) fail();
    if (documentNodeProblem(node, accepted)) fail();
    ancestors.add(node);
    const flags: EditCapabilities = {};
    for (const flag of ['readOnly', 'disabled'] as const) {
        if (node[flag] !== undefined) Object.assign(flags, { [flag]: node[flag] });
    }
    let result: DocumentNode;
    if (node.kind === 'field') {
        result = {
            kind: 'field',
            ...flags,
            equality: Object.freeze({ ...node.equality }),
            input: inputSnapshot(node.input, accepted),
        };
    } else if (node.kind === 'object') {
        const properties = Object.fromEntries(
            Object.entries(node.properties).map(([name, child]) => [
                name,
                snapshot(child, accepted, ancestors, depth + 1),
            ]),
        );
        result = { kind: 'object', ...flags, properties: Object.freeze(properties) };
    } else {
        const rows = node.rows.map((row: DocumentRow) =>
            Object.freeze({
                key: row.key,
                value: snapshot(row.value, accepted, ancestors, depth + 1) as DocumentObject,
            }),
        );
        result = {
            kind: 'collection',
            ...flags,
            ordered: node.ordered,
            allowAdd: node.allowAdd,
            allowRemove: node.allowRemove,
            allowReorder: node.allowReorder,
            rows: Object.freeze(rows),
        };
    }
    ancestors.delete(node);
    return Object.freeze(result);
}
function equal(a: DocumentNode, b: DocumentNode): boolean {
    if (a.kind === 'field' && b.kind === 'field') {
        if (
            a.equality.type !== b.equality.type ||
            (a.equality.type === 'DECIMAL' &&
                b.equality.type === 'DECIMAL' &&
                a.equality.allowExponent !== b.equality.allowExponent)
        )
            return false;
        const x = a.input,
            y = b.input;
        if (x.kind !== y.kind) return false;
        if (x.kind === 'absent') return true;
        if (x.kind === 'raw' && y.kind === 'raw') return x.text === y.text;
        if (x.kind !== 'value' || y.kind !== 'value') return false;
        if (
            typeof x.value === 'string' &&
            typeof y.value === 'string' &&
            a.equality.type !== 'exact'
        ) {
            const numeric = exactNumericEqual(x.value, y.value, a.equality);
            // Identical uninterpretable lexical values are unchanged, never "valid".
            return numeric ?? x.value === y.value;
        }
        return x.value === y.value;
    }
    if (a.kind === 'object' && b.kind === 'object') {
        const names = Object.keys(a.properties);
        return (
            names.length === Object.keys(b.properties).length &&
            names.every(
                (name) =>
                    Object.hasOwn(b.properties, name) &&
                    equal(a.properties[name]!, b.properties[name]!),
            )
        );
    }
    if (
        a.kind !== 'collection' ||
        b.kind !== 'collection' ||
        a.ordered !== b.ordered ||
        a.rows.length !== b.rows.length
    )
        return false;
    if (a.ordered) return a.rows.every((row, index) => equal(row.value, b.rows[index]!.value));
    const remaining = [...b.rows];
    return a.rows.every((row) => {
        const index = remaining.findIndex((other) => equal(row.value, other.value));
        if (index < 0) return false;
        remaining.splice(index, 1);
        return true;
    });
}
function revision(value: number): number {
    if (!Number.isSafeInteger(value) || value < 0) fail();
    return value;
}
function state(original: DocumentObject, current: DocumentObject, counter: number): DocumentState {
    const result = Object.freeze({
        original,
        current,
        revision: revision(counter),
        dirty: !equal(original, current),
    });
    states.add(result);
    return result;
}
/** Accepts a structurally admitted tree, not a semantically validated document. */
export function createDocumentState(document: DocumentObject, initialRevision = 0): DocumentState {
    if (document?.kind !== 'object') fail();
    return state(
        snapshot(document, true) as DocumentObject,
        snapshot(document, true) as DocumentObject,
        initialRevision,
    );
}
function update(
    node: DocumentNode,
    path: ValuePath,
    index: number,
    change: DocumentChange,
): DocumentNode {
    if (node.readOnly || node.disabled) throw new Error('Document edit prohibited');
    if (index === path.length) {
        if (change.kind === 'field') {
            if (node.kind !== 'field') fail();
            return Object.freeze({ ...node, input: inputSnapshot(change.input) });
        }
        if (node.kind !== 'collection') fail();
        let rows = [...node.rows];
        if (change.kind === 'add-row') {
            if (!node.allowAdd) fail();
            // Reuse complete structural admission for application-prepared rows.
            return snapshot({ ...node, rows: [...rows, change.row] }, false, new Set(), index);
        }
        identity(change.key);
        const at = rows.findIndex((row) => row.key === change.key);
        if (at < 0) fail();
        if (change.kind === 'remove-row') {
            if (!node.allowRemove) fail();
            rows.splice(at, 1);
        } else {
            if (!node.ordered || !node.allowReorder) fail();
            if (change.before !== null) identity(change.before);
            if (change.before !== null && !rows.some((row) => row.key === change.before)) fail();
            if (change.before !== change.key) {
                const moving = rows.splice(at, 1)[0]!;
                const target =
                    change.before === null
                        ? rows.length
                        : rows.findIndex((row) => row.key === change.before);
                rows.splice(target, 0, moving);
            }
        }
        return Object.freeze({ ...node, rows: Object.freeze(rows) });
    }
    const segment = path[index]!;
    if (
        node.kind === 'object' &&
        segment.kind === 'property' &&
        Object.hasOwn(node.properties, segment.name)
    ) {
        return Object.freeze({
            ...node,
            properties: Object.freeze({
                ...node.properties,
                [segment.name]: update(node.properties[segment.name]!, path, index + 1, change),
            }),
        });
    }
    if (node.kind === 'collection' && segment.kind === 'row') {
        const at = node.rows.findIndex((row) => row.key === segment.key);
        if (at < 0) fail();
        return Object.freeze({
            ...node,
            rows: Object.freeze(
                node.rows.map((row, position) =>
                    position === at
                        ? Object.freeze({
                              ...row,
                              value: update(row.value, path, index + 1, change) as DocumentObject,
                          })
                        : row,
                ),
            ),
        });
    }
    return fail();
}
/** Throws on rejected intent; no mutation occurs, including on failure. */
export function applyDocumentChange(
    document: DocumentState,
    change: DocumentChange,
): DocumentState {
    if (!states.has(document)) fail();
    revision(document.revision);
    if (document.revision === Number.MAX_SAFE_INTEGER) fail();
    record(change);
    switch (change.kind) {
        case 'field':
            keys(change, ['kind', 'path', 'input']);
            break;
        case 'add-row':
            keys(change, ['kind', 'path', 'row']);
            break;
        case 'remove-row':
            keys(change, ['kind', 'path', 'key']);
            break;
        case 'move-row':
            keys(change, ['kind', 'path', 'key', 'before']);
            break;
        default:
            fail();
    }
    if (!Array.isArray(change.path) || !change.path.length) fail();
    for (const segment of change.path as ValuePath) {
        record(segment);
        if (segment.kind === 'property') {
            keys(segment, ['kind', 'name']);
            identity(segment.name);
        } else if (segment.kind === 'row') {
            keys(segment, ['kind', 'key']);
            identity(segment.key);
        } else fail();
    }
    return state(
        document.original,
        update(document.current, change.path, 0, change) as DocumentObject,
        document.revision + 1,
    );
}
/** Explicit in-memory restoration only; confirmation/discard policy belongs to the caller. */
export function resetDocumentState(document: DocumentState): DocumentState {
    if (!states.has(document)) fail();
    revision(document.revision);
    if (document.revision === Number.MAX_SAFE_INTEGER) fail();
    return state(document.original, document.original, document.revision + 1);
}
