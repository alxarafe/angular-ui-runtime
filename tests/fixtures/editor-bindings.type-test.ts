import {
    type FieldRendererContext,
    type FormFieldChange,
    type FormFieldEdit,
    type DetailGridEdit,
    type DetailGridChange,
    type EditingInput,
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
void [
    legacy,
    lossless,
    scalar,
    edit,
    cell,
    wrong,
    wrongGrid,
    input,
    bindDocumentEditor,
    applyDocumentFieldIntent,
    applyDocumentCollectionIntent,
];
