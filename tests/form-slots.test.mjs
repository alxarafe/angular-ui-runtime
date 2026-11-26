import test from 'node:test';
import assert from 'node:assert/strict';
import { composeForm } from '../out-tsc/tests/projects/ui-runtime/src/public-api.js';
const path = (name) => [{ kind: 'property', name }];
const definition = {
    id: 'slots',
    label: 'Slots',
    fields: [{ id: 'field', path: path('field'), artifact: 'field.STRING' }],
    collections: [{ id: 'rows', path: path('rows') }],
};
const layout = (slots) => ({
    actions: [],
    tabs: [
        {
            id: 'tab',
            actions: [],
            sections: [
                {
                    id: 'section',
                    collapsible: true,
                    initiallyCollapsed: false,
                    actions: [],
                    groups: [{ id: 'group', fields: [], slots }],
                },
            ],
        },
    ],
});
test('slot placements use exact identities, first valid reference wins, preserving field/collection fallback', () => {
    const refs = [{ id: 'b' }, { id: 'missing' }, { id: 'a' }, { id: 'b' }];
    const result = composeForm(definition, layout(refs), ['a', 'b', 'unused']);
    const slots = result.tabs[0].sections[0].groups[0].slots;
    assert.deepEqual(slots, [{ id: 'b' }, { id: 'a' }]);
    assert.deepEqual(result.diagnostics, [
        { code: 'unknown-slot', id: 'missing' },
        { code: 'duplicate-slot', id: 'b' },
    ]);
    assert.equal(result.unplaced[0].id, 'field');
    assert.equal(result.unplacedCollections[0].id, 'rows');
    assert(Object.isFrozen(slots));
    assert(Object.isFrozen(slots[0]));
    assert.notEqual(slots[0], refs[0]);
    assert.equal(
        composeForm(definition, layout(refs)).tabs[0].sections[0].groups[0].slots.length,
        0,
    );
});
test('duplicate declarations and unsupported slot references reject deterministically', () => {
    assert.throws(
        () => composeForm(definition, undefined, ['a', 'a']),
        /Duplicate form slot identity/,
    );
    for (const id of ['', null, 5, {}, '  ']) {
        assert.throws(
            () => composeForm(definition, layout([{ id }]), ['a']),
            /Invalid form identity/,
        );
        assert.throws(() => composeForm(definition, undefined, [id]), /Invalid form identity/);
    }
});
