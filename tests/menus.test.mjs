import test from 'node:test';
import assert from 'node:assert/strict';
import {
    snapshotMenus,
    composeMenus,
} from '../out-tsc/tests/projects/ui-runtime/src/menu/menu-definition.js';
const menu = (id, kind = 'primary') => ({
    id,
    kind,
    label: 'Repeated label',
    items: [
        {
            id: 'group',
            label: 'Repeated label',
            children: [{ id: 'action', label: 'Repeated label', action: 'opaque' }],
        },
        { id: 'link', label: 'Link', href: '#native', current: true },
    ],
});
const all = () =>
    ['primary', 'secondary', 'account'].flatMap((kind) => [
        menu(kind + '1', kind),
        menu(kind + '2', kind),
    ]);
test('zero, one and unrestricted same-kind menus snapshot immutably in input order', () => {
    assert.deepEqual(snapshotMenus([]), []);
    assert.equal(snapshotMenus([menu('one')]).length, 1);
    const source = all();
    const snapshot = snapshotMenus(source);
    source[0].items[0].children[0].label = 'changed';
    assert.equal(snapshot[0].items[0].children[0].label, 'Repeated label');
    assert(Object.isFrozen(snapshot[0].items[0].children));
    assert.deepEqual(
        snapshot.map((x) => x.id),
        all().map((x) => x.id),
    );
    assert.equal(snapshotMenus(Array.from({ length: 150 }, (_, i) => menu(String(i)))).length, 150);
});
test('duplicate identities, cycles, malformed leaves and metadata are rejected atomically', () => {
    const cyclic = menu('cycle');
    cyclic.items[0].children.push(cyclic.items[0]);
    for (const defs of [
        [menu('a'), menu('a')],
        [{ ...menu('a'), kind: 'unknown' }],
        [{ ...menu('a'), items: [{ id: 'a', label: 'x' }] }],
        [{ ...menu('a'), items: [{ id: 'a', label: 'x', action: 'x', href: '#x' }] }],
        [cyclic],
        [
            {
                ...menu('a'),
                items: [
                    { id: 'same', label: 'x', children: [{ id: 'same', label: 'y', action: 'x' }] },
                ],
            },
        ],
        [{ ...menu('a'), items: [{ id: 'x', label: 'x', action: 'x', disabled: 'false' }] }],
    ])
        assert.throws(() => snapshotMenus(defs), /Invalid menu/);
});
test('placements assign exactly once, preserve order, omit only empty menus and diagnose conflicts', () => {
    const menus = [...all(), { id: 'empty', kind: 'primary', label: 'Empty', items: [] }];
    const result = composeMenus(
        menus,
        [
            { menuId: 'primary1', region: 'tools' },
            { menuId: 'primary2', region: 'missing' },
            { menuId: 'secondary1', region: 'tools' },
            { menuId: 'secondary1', region: 'tools' },
            { menuId: 'account1', region: 'INVALID' },
            { menuId: 'unknown', region: 'tools' },
        ],
        ['tools'],
    );
    assert.deepEqual(
        result.menus.map((x) => x.menu.id),
        all().map((x) => x.id),
    );
    assert.equal(result.menus[0].region, 'tools');
    assert(result.menus.slice(1).every((x) => x.region === null));
    assert.equal(new Set(result.menus.map((x) => x.menu.id)).size, 6);
    assert.deepEqual(
        result.diagnostics.map((x) => x.code),
        ['invalid-placement', 'invalid-placement', 'unavailable-region', 'conflicting-placement'],
    );
    assert(Object.isFrozen(result.diagnostics));
    assert(Object.isFrozen(result.menus));
    assert(
        composeMenus(all(), [{ menuId: 'primary1', region: 'tools' }], []).menus.every(
            (x) => x.region === null,
        ),
    );
});
