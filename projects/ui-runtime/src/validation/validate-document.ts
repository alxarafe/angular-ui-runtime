/** SPDX-License-Identifier: Apache-2.0 */
import type { PathSegment, ValuePath } from '../form/form-definition.js';
import type {
    DocumentCollection,
    DocumentField,
    DocumentObject,
    DocumentRow,
} from '../state/document-state.js';
import {
    validateField,
    type DeferredCheck,
    type DefinitionDiagnostic,
    type FieldValidationRequest,
    type FieldValidationResult,
    type PatternDiagnostic,
    type ValidationIssue,
} from './validate-field.js';

export type ValidationFieldDefinition = FieldValidationRequest['definition'];

/** Field node of a declarative document validation plan. */
export interface FieldValidationPlan {
    readonly kind: 'field';
    readonly definition: ValidationFieldDefinition;
}

/** Object node of a declarative document validation plan. */
export interface ObjectValidationPlan {
    readonly kind: 'object';
    readonly properties: Readonly<Record<string, ValidationPlanNode>>;
}

/**
 * Collection node of a declarative document validation plan. The same row schema
 * applies to every row; heterogeneous row definitions are not supported yet.
 */
export interface CollectionValidationPlan {
    readonly kind: 'collection';
    readonly row: ObjectValidationPlan;
}

export type ValidationPlanNode =
    FieldValidationPlan | ObjectValidationPlan | CollectionValidationPlan;

export interface DocumentValidationRequest {
    readonly document: DocumentObject;
    readonly plan: ObjectValidationPlan;
}

export type DocumentValidationState = 'valid' | 'pending' | 'invalid' | 'definition-error';

export interface DocumentFieldValidation {
    readonly path: ValuePath;
    readonly result: FieldValidationResult;
}

export type DocumentStructureDiagnosticCode =
    | 'invalid-request'
    | 'invalid-document'
    | 'missing-definition'
    | 'unknown-definition'
    | 'kind-mismatch'
    | 'malformed-plan'
    | 'malformed-row-schema'
    | 'plan-cycle'
    | 'depth-limit';

/** Fatal structural plan diagnostics. Existing field definitions keep their own codes. */
export interface DocumentStructureDiagnostic {
    readonly source: 'definition';
    readonly code: DocumentStructureDiagnosticCode;
    readonly path: ValuePath;
    readonly message: string;
}

export type DocumentDiagnostic = DefinitionDiagnostic | DocumentStructureDiagnostic;

export interface DocumentValidationResult {
    readonly state: DocumentValidationState;
    readonly fields: readonly DocumentFieldValidation[];
    readonly issues: readonly ValidationIssue[];
    readonly diagnostics: readonly DocumentDiagnostic[];
    readonly patternDiagnostics: readonly PatternDiagnostic[];
    readonly checks: readonly DeferredCheck[];
}

interface Context {
    readonly fields: DocumentFieldValidation[];
    readonly issues: ValidationIssue[];
    readonly diagnostics: DocumentDiagnostic[];
    readonly patternDiagnostics: PatternDiagnostic[];
    readonly checks: DeferredCheck[];
}

const MAX_DEPTH = 128;
const ROOT_PATH: ValuePath = Object.freeze([]);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
    return (
        !!value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        [Object.prototype, null].includes(Object.getPrototypeOf(value))
    );
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
    return (
        keys.every((key) => Object.hasOwn(value, key)) &&
        Reflect.ownKeys(value).every((key) => typeof key === 'string' && keys.includes(key))
    );
}
function propertyMap(value: unknown): value is Readonly<Record<string, unknown>> {
    return (
        isPlainRecord(value) &&
        Reflect.ownKeys(value).every((key) => typeof key === 'string' && key.trim().length > 0) &&
        Object.keys(value).length === Reflect.ownKeys(value).length
    );
}
function documentKind(value: unknown): 'field' | 'object' | 'collection' | undefined {
    if (!isPlainRecord(value)) return undefined;
    const kind = value['kind'];
    return kind === 'field' || kind === 'object' || kind === 'collection' ? kind : undefined;
}
function appendPath(path: ValuePath, segment: PathSegment): ValuePath {
    return Object.freeze([...path, Object.freeze({ ...segment })]);
}
function propertyPath(path: ValuePath, name: string): ValuePath {
    return appendPath(path, { kind: 'property', name });
}
function rowPath(path: ValuePath, key: string): ValuePath {
    return appendPath(path, { kind: 'row', key });
}
function structure(
    context: Context,
    code: DocumentStructureDiagnosticCode,
    path: ValuePath,
    message: string,
): void {
    context.diagnostics.push(Object.freeze({ source: 'definition' as const, code, path, message }));
}
function readPlanNode(
    value: unknown,
    path: ValuePath,
    context: Context,
): ValidationPlanNode | undefined {
    if (!isPlainRecord(value)) {
        structure(
            context,
            'malformed-plan',
            path,
            'The validation plan node must be a plain object.',
        );
        return undefined;
    }
    const kind = value['kind'];
    if (kind === 'field') {
        if (!exactKeys(value, ['kind', 'definition'])) {
            structure(
                context,
                'malformed-plan',
                path,
                'A field validation plan requires only kind and definition.',
            );
            return undefined;
        }
        return value as unknown as FieldValidationPlan;
    }
    if (kind === 'object') {
        if (!exactKeys(value, ['kind', 'properties']) || !propertyMap(value['properties'])) {
            structure(
                context,
                'malformed-plan',
                path,
                'An object validation plan requires an unambiguous properties map.',
            );
            return undefined;
        }
        return value as unknown as ObjectValidationPlan;
    }
    if (kind === 'collection') {
        if (!exactKeys(value, ['kind', 'row'])) {
            structure(
                context,
                'malformed-plan',
                path,
                'A collection validation plan requires only kind and a reusable row schema.',
            );
            return undefined;
        }
        const row = value['row'];
        if (
            !isPlainRecord(row) ||
            row['kind'] !== 'object' ||
            !exactKeys(row, ['kind', 'properties']) ||
            !propertyMap(row['properties'])
        ) {
            structure(
                context,
                'malformed-row-schema',
                path,
                'A collection validation plan row schema must be an object plan.',
            );
            return undefined;
        }
        return value as unknown as CollectionValidationPlan;
    }
    structure(context, 'malformed-plan', path, 'The validation plan node kind is unsupported.');
    return undefined;
}
function walkField(
    document: unknown,
    plan: FieldValidationPlan,
    path: ValuePath,
    context: Context,
): void {
    if (!isPlainRecord(document) || !Object.hasOwn(document, 'input')) {
        structure(context, 'invalid-document', path, 'A document field requires an editing input.');
        return;
    }
    const input = document['input'];
    if (
        !isPlainRecord(input) ||
        (input['kind'] !== 'absent' && input['kind'] !== 'value' && input['kind'] !== 'raw')
    ) {
        structure(
            context,
            'invalid-document',
            path,
            'The document field input is not a supported editing slot.',
        );
        return;
    }
    const result = validateField({
        definition: plan.definition,
        input: input as DocumentField['input'],
        path,
    });
    context.fields.push(Object.freeze({ path, result }));
    if (result.state === 'invalid') {
        for (const issue of result.issues) context.issues.push(issue);
        if (result.checks) for (const check of result.checks) context.checks.push(check);
        if (result.diagnostics)
            for (const diagnostic of result.diagnostics)
                context.patternDiagnostics.push(diagnostic);
    } else if (result.state === 'pending') {
        for (const check of result.checks) context.checks.push(check);
        if (result.diagnostics)
            for (const diagnostic of result.diagnostics)
                context.patternDiagnostics.push(diagnostic);
    } else if (result.state === 'definition-error') {
        for (const diagnostic of result.diagnostics) context.diagnostics.push(diagnostic);
    }
}
function walkObject(
    document: DocumentObject,
    plan: ObjectValidationPlan,
    path: ValuePath,
    ancestors: Set<object>,
    context: Context,
): void {
    const properties = (document as unknown as Record<string, unknown>)['properties'];
    if (!propertyMap(properties)) {
        structure(
            context,
            'invalid-document',
            path,
            'A document object requires an unambiguous properties map.',
        );
        return;
    }
    const names = Array.from(
        new Set([...Object.keys(properties), ...Object.keys(plan.properties)]),
    ).sort();
    for (const name of names) {
        const childPath = propertyPath(path, name);
        const inDocument = Object.hasOwn(properties, name);
        const inPlan = Object.hasOwn(plan.properties, name);
        if (!inPlan) {
            structure(
                context,
                'missing-definition',
                childPath,
                'The document node has no validation definition.',
            );
            continue;
        }
        if (!inDocument) {
            structure(
                context,
                'unknown-definition',
                childPath,
                'The validation plan defines a nonexistent document property.',
            );
            continue;
        }
        walkNode(properties[name], plan.properties[name], childPath, ancestors, context);
    }
}
function walkCollection(
    document: DocumentCollection,
    plan: CollectionValidationPlan,
    path: ValuePath,
    ancestors: Set<object>,
    context: Context,
): void {
    const rows = (document as unknown as Record<string, unknown>)['rows'];
    if (!Array.isArray(rows)) {
        structure(
            context,
            'invalid-document',
            path,
            'A document collection requires an array of keyed rows.',
        );
        return;
    }
    const seen = new Set<string>();
    for (const row of rows as readonly DocumentRow[]) {
        if (!isPlainRecord(row) || typeof row['key'] !== 'string' || !row['key'].trim()) {
            structure(
                context,
                'invalid-document',
                path,
                'A document collection contains a malformed row identity.',
            );
            continue;
        }
        const key = row['key'];
        const itemPath = rowPath(path, key);
        if (seen.has(key)) {
            structure(
                context,
                'invalid-document',
                itemPath,
                'A document collection contains duplicate row identities.',
            );
            continue;
        }
        seen.add(key);
        const value = row['value'];
        if (!isPlainRecord(value) || value['kind'] !== 'object') {
            structure(
                context,
                'invalid-document',
                itemPath,
                'A document collection row value must be an object.',
            );
            continue;
        }
        walkNode(value, plan.row, itemPath, ancestors, context);
    }
}
function walkNode(
    document: unknown,
    plan: unknown,
    path: ValuePath,
    ancestors: Set<object>,
    context: Context,
): void {
    const planNode = readPlanNode(plan, path, context);
    if (!planNode) return;
    const kind = documentKind(document);
    if (!kind) {
        structure(
            context,
            'invalid-document',
            path,
            'The document node is not a supported field, object or collection.',
        );
        return;
    }
    if (kind !== planNode.kind) {
        structure(
            context,
            'kind-mismatch',
            path,
            'The validation plan kind does not match the document node kind.',
        );
        return;
    }
    if (path.length > MAX_DEPTH) {
        structure(
            context,
            'depth-limit',
            path,
            'The document or validation plan exceeds the supported structural depth.',
        );
        return;
    }
    if (
        (planNode.kind === 'object' || planNode.kind === 'collection') &&
        ancestors.has(plan as object)
    ) {
        structure(context, 'plan-cycle', path, 'The validation plan contains a cycle.');
        return;
    }
    if (planNode.kind === 'field') {
        walkField(document, planNode, path, context);
        return;
    }
    ancestors.add(plan as object);
    try {
        if (planNode.kind === 'object') {
            walkObject(document as DocumentObject, planNode, path, ancestors, context);
        } else {
            walkCollection(document as DocumentCollection, planNode, path, ancestors, context);
        }
    } finally {
        ancestors.delete(plan as object);
    }
}
function documentValidationState(context: Context): DocumentValidationState {
    if (context.diagnostics.length) return 'definition-error';
    if (context.fields.some((field) => field.result.state === 'definition-error'))
        return 'definition-error';
    if (context.fields.some((field) => field.result.state === 'invalid')) return 'invalid';
    if (context.fields.some((field) => field.result.state === 'pending')) return 'pending';
    return 'valid';
}

/**
 * Deterministically validates a complete immutable document tree against a
 * separately supplied declarative plan. Never reads or mutates a DocumentState.
 */
export function validateDocument(request: DocumentValidationRequest): DocumentValidationResult {
    const context: Context = {
        fields: [],
        issues: [],
        diagnostics: [],
        patternDiagnostics: [],
        checks: [],
    };
    if (!isPlainRecord(request) || !exactKeys(request, ['document', 'plan'])) {
        structure(
            context,
            'invalid-request',
            ROOT_PATH,
            'Document validation requires exactly one document tree and one validation plan.',
        );
    } else {
        const document = request['document'];
        const plan = request['plan'];
        if (!isPlainRecord(document) || document['kind'] !== 'object') {
            structure(
                context,
                'invalid-document',
                ROOT_PATH,
                'The root document node must be an object.',
            );
        } else {
            walkNode(document, plan, ROOT_PATH, new Set(), context);
        }
    }
    return Object.freeze({
        state: documentValidationState(context),
        fields: Object.freeze([...context.fields]),
        issues: Object.freeze([...context.issues]),
        diagnostics: Object.freeze([...context.diagnostics]),
        patternDiagnostics: Object.freeze([...context.patternDiagnostics]),
        checks: Object.freeze([...context.checks]),
    });
}
