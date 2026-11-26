import assert from 'node:assert/strict';
import test from 'node:test';
import { Injector, runInInjectionContext, signal } from '@angular/core';
import {
    ListGrid,
    provideThemeRuntime,
} from '../out-tsc/tests/projects/ui-runtime/src/public-api.js';
import { DEFAULT_THEME } from '../out-tsc/tests/tests/fixtures/theme-components.js';
import {
    validateSelectedKeys,
    validateListPaging,
    snapshotListQuery,
} from '../out-tsc/tests/projects/ui-runtime/src/grid/list-ports.js';
const row = (key) => ({ key, label: 'Repeated', values: { value: '18446744073709551615' } });
const context = {
    id: 'list',
    label: 'List',
    columns: [{ id: 'value', field: 'value', label: 'Value' }],
    rows: [row('a /?#'), row('b')],
    selectable: true,
};
const query = {
    inputs: [
        { id: 'search', label: 'Search', value: '  e\u0301 null 9007199254740993 ' },
        {
            id: 'sort',
            label: 'Sort',
            value: '',
            choices: [
                { value: '', label: 'Default' },
                { value: 'opaque/-?', label: 'Repeated' },
            ],
        },
        { id: 'filter', label: 'Filter', value: '1e-', message: 'Application feedback' },
    ],
};
const page = { offset: 0, pageSize: 2, previous: true, next: true };
function fixture() {
    const injector = Injector.create({ providers: provideThemeRuntime([DEFAULT_THEME]) });
    const list = runInInjectionContext(injector, () => new ListGrid());
    list.context = signal(context);
    list.selectedKeys = signal(['outside']);
    list.paging = signal(page);
    list.query = signal(query);
    list.disabled = signal(false);
    list.readOnly = signal(false);
    list.busy = signal(false);
    const single = [],
        selection = [],
        pages = [],
        edits = [],
        applies = [];
    list.rowSelected.subscribe((e) => single.push(e));
    list.selectionChange.subscribe((e) => selection.push(e));
    list.pageChange.subscribe((e) => pages.push(e));
    list.queryChange.subscribe((e) => edits.push(e));
    list.queryApply.subscribe((e) => applies.push(e));
    return { list, single, selection, pages, edits, applies, close: () => injector.destroy() };
}
test('legacy activation and controlled multi selection have separate explicit channels; outside-page keys persist', () => {
    const f = fixture();
    try {
        f.list.select('a /?#');
        assert.deepEqual(f.single, ['a /?#']);
        f.list.setSelected('a /?#', true);
        f.list.setSelected('outside', false);
        f.list.setSelected('missing', true);
        assert.deepEqual(f.selection, [{ key: 'a /?#', selected: true }]);
        assert(Object.isFrozen(f.selection[0]));
        assert.deepEqual(f.list.selectedKeys(), ['outside']);
        f.list.selectedKeys.set(['outside', 'a /?#']);
        f.list.setSelected('a /?#', true);
        f.list.setSelected('a /?#', false);
        assert.deepEqual(f.selection.at(-1), { key: 'a /?#', selected: false });
        assert.equal(f.selection.length, 2);
        f.list.context.set({ ...context, rows: [row('c')] });
        assert.deepEqual(f.list.keys(), ['outside', 'a /?#']);
        assert.equal(f.list.outsideCount(), 2);
        f.list.context.set(context);
        assert.equal(f.list.isSelected('a /?#'), true);
        f.list.selectedKeys.set(undefined);
        f.list.setSelected('b', true);
        assert.equal(f.selection.length, 2);
    } finally {
        f.close();
    }
});
test('pager uses explicit availability, safe offsets, known/unknown totals and never guesses from empty/short pages', () => {
    const f = fixture();
    try {
        f.list.requestPage('previous');
        assert.equal(f.pages.length, 0);
        f.list.context.set({ ...context, rows: [] });
        f.list.requestPage('next');
        assert.deepEqual(f.pages, [{ direction: 'next', offset: 2, pageSize: 2 }]);
        assert.equal(f.list.paging().offset, 0);
        f.list.paging.set({ ...page, offset: 2, total: 4 });
        f.list.requestPage('next');
        assert.equal(f.pages.length, 1);
        f.list.requestPage('previous');
        assert.equal(f.pages.at(-1).offset, 0);
        f.list.paging.set({ ...page, offset: 1 });
        f.list.requestPage('previous');
        assert.equal(f.pages.at(-1).offset, 0);
        f.list.paging.set({ ...page, total: 0 });
        f.list.requestPage('next');
        assert.equal(f.pages.length, 3);
        f.list.paging.set({ ...page, next: false });
        f.list.requestPage('next');
        assert.equal(f.pages.length, 3);
        f.list.paging.set({ ...page, offset: Number.MAX_SAFE_INTEGER });
        f.list.requestPage('next');
        assert.equal(f.pages.length, 3);
        assert(f.pages.every(Object.isFrozen));
    } finally {
        f.close();
    }
});
test('query edits retain exact strings and application tokens; only an explicit apply snapshots inputs', () => {
    const f = fixture();
    try {
        const exact = '  null false 9007199254740993 e\u0301 /?#  ';
        f.list.editQuery('search', exact);
        f.list.editQuery('filter', '');
        f.list.editQuery('sort', 'opaque/-?');
        assert.deepEqual(f.edits, [
            { id: 'search', value: exact },
            { id: 'filter', value: '' },
            { id: 'sort', value: 'opaque/-?' },
        ]);
        assert.equal(f.applies.length, 0);
        assert.equal(f.list.query(), query);
        for (const value of [null, false, 1, 'unknown']) f.list.editQuery('sort', value);
        assert.equal(f.edits.length, 3);
        f.list.query.set({
            ...query,
            inputs: query.inputs.map((input) =>
                input.id === 'search' ? { ...input, value: exact } : input,
            ),
        });
        f.list.applyQuery();
        assert.equal(f.applies.length, 1);
        assert.equal(f.applies[0][0].value, exact);
        assert(Object.isFrozen(f.applies[0]));
        assert(Object.isFrozen(f.applies[0][0]));
        assert.equal(f.list.queryContextFor(query.inputs[1]).documentInput.value, '');
        assert.deepEqual(f.list.queryContextFor(query.inputs[2]).feedback, [
            'Application feedback',
        ]);
    } finally {
        f.close();
    }
});
test('busy, disabled and readonly suppress even synthetic intents; input flags suppress only their edits', () => {
    for (const flag of ['busy', 'disabled', 'readOnly']) {
        const f = fixture();
        try {
            f.list[flag].set(true);
            f.list.select('b');
            f.list.setSelected('b', true);
            f.list.requestPage('next');
            f.list.editQuery('filter', 'draft');
            f.list.applyQuery();
            assert.deepEqual(
                [f.single, f.selection, f.pages, f.edits, f.applies],
                [[], [], [], [], []],
            );
        } finally {
            f.close();
        }
    }
    const f = fixture();
    try {
        f.list.query.set({
            inputs: [
                { id: 'locked', label: 'Locked', value: 'x', readOnly: true },
                { id: 'disabled', label: 'Disabled', value: 'x', disabled: true },
            ],
        });
        f.list.editQuery('locked', 'z');
        f.list.editQuery('disabled', 'z');
        assert.equal(f.edits.length, 0);
    } finally {
        f.close();
    }
});
test('malformed ports reject without coercion; query snapshots retain opaque values and repeated labels', () => {
    const snapshot = snapshotListQuery(query);
    assert.notEqual(snapshot.inputs, query.inputs);
    assert(Object.isFrozen(snapshot.inputs[1].choices[0]));
    for (const keys of [null, ['a', 'a'], [''], [1]])
        assert.throws(() => validateSelectedKeys(keys));
    for (const bad of [
        null,
        { ...page, offset: -1 },
        { ...page, pageSize: 0 },
        { ...page, total: 1.2 },
        { ...page, next: 1 },
        { ...page, offset: Number.MAX_SAFE_INTEGER + 1 },
    ])
        assert.throws(() => validateListPaging(bad));
    for (const bad of [
        null,
        { inputs: [query.inputs[0], query.inputs[0]] },
        { inputs: [{ ...query.inputs[0], value: null }] },
        { inputs: [{ ...query.inputs[1], value: 'missing' }] },
        {
            inputs: [
                {
                    ...query.inputs[1],
                    choices: [
                        { value: '', label: 'One' },
                        { value: '', label: 'Two' },
                    ],
                },
            ],
        },
    ])
        assert.throws(() => snapshotListQuery(bad));
});
