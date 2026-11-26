import {
    ChoiceSelector,
    type ChoiceSelectorOptions,
    type ChoiceSelectorContext,
    type FormFieldPage,
    type DetailGridPage,
} from '../../projects/ui-runtime/src/public-api.js';
const selector: ChoiceSelectorOptions = {
    options: [
        { value: '', label: 'Empty' },
        { value: 'opaque /?#', label: 'Same' },
        { value: 'other', label: 'Same' },
    ],
    previous: false,
    next: true,
};
const context: ChoiceSelectorContext = {
    id: 'choice',
    label: 'Choice',
    value: null,
    selector,
    documentInput: { kind: 'absent' },
};
const header: FormFieldPage = {
    id: 'choice',
    path: [{ kind: 'property', name: 'choice' }],
    direction: 'next',
};
const cell: DetailGridPage = {
    collectionId: 'rows',
    collectionPath: [{ kind: 'property', name: 'rows' }],
    key: 'a',
    field: 'choice',
    path: [
        { kind: 'property', name: 'rows' },
        { kind: 'row', key: 'a' },
        { kind: 'property', name: 'choice' },
    ],
    direction: 'previous',
};
const bad: ChoiceSelectorOptions = {
    ...selector,
    // @ts-expect-error Native numbers are not lossless opaque selector identities.
    options: [{ value: 9007199254740993, label: 'Wrong' }],
};
// @ts-expect-error Pagination is a neutral direction, never an HTTP query.
const wrong: FormFieldPage = { ...header, direction: '/api/options?offset=2' };
void [ChoiceSelector, context, header, cell, bad, wrong];
