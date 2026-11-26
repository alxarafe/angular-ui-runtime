import { ElementRef, Injector, runInInjectionContext, signal } from '@angular/core';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    DocumentSession,
    DetailGrid,
    ThemeService,
    createDocumentState,
    bindDocumentEditor,
    applyDocumentFieldIntent,
    applyDocumentCollectionIntent,
} from '../out-tsc/tests/projects/ui-runtime/src/public-api.js';
const prop = (name) => ({ kind: 'property', name });
const rowKey = (key) => ({ kind: 'row', key });
const path = (name) => [prop(name)];
const field = (input) => ({ kind: 'field', equality: { type: 'exact' }, input });
const string = { kind: 'field', definition: { type: 'STRING', required: false, nullable: true } };
const row = (key) => ({
    key,
    value: {
        kind: 'object',
        properties: {
            text: field({ kind: 'value', value: 'row' }),
            nested: {
                kind: 'collection',
                ordered: true,
                allowAdd: true,
                allowRemove: true,
                allowReorder: true,
                rows: [],
            },
        },
    },
});
function fixture(flags = {}) {
    const doc = {
        kind: 'object',
        ...flags,
        properties: {
            absent: field({ kind: 'absent' }),
            nullable: field({ kind: 'value', value: null }),
            empty: field({ kind: 'value', value: '' }),
            flag: field({ kind: 'value', value: true }),
            rows: {
                kind: 'collection',
                ordered: true,
                allowAdd: true,
                allowRemove: true,
                allowReorder: true,
                rows: [row('a'), row('b')],
            },
        },
    };
    const session = new DocumentSession(createDocumentState(doc));
    const plan = {
        kind: 'object',
        properties: {
            absent: string,
            nullable: string,
            empty: string,
            flag: {
                kind: 'field',
                definition: { type: 'BOOLEAN', required: true, nullable: false },
            },
            rows: {
                kind: 'collection',
                row: {
                    kind: 'object',
                    properties: {
                        text: string,
                        nested: { kind: 'collection', row: { kind: 'object', properties: {} } },
                    },
                },
            },
        },
    };
    const definition = {
        id: 'editor',
        label: 'Editor',
        fields: ['absent', 'nullable', 'empty', 'flag'].map((id) => ({
            id,
            path: path(id),
            artifact: id === 'flag' ? 'field.BOOLEAN' : 'field.STRING',
        })),
        collections: [{ id: 'rows', path: path('rows') }],
    };
    const options = {
        definition,
        plan,
        fields: Object.fromEntries(definition.fields.map((f) => [f.id, { id: f.id, label: f.id }])),
        collections: {
            rows: {
                label: 'Rows',
                columns: [{ id: 'text', field: 'text', label: 'Text', artifact: 'field.STRING' }],
            },
        },
    };
    return { session, options };
}
test('projection keeps absence/null/empty/boolean/raw distinct and never changes state', () => {
    const { session, options } = fixture();
    const before = session.state;
    let bound = bindDocumentEditor(session, options);
    assert.equal(bound.contexts.absent.documentInput.kind, 'absent');
    assert.equal(bound.contexts.nullable.value, null);
    assert.equal(bound.contexts.empty.value, '');
    assert.equal(bound.contexts.flag.value, true);
    assert.equal(session.state, before);
    applyDocumentFieldIntent(session, {
        id: 'absent',
        path: path('absent'),
        input: { kind: 'raw', text: '-' },
    });
    bound = bindDocumentEditor(session, options);
    assert.deepEqual(bound.contexts.absent.documentInput, { kind: 'raw', text: '-' });
    assert.equal(bound.contexts.absent.value, '-');
    applyDocumentFieldIntent(session, { id: 'empty', path: path('empty'), value: '' });
    assert.deepEqual(session.state.current.properties.empty.input, { kind: 'value', value: '' });
});
test('ENUM binding retains exact states and keyed cell choices without inferring defaults or edits', () => {
    const { session, options } = fixture();
    const choices = ['', 'OPEN', ' spaced ', 'e\u0301', 'é'];
    const enumPlan = {
        kind: 'field',
        definition: { type: 'ENUM', required: false, nullable: true, choices },
    };
    options.definition.fields.find((f) => f.id === 'empty').artifact = 'field.ENUM';
    options.plan.properties.empty = enumPlan;
    options.fields.empty.choices = choices;
    options.plan.properties.rows.row.properties.text = enumPlan;
    options.collections.rows.columns[0].artifact = 'field.ENUM';
    options.collections.rows.fields = { text: { choices, describedBy: ['row-help'] } };
    const cellPath = [...path('rows'), rowKey('b'), prop('text')];
    for (const input of [
        { kind: 'absent' },
        { kind: 'value', value: null },
        ...['', 'OPEN', ' spaced ', 'e\u0301', 'é', 'UNKNOWN', false].map((value) => ({
            kind: 'value',
            value,
        })),
        { kind: 'raw', text: 'malformed\ud800' },
        { kind: 'raw', text: '' },
        { kind: 'raw', text: 'OPEN' },
    ]) {
        applyDocumentFieldIntent(session, { id: 'empty', path: path('empty'), input });
        applyDocumentCollectionIntent(session, {
            collectionId: 'rows',
            collectionPath: path('rows'),
            key: 'b',
            field: 'text',
            path: cellPath,
            input,
        });
        const before = session.state;
        const bound = bindDocumentEditor(session, options);
        const cell = bound.collectionContexts.rows.rows.find((row) => row.key === 'b').contexts
            .text;
        assert.deepEqual(bound.contexts.empty.documentInput, input);
        assert.deepEqual(cell.documentInput, input);
        assert.deepEqual(cell.choices, choices);
        assert.deepEqual(cell.describedBy, ['row-help']);
        assert.equal(session.state, before);
        assert.deepEqual(
            session.state.current.properties.rows.rows.map((row) => row.key),
            ['a', 'b'],
        );
        assert.equal(
            cell.invalid,
            input.kind === 'raw'
                ? !choices.includes(input.text)
                : input.kind === 'value' && input.value !== null && !choices.includes(input.value),
        );
    }
});
test('keyed structural and nested cell intents reuse state; malformed/stale targets cannot edit', () => {
    const { session, options } = fixture();
    const collectionPath = path('rows');
    applyDocumentCollectionIntent(
        session,
        { kind: 'add-row', collectionId: 'rows', collectionPath },
        row('new'),
    );
    applyDocumentCollectionIntent(session, {
        kind: 'move-row',
        collectionId: 'rows',
        collectionPath,
        key: 'new',
        before: 'a',
    });
    applyDocumentCollectionIntent(session, {
        collectionId: 'rows',
        collectionPath,
        key: 'new',
        field: 'text',
        path: [...collectionPath, rowKey('new'), prop('text')],
        input: { kind: 'raw', text: 'exact' },
    });
    applyDocumentCollectionIntent(session, {
        kind: 'remove-row',
        collectionId: 'rows',
        collectionPath,
        key: 'b',
    });
    assert.deepEqual(
        bindDocumentEditor(session, options).collectionContexts.rows.rows.map((r) => r.key),
        ['new', 'a'],
    );
    const before = session.state;
    assert.throws(() =>
        applyDocumentCollectionIntent(session, {
            collectionId: 'rows',
            collectionPath,
            key: 'new',
            field: 'text',
            path: path('empty'),
            input: { kind: 'absent' },
        }),
    );
    assert.equal(session.state, before);
    assert.throws(() =>
        applyDocumentCollectionIntent(session, {
            kind: 'add-row',
            collectionId: 'rows',
            collectionPath,
        }),
    );
});
test('inherited flags, collection capabilities, locks and exact numeric invalid correction remain independent', () => {
    for (const flags of [{ readOnly: true }, { disabled: true }]) {
        const { session, options } = fixture(flags);
        const bound = bindDocumentEditor(session, options);
        assert(bound.contexts.empty.readOnly || bound.contexts.empty.disabled);
        assert(bound.collectionContexts.rows.readOnly || bound.collectionContexts.rows.disabled);
        assert.throws(() =>
            applyDocumentFieldIntent(session, {
                id: 'empty',
                path: path('empty'),
                input: { kind: 'raw', text: 'forbidden' },
            }),
        );
    }
    const { session, options } = fixture();
    const attempt = session.submit(options.plan).submission;
    assert(attempt);
    let bound = bindDocumentEditor(session, options);
    assert(bound.contexts.empty.disabled);
    assert(bound.collectionContexts.rows.readOnly);
    assert.throws(() =>
        applyDocumentFieldIntent(session, {
            id: 'empty',
            path: path('empty'),
            input: { kind: 'absent' },
        }),
    );
    session.resolve(attempt, {
        kind: 'rejected',
        reason: 'conflict',
        issues: [
            { path: [], code: 'root', message: 'Root feedback' },
            { path: [...path('rows'), rowKey('a')], code: 'row', message: 'Row feedback' },
        ],
    });
    bound = bindDocumentEditor(session, options);
    assert.equal(bound.validation.state, 'valid');
    assert(bound.feedback.some((f) => f.source === 'server' && f.path.length === 0));
    assert.match(bound.collectionContexts.rows.rows[0].message, /Row feedback/);
    applyDocumentFieldIntent(session, {
        id: 'flag',
        path: path('flag'),
        input: { kind: 'raw', text: 'not boolean' },
    });
    bound = bindDocumentEditor(session, options);
    assert.equal(bound.validation.state, 'invalid');
    assert(bound.contexts.flag.invalid);
    assert.equal(session.submit(options.plan).kind, 'blocked');
    assert.equal(session.state.current.properties.flag.input.text, 'not boolean');
    applyDocumentFieldIntent(session, {
        id: 'flag',
        path: path('flag'),
        input: { kind: 'value', value: false },
    });
    assert.equal(bindDocumentEditor(session, options).validation.state, 'valid');
});
test('feedback preserves local invalid and deferred evidence; accepted snapshots and discard refresh projections', async () => {
    const { session, options } = fixture();
    options.plan.properties.empty = {
        kind: 'field',
        definition: {
            type: 'STRING',
            required: true,
            nullable: false,
            constraints: { minimumLength: 1, pattern: { dialect: 'server', source: '^SERVER' } },
        },
    };
    let bound = bindDocumentEditor(session, options);
    assert.equal(bound.validation.state, 'invalid');
    assert(bound.feedback.some((f) => f.source === 'deferred'));
    assert(bound.feedback.some((f) => f.source === 'local'));
    applyDocumentFieldIntent(session, {
        id: 'empty',
        path: path('empty'),
        input: { kind: 'raw', text: 'ready' },
    });
    const attempt = session.submit(options.plan).submission;
    session.resolve(attempt, {
        kind: 'accepted',
        document: attempt.document,
        checksConfirmed: true,
    });
    assert.deepEqual(bindDocumentEditor(session, options).contexts.empty.documentInput, {
        kind: 'value',
        value: 'ready',
    });
    applyDocumentFieldIntent(session, {
        id: 'empty',
        path: path('empty'),
        input: { kind: 'absent' },
    });
    const before = session.state;
    await session.requestDiscard('discard', async () => false);
    assert.equal(session.state, before);
    await session.requestDiscard('discard', async () => true);
    assert.equal(bindDocumentEditor(session, options).contexts.empty.value, 'ready');
});

test('keyed reveal compares canonical typed paths; lossless cells emit one channel and honor locks', () => {
    const { session, options } = fixture();
    let focused = '';
    const document = { activeElement: null };
    const cell = {
        id: 'aur-cell-' + encodeURIComponent(JSON.stringify(['rows', 'a', 'text'])),
        ownerDocument: document,
        focus() {
            document.activeElement = this;
            focused = 'cell';
        },
    };
    const root = {
        querySelector() {
            return {
                ownerDocument: document,
                focus() {
                    document.activeElement = this;
                    focused = 'collection';
                },
            };
        },
        querySelectorAll() {
            return [cell];
        },
    };
    const injector = Injector.create({
        providers: [
            { provide: ElementRef, useValue: { nativeElement: root } },
            { provide: ThemeService, useValue: { current: () => ({ cssClass: 'default' }) } },
        ],
    });
    try {
        const grid = runInInjectionContext(injector, () => new DetailGrid());
        grid.context = signal(bindDocumentEditor(session, options).collectionContexts.rows);
        grid.readOnly = signal(false);
        assert(
            grid.revealPath([
                { name: 'rows', kind: 'property' },
                { key: 'a', kind: 'row' },
                { name: 'text', kind: 'property' },
            ]),
        );
        assert.equal(focused, 'cell');
        assert(grid.revealPath(path('rows')));
        assert.equal(focused, 'collection');
        assert.equal(grid.revealPath([]), false);
        assert.equal(grid.revealPath([...path('rows'), rowKey('missing')]), false);
        const edits = [],
            scalars = [];
        grid.gridEdit.subscribe((event) => edits.push(event));
        grid.gridChange.subscribe((event) => scalars.push(event));
        grid.editInput('a', 'text', { kind: 'raw', text: '-' });
        assert.equal(edits.length, 1);
        assert.equal(scalars.length, 0);
        assert(Object.isFrozen(edits[0].input));
        grid.readOnly.set(true);
        grid.editInput('a', 'text', { kind: 'absent' });
        assert.equal(edits.length, 1);
    } finally {
        injector.destroy();
    }
});

test('TEXT header and keyed cell retain exact multiline slots without projection edits', () => {
    const { session, options } = fixture();
    options.definition.fields.find((f) => f.id === 'empty').artifact = 'field.TEXT';
    options.collections.rows.columns[0].artifact = 'field.TEXT';
    const cellPath = [...path('rows'), rowKey('b'), prop('text')];
    for (const input of [
        { kind: 'absent' },
        { kind: 'value', value: null },
        { kind: 'value', value: '' },
        { kind: 'raw', text: '' },
        { kind: 'value', value: ' \r\n e\u0301 é 😀\r end ' },
        { kind: 'raw', text: ' \n e\u0301 é 😀\n end \n' },
    ]) {
        applyDocumentFieldIntent(session, { id: 'empty', path: path('empty'), input });
        applyDocumentCollectionIntent(session, {
            collectionId: 'rows',
            collectionPath: path('rows'),
            key: 'b',
            field: 'text',
            path: cellPath,
            input,
        });
        const before = session.state;
        const bound = bindDocumentEditor(session, options);
        assert.deepEqual(bound.contexts.empty.documentInput, input);
        assert.deepEqual(bound.collectionContexts.rows.rows[1].contexts.text.documentInput, input);
        assert.equal(session.state, before);
    }
});

test('DATE bindings retain exact header/keyed slots while the existing validator owns calendar and bounds', () => {
    const { session, options } = fixture();
    const date = {
        kind: 'field',
        definition: {
            type: 'DATE',
            required: false,
            nullable: true,
            format: 'gregorian-date',
            constraints: { minimum: { value: '2024-01-01' }, maximum: { value: '2025-12-31' } },
        },
    };
    options.definition.fields.find((f) => f.id === 'empty').artifact = 'field.DATE';
    options.plan.properties.empty = date;
    options.collections.rows.columns[0].artifact = 'field.DATE';
    options.plan.properties.rows.row.properties.text = date;
    const cellPath = [...path('rows'), rowKey('b'), prop('text')];
    const cases = [
        [{ kind: 'absent' }, false],
        [{ kind: 'value', value: null }, false],
        [{ kind: 'value', value: '' }, true],
        [{ kind: 'raw', text: '' }, true],
        [{ kind: 'value', value: false }, true],
        ...['2024-02-29', '2025-02-28'].flatMap((text) => [
            [{ kind: 'value', value: text }, false],
            [{ kind: 'raw', text }, false],
        ]),
        ...[
            '1900-02-29',
            '2025-02-29',
            '2024-02-',
            '2024-2-09',
            ' 2024-02-29 ',
            '2024-02-29\n',
            '２０２４-02-29',
            '0000-01-01',
            '10000-01-01',
            '2023-12-31',
            '2026-01-01',
        ].flatMap((text) => [
            [{ kind: 'value', value: text }, true],
            [{ kind: 'raw', text }, true],
        ]),
    ];
    for (const [input, invalid] of cases) {
        applyDocumentFieldIntent(session, { id: 'empty', path: path('empty'), input });
        applyDocumentCollectionIntent(session, {
            collectionId: 'rows',
            collectionPath: path('rows'),
            key: 'b',
            field: 'text',
            path: cellPath,
            input,
        });
        const before = session.state,
            bound = bindDocumentEditor(session, options);
        const header = bound.contexts.empty;
        const cell = bound.collectionContexts.rows.rows[1].contexts.text;
        for (const context of [header, cell]) {
            assert.deepEqual(context.documentInput, input);
            assert.equal(!!context.invalid, invalid);
        }
        assert.equal(session.state, before);
    }
});

test('DATE bounds follow header and keyed row plans on refresh without editing stored inputs', () => {
    const { session, options } = fixture();
    const headerPath = path('empty'),
        cellPath = [...path('rows'), rowKey('b'), prop('text')];
    const input = { kind: 'raw', text: '2024-02-28' };
    applyDocumentFieldIntent(session, { id: 'empty', path: headerPath, input });
    applyDocumentCollectionIntent(session, {
        collectionId: 'rows',
        collectionPath: path('rows'),
        key: 'b',
        field: 'text',
        path: cellPath,
        input,
    });
    const before = session.state;
    for (const [constraints, invalid] of [
        [undefined, false],
        [{ minimum: { value: '2024-02-29' } }, true],
        [{ maximum: { value: '2024-02-27' } }, true],
        [{ minimum: { value: '2024-02-28' }, maximum: { value: '2024-03-01' } }, false],
        [
            {
                minimum: { value: '2024-02-28', exclusive: true },
                maximum: { value: '2024-03-01', exclusive: true },
            },
            true,
        ],
        [undefined, false],
    ]) {
        const date = {
            kind: 'field',
            definition: {
                type: 'DATE',
                format: 'gregorian-date',
                required: false,
                nullable: true,
                constraints,
            },
        };
        options.plan.properties.empty = date;
        options.plan.properties.rows.row.properties.text = date;
        const bound = bindDocumentEditor(session, options);
        for (const context of [
            bound.contexts.empty,
            bound.collectionContexts.rows.rows[1].contexts.text,
        ]) {
            assert.deepEqual(context.dateConstraints, constraints);
            assert.deepEqual(context.documentInput, input);
            assert.equal(!!context.invalid, invalid);
        }
        assert.equal(session.state, before);
    }
});
