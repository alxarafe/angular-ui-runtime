import assert from 'node:assert/strict';
import test from 'node:test';
import { Injector, runInInjectionContext, signal } from '@angular/core';
import {
    composeForm,
    DetailGrid,
    ListGrid,
    provideThemeRuntime,
    ThemeResolver,
    ThemeService,
    THEME_ARTIFACTS,
} from '../out-tsc/tests/projects/ui-runtime/src/public-api.js';
import { validateGrid } from '../out-tsc/tests/projects/ui-runtime/src/grid/grid-definition.js';
import { DEFAULT_THEME } from '../out-tsc/tests/tests/fixtures/theme-components.js';
import {
    AlternateFrame,
    DefaultFrame,
    InvalidFrame,
} from '../out-tsc/tests/tests/fixtures/form-components.js';
const path = (name) => [{ kind: 'property', name }];
const row = (key) => ({ key, label: 'Row ' + key, values: { value: '18446744073709551615' } });
const context = () => ({
    id: 'items',
    label: 'Items',
    path: path('items'),
    ordered: true,
    readOnly: false,
    allowAdd: true,
    allowRemove: true,
    allowReorder: true,
    columns: [{ id: 'value', label: 'Value', field: 'value', artifact: 'field.INTEGER' }],
    rows: [row('a'), row('b')],
});
function host(Type, initial) {
    const injector = Injector.create({ providers: provideThemeRuntime([DEFAULT_THEME]) });
    const instance = runInInjectionContext(injector, () => new Type());
    instance.context = signal(initial);
    instance.readOnly = signal(false);
    const events = [];
    (instance.gridChange ?? instance.rowSelected).subscribe((event) => events.push(event));
    return { instance, events, close: () => injector.destroy() };
}
test('list admission handles empty/single/multiple rows and exact scalars; selection uses stable keys', () => {
    for (const rows of [[], [row('a')], [row('a'), row('b')]]) validateGrid({ ...context(), rows });
    for (const value of [
        '18446744073709551615',
        '9223372036854775807.000000001',
        '-',
        '1e-',
        true,
        false,
        null,
        '',
    ])
        validateGrid({ ...context(), rows: [{ ...row('a'), values: { value } }] });
    const { instance, events, close } = host(ListGrid, { ...context(), selectable: true });
    try {
        instance.select('b');
        instance.select('absent');
        assert.deepEqual(events, ['b']);
        instance.context.set({ ...context(), selectable: false });
        instance.select('a');
        assert.equal(events.length, 1);
    } finally {
        close();
    }
});
test('malformed columns, paths, duplicate keys and missing/extraneous cell targets reject', () => {
    const base = context();
    for (const invalid of [
        { ...base, id: '' },
        { ...base, label: '' },
        { ...base, columns: [] },
        { ...base, columns: [base.columns[0], base.columns[0]] },
        { ...base, columns: [{ ...base.columns[0], artifact: 'field.INT64' }] },
        { ...base, rows: [row('a'), row('a')] },
        { ...base, rows: [row('')] },
        { ...base, rows: [{ ...row('a'), values: {} }] },
        { ...base, rows: [{ ...row('a'), values: { value: 123 } }] },
        { ...base, rows: [{ ...row('a'), values: ['value'] }] },
        { ...base, rows: [{ ...row('a'), contexts: null }] },
        { ...base, rows: [{ ...row('a'), contexts: { value: null } }] },
        { ...base, rows: [{ ...row('a'), contexts: { value: { describedBy: ['invalid id'] } } }] },
        { ...base, rows: [{ ...row('a'), contexts: { value: { choices: [1] } } }] },
        { ...base, rows: [{ ...row('a'), contexts: { missing: { readOnly: true } } }] },
        { ...base, path: [] },
        { ...base, path: [{ kind: 'property', name: 'items', index: 0 }] },
        { ...base, path: [{ kind: 'row', key: 'a' }] },
        {
            ...base,
            path: [
                { kind: 'property', name: 'items' },
                { kind: 'row', key: '' },
            ],
        },
        { ...base, allowAdd: 'true' },
        { ...base, rows: [{ ...row('a'), contexts: { value: { disabled: 'true' } } }] },
    ])
        assert.throws(() => validateGrid(invalid, true));
});
test('duplicate labels use non-sensitive positional names without colliding with unique labels', () => {
    const rows = [
        { ...row('private-key-a'), label: 'Repeated' },
        { ...row('private-key-b'), label: 'Repeated' },
        { ...row('private-key-c'), label: 'Repeated (row 1)' },
    ];
    const { instance, events, close } = host(DetailGrid, { ...context(), rows });
    try {
        const labels = () =>
            instance.grid().rows.map((row) => instance.cell(row, instance.grid().columns[0]).label);
        assert.deepEqual(labels(), [
            'Value — Repeated (row 1) (row 1)',
            'Value — Repeated (row 2)',
            'Value — Repeated (row 1)',
        ]);
        assert.equal(
            labels().some((label) => label.includes('private-key')),
            false,
        );
        instance.context.set({ ...context(), rows: [rows[1], rows[0], rows[2]] });
        assert.equal(new Set(labels()).size, 3);
        instance.edit('private-key-b', 'value', '-');
        assert.equal(events[0].key, 'private-key-b');
        instance.context.set({ ...context(), rows: [rows[1]] });
        assert.deepEqual(labels(), ['Value — Repeated']);
        assert.deepEqual(
            rows.map((row) => row.label),
            ['Repeated', 'Repeated', 'Repeated (row 1)'],
        );
    } finally {
        close();
    }
});
test('immutable intents retain full typed collection/cell identity and never change application rows', () => {
    const original = context(),
        before = JSON.stringify(original);
    const { instance, events, close } = host(DetailGrid, original);
    try {
        for (const value of [
            '18446744073709551615',
            '9223372036854775807.000000001',
            '-',
            '1e-',
            null,
            false,
        ])
            instance.edit('b', 'value', value);
        instance.add();
        instance.remove('a');
        instance.move('b', 'a');
        instance.move('a', null);
        assert.equal(JSON.stringify(original), before);
        for (const event of events) {
            assert.equal(event.collectionId, 'items');
            assert.deepEqual(event.collectionPath, path('items'));
            assert(Object.isFrozen(event));
            assert(Object.isFrozen(event.collectionPath[0]));
        }
        assert.deepEqual(events[0].path, [
            ...path('items'),
            { kind: 'row', key: 'b' },
            ...path('value'),
        ]);
        assert(Object.isFrozen(events[0].path[1]));
        assert.deepEqual(
            events.slice(-4).map((event) => event.kind),
            ['add-row', 'remove-row', 'move-row', 'move-row'],
        );
        assert.equal(Object.hasOwn(events.at(-4), 'row'), false);
        instance.context.set({ ...original, rows: [row('b'), row('new')] });
        instance.edit('b', 'value', 'shifted');
        instance.remove('b');
        instance.move('new', 'b');
        assert.equal(events.at(-3).key, 'b');
        assert.equal(events.at(-1).before, 'b');
        assert.throws(() => instance.edit('a', 'value', 'wrong'));
        assert.throws(() => instance.edit('b', 'missing', 'wrong'));
        assert.throws(() => instance.edit('b', 'value', 42));
        assert.throws(() => instance.move('b', 'a'));
    } finally {
        close();
    }
});
test('read-only/disabled and explicit collection capabilities suppress even direct synthetic intents', () => {
    const { instance, events, close } = host(DetailGrid, context());
    try {
        for (const flags of [{ readOnly: true }, { disabled: true }]) {
            instance.context.set({ ...context(), ...flags });
            instance.edit('a', 'value', '-');
            instance.add();
            instance.remove('a');
            instance.move('b', 'a');
            assert.equal(events.length, 0);
        }
        instance.context.set({
            ...context(),
            allowAdd: false,
            allowRemove: false,
            allowReorder: false,
        });
        instance.add();
        instance.remove('a');
        instance.move('b', 'a');
        assert.equal(events.length, 0);
        instance.context.set({ ...context(), ordered: false });
        instance.move('b', 'a');
        assert.equal(events.length, 0);
        instance.context.set({
            ...context(),
            rows: [{ ...row('a'), contexts: { value: { readOnly: true } } }],
        });
        instance.edit('a', 'value', '-');
        assert.equal(events.length, 0);
        instance.context.set(context());
        instance.readOnly.set(true);
        instance.edit('b', 'value', '-');
        instance.add();
        assert.equal(events.length, 0);
    } finally {
        close();
    }
});
test('collection placement is independent, frozen, first-valid, protected and deterministic', () => {
    const collections = ['first', 'second', 'third', 'secret'].map((id) => ({
        id,
        path: path(id),
        excluded: id === 'secret',
    }));
    const definition = { id: 'form', label: 'Form', fields: [], collections };
    const group = {
        id: 'group',
        fields: [],
        collections: [path('second'), path('second'), path('secret'), path('unknown')],
    };
    const layout = {
        actions: [],
        tabs: [
            {
                id: 'tab',
                actions: [],
                sections: [
                    {
                        id: 'section',
                        collapsible: false,
                        initiallyCollapsed: false,
                        actions: [],
                        groups: [group],
                    },
                ],
            },
        ],
    };
    const result = composeForm(definition, layout);
    assert.deepEqual(
        result.tabs[0].sections[0].groups[0].collections.map((item) => item.id),
        ['second'],
    );
    assert.deepEqual(
        result.unplacedCollections.map((item) => item.id),
        ['first', 'third'],
    );
    assert.deepEqual(
        result.diagnostics.map((item) => item.code),
        ['duplicate-collection', 'excluded-collection', 'unknown-collection'],
    );
    assert(Object.isFrozen(result.unplacedCollections[0].path[0]));
    assert.deepEqual(
        composeForm(definition).unplacedCollections.map((item) => item.id),
        ['first', 'second', 'third'],
    );
    assert.throws(() =>
        composeForm({ ...definition, collections: [collections[0], collections[0]] }),
    );
    assert.throws(() =>
        composeForm({
            ...definition,
            collections: [collections[0], { ...collections[1], path: path('first') }],
        }),
    );
    assert.throws(() =>
        composeForm(definition, {
            ...layout,
            tabs: [
                {
                    ...layout.tabs[0],
                    sections: [
                        {
                            ...layout.tabs[0].sections[0],
                            groups: [{ ...group, collections: [[]] }],
                        },
                    ],
                },
            ],
        }),
    );
});
test('optional grid presentation resolves active → default → core without adding mandatory artifacts', () => {
    const injector = Injector.create({
        providers: provideThemeRuntime([
            { ...DEFAULT_THEME, components: { listGrid: DefaultFrame } },
            {
                id: 'active',
                cssClass: 'active',
                overrides: {},
                components: { detailGrid: AlternateFrame },
            },
            { id: 'sparse', cssClass: 'sparse', overrides: {} },
        ]),
    });
    try {
        const resolver = injector.get(ThemeResolver),
            service = injector.get(ThemeService);
        assert.equal(THEME_ARTIFACTS.length, 14);
        service.activate('active');
        assert.equal(resolver.resolveComponent('listGrid'), DefaultFrame);
        assert.equal(resolver.resolveComponent('detailGrid'), AlternateFrame);
        service.activate('sparse');
        assert.equal(resolver.resolveComponent('listGrid'), DefaultFrame);
        assert.equal(resolver.resolveComponent('detailGrid').name, 'DefaultFormPresentation');
    } finally {
        injector.destroy();
    }
    assert.throws(() =>
        Injector.create({
            providers: provideThemeRuntime([
                { ...DEFAULT_THEME, components: { detailGrid: InvalidFrame } },
            ]),
        }).get(ThemeResolver),
    );
});
