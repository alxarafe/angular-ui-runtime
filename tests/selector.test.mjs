import test from 'node:test';
import assert from 'node:assert/strict';
import { Injector, ElementRef, runInInjectionContext, signal } from '@angular/core';
import {
    ChoiceSelector,
    DetailGrid,
    ThemeService,
} from '../out-tsc/tests/projects/ui-runtime/src/public-api.js';
import { snapshotChoiceOptions } from '../out-tsc/tests/projects/ui-runtime/src/selector/choice-options.js';
const options = [
    { value: '', label: 'Same' },
    { value: 'opaque /?#\u0000é', label: 'Same' },
    { value: '9007199254740993', label: 'Exact' },
];
const page = { options, previous: false, next: true };
function fixture(documentInput) {
    const injector = Injector.create({ providers: [] });
    const control = runInInjectionContext(injector, () => new ChoiceSelector());
    const context = signal({
        id: 'selection',
        label: 'Selection',
        value: null,
        selector: page,
        ...(documentInput === undefined ? {} : { documentInput }),
    });
    Object.defineProperty(control, 'context', { value: context });
    return { injector, control, context };
}
test('selector snapshots are immutable and preserve opaque IDs and repeated labels', () => {
    const snapshot = snapshotChoiceOptions(page);
    assert.deepEqual(snapshot.options, options);
    assert.notEqual(snapshot.options, options);
    assert(Object.isFrozen(snapshot.options[0]));
    for (const bad of [
        null,
        { ...page, previous: 1 },
        { ...page, busy: 'yes' },
        { ...page, options: [{ value: 1, label: 'No' }] },
        { ...page, options: [options[0], options[0]] },
        { ...page, options: Array(1) },
    ])
        assert.throws(() => snapshotChoiceOptions(bad), /Invalid choice selector/);
});
test('selector refresh/busy/error/outside-page projections never change lossless inputs or emit edits', () => {
    for (const input of [
        { kind: 'absent' },
        { kind: 'value', value: null },
        { kind: 'value', value: '' },
        { kind: 'value', value: 'UNKNOWN' },
        { kind: 'value', value: false },
        { kind: 'raw', text: 'invalid\ud800' },
        { kind: 'raw', text: '' },
    ]) {
        const { injector, control, context } = fixture(input);
        try {
            const edits = [],
                legacy = [];
            control.editChange.subscribe((value) => edits.push(value));
            control.valueChange.subscribe((value) => legacy.push(value));
            for (const selector of [
                page,
                { ...page, options: [], current: { value: 'UNKNOWN', label: 'Outside' } },
                { ...page, busy: true },
                { ...page, error: 'Could not load' },
            ]) {
                context.update((value) => ({ ...value, selector }));
                assert.deepEqual(control.binding().documentInput, input);
                assert.equal(context().documentInput, input);
            }
            assert.deepEqual(edits, []);
            assert.deepEqual(legacy, []);
            control.edit({ kind: 'value', value: '9007199254740993' });
            assert.deepEqual(edits, [{ kind: 'value', value: '9007199254740993' }]);
            assert.deepEqual(legacy, []);
            for (const flag of ['disabled', 'readOnly']) {
                context.update((value) => ({ ...value, [flag]: true }));
                control.edit({ kind: 'absent' });
            }
            context.update((value) => ({
                ...value,
                disabled: false,
                readOnly: false,
                selector: { ...page, busy: true },
            }));
            control.edit({ kind: 'value', value: '' });
            assert.equal(edits.length, 1);
        } finally {
            injector.destroy();
        }
    }
});
test('legacy selector emits only scalars and explicitly rejects optional-control requests', () => {
    const { injector, control, context } = fixture();
    try {
        const edits = [],
            legacy = [];
        control.editChange.subscribe((value) => edits.push(value));
        control.valueChange.subscribe((value) => legacy.push(value));
        control.edit({ kind: 'value', value: '' });
        control.edit({ kind: 'value', value: null });
        control.edit({ kind: 'raw', text: 'opaque /?#' });
        control.edit({ kind: 'absent' });
        assert.deepEqual(legacy, ['', null, 'opaque /?#']);
        assert.deepEqual(edits, []);
        context.update((value) => ({
            ...value,
            control: { domain: { semantic: 'score', values: ['1'] } },
        }));
        assert.throws(() => control.binding(), /optional-control/);
        context.update((value) => ({ ...value, control: undefined, documentInput: null }));
        assert.throws(() => control.binding(), /Invalid selector editing input/);
    } finally {
        injector.destroy();
    }
});
test('grid paging uses keyed paths without changing document values or emitting cell edits', () => {
    const injector = Injector.create({
        providers: [
            { provide: ElementRef, useValue: { nativeElement: {} } },
            { provide: ThemeService, useValue: { current: () => ({ cssClass: 'default' }) } },
        ],
    });
    try {
        const grid = runInInjectionContext(injector, () => new DetailGrid());
        grid.context = signal({
            id: 'rows',
            path: [{ kind: 'property', name: 'rows' }],
            label: 'Rows',
            columns: [{ id: 'choice', field: 'choice', label: 'Choice', artifact: 'field.STRING' }],
            rows: [
                {
                    key: 'key /?#',
                    label: 'Row',
                    values: { choice: 'outside' },
                    contexts: {
                        choice: {
                            documentInput: { kind: 'value', value: 'outside' },
                            selector: page,
                        },
                    },
                },
            ],
            ordered: true,
            readOnly: false,
            allowAdd: false,
            allowRemove: false,
            allowReorder: true,
        });
        grid.readOnly = signal(false);
        const before = grid.context(),
            pages = [],
            edits = [];
        grid.gridPage.subscribe((intent) => pages.push(intent));
        grid.gridEdit.subscribe((intent) => edits.push(intent));
        grid.gridChange.subscribe((intent) => edits.push(intent));
        grid.page('key /?#', 'choice', 'next');
        assert.deepEqual(pages, [
            {
                collectionId: 'rows',
                collectionPath: before.path,
                key: 'key /?#',
                field: 'choice',
                path: [
                    ...before.path,
                    { kind: 'row', key: 'key /?#' },
                    { kind: 'property', name: 'choice' },
                ],
                direction: 'next',
            },
        ]);
        grid.page('key /?#', 'choice', 'previous');
        grid.readOnly.set(true);
        grid.page('key /?#', 'choice', 'next');
        grid.readOnly.set(false);
        grid.context.set({
            ...before,
            rows: before.rows.map((row) => ({
                ...row,
                contexts: { choice: { selector: { ...page, busy: true } } },
            })),
        });
        grid.page('key /?#', 'choice', 'next');
        assert.equal(pages.length, 1);
        assert.deepEqual(edits, []);
        assert.equal(before.rows[0].values.choice, 'outside');
        assert.throws(() => grid.page('missing', 'choice', 'next'), /Unknown grid cell/);
    } finally {
        injector.destroy();
    }
});
