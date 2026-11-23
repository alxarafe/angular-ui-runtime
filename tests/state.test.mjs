import test from 'node:test';
import assert from 'node:assert/strict';
// Import the core directly: these modules execute without Angular or its compiler.
import {
    createDocumentState,
    applyDocumentChange,
    resetDocumentState,
} from '../out-tsc/tests/projects/ui-runtime/src/state/document-state.js';
import { exactNumericEqual } from '../out-tsc/tests/projects/ui-runtime/src/state/exact-numeric.js';
const value = (value) => ({ kind: 'value', value });
const field = (v = '', equality = { type: 'exact' }, flags = {}) => ({
    kind: 'field',
    equality,
    input: value(v),
    ...flags,
});
const object = (properties, flags = {}) => ({ kind: 'object', properties, ...flags });
const row = (key, v = 'same') => ({
    key,
    value: object({ text: field(v), count: field('1', { type: 'INTEGER' }) }),
});
const collection = (rows = [row('a'), row('b')], ordered = true, flags = {}) => ({
    kind: 'collection',
    rows,
    ordered,
    allowAdd: true,
    allowRemove: true,
    allowReorder: true,
    ...flags,
});
const model = () =>
    object({
        title: field('Original'),
        optional: { ...field(), input: { kind: 'absent' } },
        nested: object({ flag: field(true) }),
        first: collection(),
        second: collection([row('x', 'Second')], false),
    });
const path = (...names) =>
    names.map((name) =>
        typeof name === 'string' ? { kind: 'property', name } : { kind: 'row', key: name.key },
    );
const edit = (state, names, input) =>
    applyDocumentChange(state, { kind: 'field', path: path(...names), input });
const op = (state, kind, data = {}, names = ['first']) =>
    applyDocumentChange(state, { kind, path: path(...names), ...data });
const scalar = (s, name) => s.current.properties[name].input;

test('accepted/current snapshots own all objects and arrays and are deeply immutable', () => {
    const source = model(),
        state = createDocumentState(source);
    source.properties.title.input.value = 'outside';
    source.properties.first.rows[0].value.properties.text.input.value = 'outside';
    source.properties.first.rows.push(row('c'));
    assert.equal(scalar(state, 'title').value, 'Original');
    assert.equal(state.current.properties.first.rows.length, 2);
    assert.notEqual(state.original, state.current);
    function frozen(node) {
        if (!node || typeof node !== 'object') return;
        assert(Object.isFrozen(node));
        for (const child of Object.values(node)) frozen(child);
    }
    frozen(state);
    assert.throws(() => {
        state.current.properties.title.input.value = 'bad';
    }, TypeError);
    const next = edit(state, ['title'], value('Draft'));
    assert.equal(scalar(state, 'title').value, 'Original');
    assert.equal(next.original.properties.title.input.value, 'Original');
    assert.equal(next.dirty, true);
    assert.equal(next.revision, 1);
    frozen(next);
});
for (const [semantics, pairs] of [
    [
        { type: 'INTEGER' },
        [
            ['+00018446744073709551615', '18446744073709551615'],
            ['-0', '+000'],
            ['-0012', '-12'],
        ],
    ],
    [
        { type: 'DECIMAL', allowExponent: true },
        [
            ['12.3400', '1234e-2'],
            ['9007199254740993.000000001', '9007199254740993000000001e-9'],
            ['-0e4096', '0.000'],
            ['1e4096', '10e4095'],
            ['0.00120', '12e-4'],
        ],
    ],
])
    test(`exact ${semantics.type} equivalence preserves lexemes and ignores no significant digits`, () => {
        for (const [a, b] of pairs) {
            assert.equal(exactNumericEqual(a, b, semantics), true);
            let s = createDocumentState(object({ n: field(a, semantics) }));
            s = edit(s, ['n'], value(b));
            assert.equal(s.dirty, false);
            assert.equal(scalar(s, 'n').value, b);
            s = edit(s, ['n'], value('9007199254740994.000000002'));
            assert.equal(s.dirty, true);
        }
        assert.equal(exactNumericEqual('9007199254740992', '9007199254740993', semantics), false);
    });
test('numeric syntax and work limits return indeterminate rather than validating or rounding', () => {
    const integer = { type: 'INTEGER' },
        decimal = { type: 'DECIMAL', allowExponent: true };
    for (const text of [
        '-',
        '1e-',
        '',
        ' 1',
        '1 ',
        '1\n',
        'NaN',
        'Infinity',
        '0x10',
        '.5',
        '1.',
        '1_000',
    ]) {
        assert.equal(exactNumericEqual(text, text, decimal), undefined);
    }
    for (const text of ['1.0', '1e0'])
        assert.equal(exactNumericEqual(text, '1', integer), undefined);
    assert.equal(
        exactNumericEqual('1e1', '10', { type: 'DECIMAL', allowExponent: false }),
        undefined,
    );
    for (const text of ['1'.repeat(4097), '1e4097', '1e-4097', '1e9999999999999999'])
        assert.equal(exactNumericEqual(text, '1', decimal), undefined);
    assert.equal(exactNumericEqual('1'.repeat(4096), '1'.repeat(4096), integer), true);
    assert.equal(exactNumericEqual('1e-4096', '0.1e-4095', decimal), true);
});
test('absence, null, empty, whitespace, booleans and raw drafts remain distinct; reversion cleans', () => {
    const original = createDocumentState(model());
    for (const input of [
        value(null),
        value(''),
        value(' '),
        value(false),
        value('false'),
        { kind: 'raw', text: '' },
    ]) {
        const s = edit(original, ['optional'], input);
        assert.equal(s.dirty, true);
        assert.deepEqual(scalar(s, 'optional'), input);
        assert.equal(edit(s, ['optional'], { kind: 'absent' }).dirty, false);
    }
    for (const input of [value('true'), value(false), { kind: 'raw', text: 'true' }])
        assert.equal(edit(original, ['nested', 'flag'], input).dirty, true);
    for (const text of ['Original ', ' Original', 'original'])
        assert.equal(edit(original, ['title'], value(text)).dirty, true);
    assert.equal(
        edit(edit(original, ['title'], value('Changed')), ['title'], value('Original')).dirty,
        false,
    );
    const numeric = createDocumentState(object({ n: field('1', { type: 'INTEGER' }) }));
    for (const text of ['-', '1e-', '1', '01'])
        assert.equal(edit(numeric, ['n'], { kind: 'raw', text }).dirty, true);
    const invalid = createDocumentState(object({ n: field('1e-', { type: 'INTEGER' }) }));
    assert.equal(invalid.dirty, false); // Structural admission never asserts semantic validity.
    assert.equal(edit(invalid, ['n'], value('-')).dirty, true);
    assert.equal('valid' in numeric, false);
});
test('temporal/text equality is lexical only, with no timezone or Unicode normalization', () => {
    for (const [a, b] of [
        ['2026-01-01T01:00:00+01:00', '2026-01-01T00:00:00Z'],
        ['12:00:00.1', '12:00:00.1000000'],
        ['é', 'e\u0301'],
    ]) {
        const s = createDocumentState(object({ n: field(a) }));
        assert.equal(edit(s, ['n'], value(b)).dirty, true);
    }
});
test('multiple and nested collections follow keys after deletion and reorder', () => {
    const source = model();
    source.properties.first.rows[0].value.properties.children = collection([row('child')]);
    let s = createDocumentState(source);
    s = edit(s, ['first', { key: 'a' }, 'children', { key: 'child' }, 'text'], value('Nested'));
    assert.equal(
        s.current.properties.first.rows[0].value.properties.children.rows[0].value.properties.text
            .input.value,
        'Nested',
    );
    s = op(s, 'remove-row', { key: 'a' });
    s = edit(s, ['first', { key: 'b' }, 'text'], value('Survivor'));
    s = edit(s, ['second', { key: 'x' }, 'text'], value('Independent'));
    s = op(s, 'add-row', { row: row('c', 'New') });
    s = op(s, 'move-row', { key: 'c', before: 'b' });
    assert.deepEqual(
        s.current.properties.first.rows.map((r) => r.key),
        ['c', 'b'],
    );
    assert.equal(s.current.properties.first.rows[1].value.properties.text.input.value, 'Survivor');
    assert.equal(
        s.current.properties.second.rows[0].value.properties.text.input.value,
        'Independent',
    );
    assert.equal(s.original.properties.second.rows[0].value.properties.text.input.value, 'Second');
});
test('ordered sequence uses effective contents, not keys; remove/restore and add/remove can clean', () => {
    const source = model();
    source.properties.first.rows = [row('a', 'A'), row('b', 'B')];
    const initial = createDocumentState(source);
    let s = op(initial, 'move-row', { key: 'b', before: 'a' });
    assert.equal(s.dirty, true);
    s = op(s, 'move-row', { key: 'b', before: null });
    assert.equal(s.dirty, false);
    s = op(s, 'add-row', { row: row('new') });
    assert.equal(s.dirty, true);
    s = op(s, 'remove-row', { key: 'new' });
    assert.equal(s.dirty, false);
    s = op(s, 'remove-row', { key: 'a' });
    s = op(s, 'add-row', { row: row('replacement', 'A') });
    assert.equal(s.dirty, true);
    s = op(s, 'move-row', { key: 'replacement', before: 'b' });
    assert.equal(s.dirty, false);
    const duplicates = createDocumentState(model());
    assert.equal(op(duplicates, 'move-row', { key: 'b', before: 'a' }).dirty, false);
});
function permutations(items) {
    if (!items.length) return [[]];
    return items.flatMap((item, i) =>
        permutations(items.filter((_, j) => j !== i)).map((tail) => [item, ...tail]),
    );
}
test('unordered duplicate rows compare as exact multisets across every permutation', () => {
    const rows = [row('a', 'A'), row('b', 'A'), row('c', 'B'), row('d', 'C')];
    for (const order of permutations(rows)) {
        let s = createDocumentState(object({ first: collection(rows, false) }));
        for (const r of rows) s = op(s, 'remove-row', { key: r.key });
        for (const [i, r] of order.entries())
            s = op(s, 'add-row', { row: { ...r, key: 'new-' + i } });
        assert.equal(s.dirty, false);
        s = edit(s, ['first', { key: 'new-0' }, 'text'], value('Different'));
        assert.equal(s.dirty, true);
    }
    let s = createDocumentState(object({ first: collection(rows, false) }));
    s = op(s, 'remove-row', { key: 'a' });
    s = op(s, 'add-row', { row: row('new', 'B') });
    assert.equal(s.dirty, true); // Same set, different multiplicity.
});
test('inserted rows are copied, including nested metadata and raw edits', () => {
    const prepared = row('new');
    prepared.value.properties.text.input = { kind: 'raw', text: '-' };
    const s = op(createDocumentState(model()), 'add-row', { row: prepared });
    prepared.value.properties.text.input.text = 'mutated';
    prepared.value.properties.count.equality.type = 'exact';
    assert.equal(s.current.properties.first.rows.at(-1).value.properties.text.input.text, '-');
    assert.equal(
        s.current.properties.first.rows.at(-1).value.properties.count.equality.type,
        'INTEGER',
    );
});
test('malformed and stale intents throw without changing any snapshot', () => {
    const s = createDocumentState(model()),
        before = JSON.stringify(s);
    const invalid = [
        { kind: 'wat', path: path('title') },
        { kind: 'field', path: [], input: value('x') },
        { kind: 'field', path: [{ kind: 'property', name: 'title', index: 0 }], input: value('x') },
        { kind: 'field', path: path('missing'), input: value('x') },
        { kind: 'field', path: path('first', { key: 'missing' }, 'text'), input: value('x') },
        { kind: 'field', path: path('first'), input: value('x') },
        { kind: 'field', path: path('title'), input: value(1) },
        { kind: 'field', path: path('title'), input: { kind: 'raw', text: 1 } },
        { kind: 'add-row', path: path('first') },
        { kind: 'add-row', path: path('first'), row: row('a') },
        { kind: 'add-row', path: path('first'), row: row('') },
        { kind: 'remove-row', path: path('first'), key: 'gone' },
        { kind: 'move-row', path: path('first'), key: 'a', before: 'gone' },
        { kind: 'move-row', path: path('first'), key: 'gone', before: null },
        { kind: 'move-row', path: path('second'), key: 'x', before: null },
        { kind: 'remove-row', path: path('title'), key: 'a' },
        { kind: 'field', path: path('__proto__'), input: value('x') },
        { kind: 'field', path: path('title'), input: value('x'), extra: true },
    ];
    for (const change of invalid) {
        assert.throws(() => applyDocumentChange(s, change));
        assert.equal(JSON.stringify(s), before);
    }
    const deleted = op(s, 'remove-row', { key: 'a' });
    assert.throws(() => edit(deleted, ['first', { key: 'a' }, 'text'], value('stale')));
});
test('effective field, ancestor and collection flags enforce edits and structural operations', () => {
    for (const flag of ['readOnly', 'disabled']) {
        for (const target of ['root', 'nested', 'field', 'collection', 'row']) {
            const source = model();
            const node = {
                root: source,
                nested: source.properties.nested,
                field: source.properties.title,
                collection: source.properties.first,
                row: source.properties.first.rows[0].value,
            }[target];
            node[flag] = true;
            const s = createDocumentState(source);
            const names =
                target === 'nested'
                    ? ['nested', 'flag']
                    : ['collection', 'row'].includes(target)
                      ? ['first', { key: 'a' }, 'text']
                      : ['title'];
            assert.throws(() => edit(s, names, value('blocked')));
            if (['root', 'collection'].includes(target))
                for (const [kind, data] of [
                    ['add-row', { row: row('c') }],
                    ['remove-row', { key: 'a' }],
                    ['move-row', { key: 'b', before: 'a' }],
                ])
                    assert.throws(() => op(s, kind, data));
        }
    }
    for (const [capability, kind, data] of [
        ['allowAdd', 'add-row', { row: row('c') }],
        ['allowRemove', 'remove-row', { key: 'a' }],
        ['allowReorder', 'move-row', { key: 'b', before: 'a' }],
    ]) {
        const source = model();
        source.properties.first[capability] = false;
        assert.throws(() => op(createDocumentState(source), kind, data));
    }
});
test('structural admission rejects malformed trees, cycles, raw accepted input and invalid capabilities', () => {
    const cycle = object({});
    cycle.properties.self = cycle;
    for (const source of [
        cycle,
        object({ n: field(1) }),
        object({ n: { ...field(), input: { kind: 'raw', text: '-' } } }),
        object({ n: field('', { type: 'DATE' }) }),
        object({ n: field('', { type: 'DECIMAL' }) }),
        object({ n: collection([row('a'), row('a')]) }),
        object({ n: collection([row('')]) }),
        object({ n: collection([, row('b')]) }),
        object({ n: collection([], true, { allowAdd: 'yes' }) }),
        object({ n: field('', { type: 'exact' }, { disabled: 1 }) }),
    ])
        assert.throws(() => createDocumentState(source));
});
test('row insertion preserves the whole-document nesting bound', () => {
    let node = collection([]);
    for (let i = 0; i < 127; i++) node = object({ child: node });
    const s = createDocumentState(node);
    const change = {
        kind: 'add-row',
        path: path(...Array(127).fill('child')),
        row: row('too-deep'),
    };
    assert.throws(() => applyDocumentChange(s, change));
    assert.equal(s.revision, 0);
    assert.equal(s.dirty, false);
});
test('safe revisions count successful intents including clean edits and reset, never wrap', () => {
    for (const counter of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN])
        assert.throws(() => createDocumentState(model(), counter));
    const initial = createDocumentState(model(), Number.MAX_SAFE_INTEGER - 1);
    const last = edit(initial, ['title'], value('Original'));
    assert.equal(last.revision, Number.MAX_SAFE_INTEGER);
    assert.equal(last.dirty, false);
    assert.throws(() => edit(last, ['title'], value('x')));
    assert.throws(() => resetDocumentState(last));
    assert.throws(() =>
        applyDocumentChange(
            { ...initial, revision: 0 },
            { kind: 'field', path: path('title'), input: value('x') },
        ),
    );
});
test('explicit reset restores the full accepted tree, keys and inputs, retaining previous snapshots', () => {
    const initial = createDocumentState(model());
    let s = edit(initial, ['title'], { kind: 'raw', text: '-' });
    s = op(s, 'remove-row', { key: 'a' });
    const restored = resetDocumentState(s);
    assert.deepEqual(restored.current, initial.original);
    assert.equal(restored.dirty, false);
    assert.equal(restored.revision, 3);
    assert.equal(s.dirty, true);
    assert.equal(s.current.properties.first.rows.length, 1);
    assert.equal(scalar(s, 'title').text, '-');
});
