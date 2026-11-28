import assert from 'node:assert/strict';
import {
    DocumentSession,
    createDocumentState,
    bindDocumentEditor,
    applyDocumentFieldIntent,
    applyDocumentCollectionIntent,
} from '../out-tsc/tests/projects/ui-runtime/src/public-api.js';
const prop = (name) => ({ kind: 'property', name });
export function scalarFixture(definition) {
    const field = { kind: 'field', equality: { type: 'exact' }, input: { kind: 'absent' } };
    const session = new DocumentSession(
        createDocumentState({
            kind: 'object',
            properties: {
                main: field,
                rows: {
                    kind: 'collection',
                    ordered: true,
                    allowAdd: false,
                    allowRemove: false,
                    allowReorder: true,
                    rows: ['a', 'b'].map((key) => ({
                        key,
                        value: { kind: 'object', properties: { value: field } },
                    })),
                },
            },
        }),
    );
    const leaf = { kind: 'field', definition };
    const options = {
        definition: {
            id: 'scalars',
            label: 'Scalars',
            fields: [{ id: 'main', path: [prop('main')], artifact: `field.${definition.type}` }],
            collections: [{ id: 'rows', path: [prop('rows')] }],
        },
        plan: {
            kind: 'object',
            properties: {
                main: leaf,
                rows: { kind: 'collection', row: { kind: 'object', properties: { value: leaf } } },
            },
        },
        fields: { main: { id: 'main', label: 'Main' } },
        collections: {
            rows: {
                label: 'Rows',
                columns: [
                    {
                        id: 'value',
                        field: 'value',
                        label: 'Value',
                        artifact: `field.${definition.type}`,
                    },
                ],
            },
        },
    };
    function project(input, invalid) {
        applyDocumentFieldIntent(session, { id: 'main', path: [prop('main')], input });
        applyDocumentCollectionIntent(session, {
            collectionId: 'rows',
            collectionPath: [prop('rows')],
            key: 'b',
            field: 'value',
            path: [prop('rows'), { kind: 'row', key: 'b' }, prop('value')],
            input,
        });
        const state = session.state;
        const bound = bindDocumentEditor(session, options);
        for (const context of [
            bound.contexts.main,
            bound.collectionContexts.rows.rows.find((r) => r.key === 'b').contexts.value,
        ]) {
            assert.deepEqual(context.documentInput, input);
            assert.equal(!!context.invalid, invalid);
        }
        assert.equal(session.state, state);
        return bound;
    }
    return { session, options, leaf, project };
}

export function slots(texts) {
    return texts.flatMap(([text, invalid]) => [
        [{ kind: 'raw', text }, invalid],
        [{ kind: 'value', value: text }, invalid],
    ]);
}
