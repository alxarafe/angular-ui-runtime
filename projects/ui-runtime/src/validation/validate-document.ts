/** SPDX-License-Identifier: Apache-2.0 */
import type { PathSegment, ValuePath } from '../form/form-definition.js';
import { documentNodeProblem } from '../state/document-state.js';
import type {
    DocumentCollection,
    DocumentField,
    DocumentNodeProblem,
    DocumentObject,
} from '../state/document-state.js';
import {
    validateField,
    validateFieldDefinition,
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
    readonly admittedPlans: WeakSet<object>;
    readonly cyclicPlans: WeakSet<object>;
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
function appendPath(path: ValuePath, segment: PathSegment): ValuePath {
    return Object.freeze([...path, Object.freeze({ ...segment })]);
}
function propertyPath(path: ValuePath, name: string): ValuePath {
    return appendPath(path, { kind: 'property', name });
}
function rowPath(path: ValuePath, key: string): ValuePath {
    return appendPath(path, { kind: 'row', key });
}
function segmentId(segment: PathSegment): string {
    return segment.kind === 'property' ? `property:${segment.name}` : `row:${segment.key}`;
}
function samePath(a: ValuePath, b: ValuePath): boolean {
    return (
        a.length === b.length &&
        a.every((segment, index) => segmentId(segment) === segmentId(b[index]!))
    );
}
function diagnostic(context: Context, value: DocumentDiagnostic): void {
    const duplicate = context.diagnostics.some(
        (existing) =>
            existing.source === value.source &&
            existing.code === value.code &&
            existing.message === value.message &&
            samePath(existing.path, value.path),
    );
    if (!duplicate) context.diagnostics.push(value);
}
function structure(
    context: Context,
    code: DocumentStructureDiagnosticCode,
    path: ValuePath,
    message: string,
): void {
    diagnostic(context, Object.freeze({ source: 'definition' as const, code, path, message }));
}
function documentProblemMessage(problem: DocumentNodeProblem): string {
    switch (problem) {
        case 'not-record':
            return 'A document node must be a plain object.';
        case 'unsupported-kind':
            return 'The document node kind is unsupported.';
        case 'members':
            return 'The document node contains missing or unsupported members.';
        case 'flags':
            return 'Document capability flags must be booleans.';
        case 'equality':
            return 'The document field equality metadata is invalid.';
        case 'input':
            return 'The document field input is not a supported editing slot.';
        case 'properties':
            return 'A document object requires an unambiguous properties map.';
        case 'collection':
            return 'A document collection requires boolean capability flags and a rows array.';
        case 'row':
            return 'A document collection row requires a nonempty unique key and an object value.';
    }
}
function inspectPlanNode(
    value: unknown,
    path: ValuePath,
    depth: number,
    schema: boolean,
    ancestors: Set<object>,
    context: Context,
): void {
    if (!isPlainRecord(value)) {
        structure(
            context,
            'malformed-plan',
            path,
            'The validation plan node must be a plain object.',
        );
        return;
    }
    if (depth > MAX_DEPTH) {
        structure(
            context,
            'depth-limit',
            path,
            'The document or validation plan exceeds the supported structural depth.',
        );
        return;
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
            return;
        }
        const diagnostics = validateFieldDefinition(
            (value as unknown as FieldValidationPlan).definition,
            path,
        );
        if (diagnostics) {
            for (const item of diagnostics) diagnostic(context, item);
            if (schema) return;
        }
        context.admittedPlans.add(value);
        return;
    }
    if (kind === 'object') {
        if (!exactKeys(value, ['kind', 'properties']) || !propertyMap(value['properties'])) {
            structure(
                context,
                'malformed-plan',
                path,
                'An object validation plan requires an unambiguous properties map.',
            );
            return;
        }
        if (ancestors.has(value)) {
            context.cyclicPlans.add(value);
            structure(context, 'plan-cycle', path, 'The validation plan contains a cycle.');
            return;
        }
        context.admittedPlans.add(value);
        ancestors.add(value);
        try {
            const properties = value['properties'] as Readonly<Record<string, unknown>>;
            for (const name of Object.keys(properties).sort()) {
                inspectPlanNode(
                    properties[name],
                    propertyPath(path, name),
                    depth + 1,
                    schema,
                    ancestors,
                    context,
                );
            }
        } finally {
            ancestors.delete(value);
        }
        return;
    }
    if (kind === 'collection') {
        if (!exactKeys(value, ['kind', 'row'])) {
            structure(
                context,
                'malformed-plan',
                path,
                'A collection validation plan requires only kind and a reusable row schema.',
            );
            return;
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
            return;
        }
        if (ancestors.has(value)) {
            context.cyclicPlans.add(value);
            structure(context, 'plan-cycle', path, 'The validation plan contains a cycle.');
            return;
        }
        context.admittedPlans.add(value);
        ancestors.add(value);
        try {
            inspectPlanNode(row, path, depth + 1, true, ancestors, context);
        } finally {
            ancestors.delete(value);
        }
        return;
    }
    structure(context, 'malformed-plan', path, 'The validation plan node kind is unsupported.');
}
function walkField(
    document: DocumentField,
    plan: FieldValidationPlan,
    path: ValuePath,
    context: Context,
): void {
    const result = validateField({
        definition: plan.definition,
        input: document.input,
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
        for (const item of result.diagnostics) diagnostic(context, item);
    }
}
function walkObject(
    document: DocumentObject,
    plan: ObjectValidationPlan,
    path: ValuePath,
    ancestors: Set<object>,
    context: Context,
): void {
    const properties = document.properties;
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
    for (const row of document.rows) {
        walkNode(row.value, plan.row, rowPath(path, row.key), ancestors, context);
    }
}
function walkNode(
    document: unknown,
    plan: unknown,
    path: ValuePath,
    ancestors: Set<object>,
    context: Context,
): void {
    if (typeof plan !== 'object' || plan === null || !context.admittedPlans.has(plan)) return;
    if (context.cyclicPlans.has(plan)) return;
    const planNode = plan as ValidationPlanNode;
    const problem = documentNodeProblem(document);
    if (problem) {
        structure(context, 'invalid-document', path, documentProblemMessage(problem));
        return;
    }
    const kind = (document as { readonly kind: 'field' | 'object' | 'collection' }).kind;
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
    if ((planNode.kind === 'object' || planNode.kind === 'collection') && ancestors.has(plan)) {
        structure(context, 'plan-cycle', path, 'The validation plan contains a cycle.');
        return;
    }
    if (planNode.kind === 'field') {
        walkField(document as DocumentField, planNode, path, context);
        return;
    }
    ancestors.add(plan);
    try {
        if (planNode.kind === 'object') {
            walkObject(document as DocumentObject, planNode, path, ancestors, context);
        } else {
            walkCollection(document as DocumentCollection, planNode, path, ancestors, context);
        }
    } finally {
        ancestors.delete(plan);
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
        admittedPlans: new WeakSet(),
        cyclicPlans: new WeakSet(),
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
        inspectPlanNode(plan, ROOT_PATH, 0, false, new Set(), context);
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
