import {
    validateDocument,
    createDocumentState,
    type CollectionValidationPlan,
    type DocumentDiagnostic,
    type DocumentFieldValidation,
    type DocumentObject,
    type DocumentStructureDiagnostic,
    type DocumentValidationRequest,
    type DocumentValidationResult,
    type FieldValidationPlan,
    type IntegerFieldDefinition,
    type ObjectValidationPlan,
    type ValidationPlanNode,
    type ValuePath,
} from '../../projects/ui-runtime/src/public-api.js';

const quantity: IntegerFieldDefinition = {
    type: 'INTEGER',
    required: true,
    nullable: false,
    capacity: { bits: 32, signed: true },
};
const field: FieldValidationPlan = { kind: 'field', definition: quantity };
const row: ObjectValidationPlan = { kind: 'object', properties: { quantity: field } };
const collection: CollectionValidationPlan = { kind: 'collection', row };
const plan: ObjectValidationPlan = {
    kind: 'object',
    properties: { quantity: field, lines: collection },
};
const document: DocumentObject = {
    kind: 'object',
    properties: {
        quantity: {
            kind: 'field',
            equality: { type: 'INTEGER' },
            input: { kind: 'value', value: '1' },
        },
        lines: {
            kind: 'collection',
            ordered: true,
            allowAdd: true,
            allowRemove: true,
            allowReorder: true,
            rows: [],
        },
    },
};
const request: DocumentValidationRequest = { document, plan };
const result: DocumentValidationResult = validateDocument(request);
const path: ValuePath | undefined = result.fields[0]?.path;
const validation: DocumentFieldValidation | undefined = result.fields[0];
const diagnostic: DocumentDiagnostic | undefined = result.diagnostics[0];
const structural: DocumentStructureDiagnostic | undefined =
    diagnostic?.code === 'plan-cycle' ? diagnostic : undefined;
void path;
void validation;
void structural;
const planNode: ValidationPlanNode = field;
void planNode;

// @ts-expect-error a validation request requires the document tree, not DocumentState
validateDocument({ document: createDocumentState(document), plan });
// @ts-expect-error collection row schemas are object plans only
const scalarRow: CollectionValidationPlan = { kind: 'collection', row: field };
void scalarRow;
// @ts-expect-error heterogeneous row schema arrays are unsupported
const heterogeneous: CollectionValidationPlan = { kind: 'collection', row: [row] };
void heterogeneous;
// @ts-expect-error plan node kinds are closed
const unsupported: ValidationPlanNode = { kind: 'root', properties: {} };
void unsupported;
// @ts-expect-error field plans require a semantic definition
const missingDefinition: FieldValidationPlan = { kind: 'field' };
void missingDefinition;
// @ts-expect-error published field results remain immutable
result.fields[0]!.path[0] = { kind: 'property', name: 'changed' };
// @ts-expect-error aggregate states are closed
const state: DocumentValidationResult['state'] = 'accepted';
void state;
