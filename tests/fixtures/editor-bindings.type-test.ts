import {
    type FieldRendererContext,
    type FormFieldChange,
    type FormFieldEdit,
    type DetailGridEdit,
    type DetailGridChange,
    type EditingInput,
    type DocumentBindingOptions,
    bindDocumentEditor,
    applyDocumentFieldIntent,
    applyDocumentCollectionIntent,
} from '../../projects/ui-runtime/src/public-api.js';
const legacy: FieldRendererContext = { id: 'old', label: 'Old', value: null };
const lossless: FieldRendererContext = {
    ...legacy,
    documentInput: { kind: 'absent' },
    feedback: ['Required'],
    invalid: true,
};
const scalar: FormFieldChange = {
    id: 'old',
    path: [{ kind: 'property', name: 'title' }],
    value: '',
};
const edit: FormFieldEdit = { id: 'old', path: scalar.path, input: { kind: 'raw', text: '1e-' } };
const cell: DetailGridEdit = {
    collectionId: 'lines',
    collectionPath: [{ kind: 'property', name: 'lines' }],
    key: 'a',
    field: 'quantity',
    path: [
        { kind: 'property', name: 'lines' },
        { kind: 'row', key: 'a' },
        { kind: 'property', name: 'quantity' },
    ],
    input: { kind: 'absent' },
};
// @ts-expect-error Lossless inputs are not silently accepted on legacy scalar channels.
const wrong: FormFieldChange = edit;
// @ts-expect-error New cell edits do not masquerade as scalar/structural intents.
const wrongGrid: DetailGridChange = cell;
const input: EditingInput = lossless.documentInput!;
const enumCollection: DocumentBindingOptions['collections'][string] = {
    label: 'Choices',
    columns: [{ id: 'status', field: 'status', label: 'Status', artifact: 'field.ENUM' }],
    fields: { status: { choices: ['', 'OPEN'], readOnly: true, describedBy: ['help'] } },
};
const invalidCollection: DocumentBindingOptions['collections'][string] = {
    ...enumCollection,
    // @ts-expect-error Collection presentation must not supply another mutable document input.
    fields: { status: { documentInput: { kind: 'raw', text: 'draft' } } },
};
const invalidTimePresentation: DocumentBindingOptions['fields'] = {
    // @ts-expect-error TIME assistance derives from the validation plan, not presentation metadata.
    clock: { id: 'clock', label: 'Clock', timeDefinition: { type: 'TIME' } },
};
void [
    legacy,
    lossless,
    scalar,
    edit,
    cell,
    wrong,
    wrongGrid,
    input,
    enumCollection,
    invalidCollection,
    invalidTimePresentation,
    bindDocumentEditor,
    applyDocumentFieldIntent,
    applyDocumentCollectionIntent,
];
