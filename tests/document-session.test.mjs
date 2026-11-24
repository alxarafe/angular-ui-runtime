import test from 'node:test';
import assert from 'node:assert/strict';
import { DocumentSession } from '../out-tsc/tests/projects/ui-runtime/src/state/document-session.js';
import { createDocumentState } from '../out-tsc/tests/projects/ui-runtime/src/state/document-state.js';
const property = (name) => ({ kind: 'property', name });
const rowKey = (key) => ({ kind: 'row', key });
const path = (...names) => names.map(property);
const field = (value, equality = { type: 'exact' }) => ({
    kind: 'field',
    equality,
    input: { kind: 'value', value },
});
const object = (properties) => ({ kind: 'object', properties });
const collection = (rows) => ({
    kind: 'collection',
    ordered: true,
    allowAdd: true,
    allowRemove: true,
    allowReorder: true,
    rows,
});
const row = (key, value = '9007199254740993') => ({
    key,
    value: object({
        quantity: field(value, { type: 'INTEGER' }),
        nested: collection([
            {
                key: 'inside',
                value: object({
                    amount: field('12.34000000000000001', { type: 'DECIMAL', allowExponent: true }),
                }),
            },
        ]),
    }),
});
const model = () =>
    object({
        title: field('Accepted'),
        optional: { ...field(''), input: { kind: 'absent' } },
        nullable: field(null),
        flag: field(true),
        rows: collection([row('a'), row('b', '2')]),
    });
const def = (type, extra = {}) => ({
    kind: 'field',
    definition: { type, required: true, nullable: false, ...extra },
});
const plan = {
    kind: 'object',
    properties: {
        title: def('STRING'),
        optional: def('STRING', { required: false }),
        nullable: def('STRING', { nullable: true }),
        flag: def('BOOLEAN'),
        rows: {
            kind: 'collection',
            row: {
                kind: 'object',
                properties: {
                    quantity: def('INTEGER'),
                    nested: {
                        kind: 'collection',
                        row: {
                            kind: 'object',
                            properties: { amount: def('DECIMAL', { allowExponent: true }) },
                        },
                    },
                },
            },
        },
    },
};
const session = () => new DocumentSession(createDocumentState(model()));
const edit = (s, text = 'Draft') =>
    s.change({ kind: 'field', path: path('title'), input: { kind: 'value', value: text } });
const submit = (s, p = plan) => {
    const result = s.submit(p);
    assert.equal(result.kind, 'ready');
    return result.submission;
};
const frozen = (value) => {
    if (value && typeof value === 'object') {
        assert(Object.isFrozen(value));
        for (const item of Object.values(value)) frozen(item);
    }
};
const clone = (value) => structuredClone(value);

test('submission is immutable, exact, complete and tied to one session and local revision', () => {
    const s = session();
    edit(s);
    const before = s.state,
        attempt = submit(s);
    assert.equal(attempt.revision, before.revision);
    assert.equal(s.state, before);
    assert.equal(s.save.kind, 'saving');
    assert(s.locked);
    assert.notEqual(attempt.document, before.current);
    assert.deepEqual(attempt.document, before.current);
    assert.equal(
        attempt.document.properties.rows.rows[0].value.properties.quantity.input.value,
        '9007199254740993',
    );
    assert.equal(
        attempt.document.properties.rows.rows[0].value.properties.nested.rows[0].value.properties
            .amount.input.value,
        '12.34000000000000001',
    );
    assert.deepEqual(attempt.document.properties.optional.input, { kind: 'absent' });
    assert.equal(attempt.document.properties.nullable.input.value, null);
    frozen(attempt);
    frozen(s.save);
    assert.notEqual(submit(session()).id, attempt.id);
    assert.throws(() => new DocumentSession({ ...before }));
});

test('invalid values and definitions block without advancing revision or creating an active attempt', () => {
    const s = session();
    s.change({
        kind: 'field',
        path: [property('rows'), rowKey('a'), property('quantity')],
        input: { kind: 'raw', text: '1e-' },
    });
    const before = s.state;
    const result = s.submit(plan);
    assert.equal(result.kind, 'blocked');
    assert.equal(result.validation.state, 'invalid');
    assert.deepEqual(result.validation.issues[0].path, [
        property('rows'),
        rowKey('a'),
        property('quantity'),
    ]);
    assert.equal(s.state, before);
    assert.equal(s.locked, false);
    const malformed = clone(plan);
    malformed.properties.title.definition.constraints = { minimumLength: -1 };
    assert.equal(s.submit(malformed).validation.state, 'definition-error');
    assert.equal(s.save.kind, 'idle');
});

test('raw locally valid fields submit parsed slots without changing the retained draft', () => {
    const s = session();
    s.change({
        kind: 'field',
        path: path('title'),
        input: { kind: 'raw', text: 'Exact raw text' },
    });
    const attempt = submit(s);
    assert.deepEqual(attempt.document.properties.title.input, {
        kind: 'value',
        value: 'Exact raw text',
    });
    assert.deepEqual(s.state.current.properties.title.input, {
        kind: 'raw',
        text: 'Exact raw text',
    });
});

test('pending checks remain pending and need explicit authoritative confirmation', () => {
    const pending = clone(plan);
    pending.properties.title.definition.constraints = {
        pattern: { dialect: 'server', source: '^SERVER$' },
    };
    const s = session();
    edit(s);
    const attempt = submit(s, pending);
    pending.properties.title.definition.constraints.pattern.source = 'changed';
    assert.equal(attempt.validation.state, 'pending');
    assert.deepEqual(attempt.validation.checks, [
        { reason: 'server-pattern', path: path('title') },
    ]);
    s.resolve(attempt, { kind: 'accepted', document: attempt.document });
    assert.equal(s.save.kind, 'recovery');
    assert.equal(s.save.reason, 'unconfirmed-checks');
    assert(s.state.dirty);
    s.recover(attempt, attempt.document, true);
    assert.equal(s.save.kind, 'idle');
    assert.equal(s.state.dirty, false);
    assert.equal(attempt.validation.state, 'pending');
});

test('all edit operations and duplicate submission are locked until a definite rejection', () => {
    const s = session();
    edit(s);
    const attempt = submit(s),
        before = s.state;
    const changes = [
        { kind: 'field', path: path('title'), input: { kind: 'value', value: 'lost' } },
        { kind: 'add-row', path: path('rows'), row: row('c') },
        { kind: 'remove-row', path: path('rows'), key: 'a' },
        { kind: 'move-row', path: path('rows'), key: 'a', before: null },
    ];
    for (const change of changes) assert.throws(() => s.change(change));
    assert.throws(() => submit(s));
    assert.equal(s.state, before);
    assert.throws(() => s.recover(attempt, attempt.document));
    s.resolve(attempt, { kind: 'rejected', reason: 'transport' });
    assert(!s.locked);
    edit(s, 'Retry');
    assert.notEqual(submit(s).id, attempt.id);
});

for (const reason of ['validation', 'transport', 'conflict'])
    test(`${reason} rejection retains original, draft, exact paths, keys and revision`, () => {
        const s = session();
        edit(s);
        const attempt = submit(s),
            before = s.state;
        const issues = [
            { path: [property('rows'), rowKey('a')], code: 'adapter-code', message: 'Cannot save' },
            { path: [], code: 'root', message: 'Document rejected' },
        ];
        s.resolve(attempt, { kind: 'rejected', reason, issues });
        issues[0].path[1].key = 'outside';
        issues[0].message = 'outside';
        assert.equal(s.state, before);
        assert.equal(s.save.rejection.reason, reason);
        assert.equal(s.save.rejection.issues[0].path[1].key, 'a');
        frozen(s.save);
        assert.equal(s.resolve(attempt, { kind: 'accepted', document: attempt.document }), false);
        edit(s, 'Changed');
        assert.equal(s.save.rejection, undefined);
    });

test('reconciliation establishes detached snapshots, preserving nested and reordered UI keys', () => {
    const s = session();
    edit(s);
    s.change({ kind: 'add-row', path: path('rows'), row: row('new-ui') });
    s.change({ kind: 'remove-row', path: path('rows'), key: 'a' });
    s.change({ kind: 'move-row', path: path('rows'), key: 'new-ui', before: 'b' });
    const before = s.state,
        attempt = submit(s),
        accepted = clone(attempt.document);
    accepted.properties.title.input.value = 'Canonical title';
    // Server IDs may change as field values; row keys have already been mapped by the adapter.
    accepted.properties.rows.rows[0].value.properties.quantity.input.value = '18446744073709551615';
    s.resolve(attempt, { kind: 'accepted', document: accepted });
    accepted.properties.title.input.value = 'outside';
    assert.equal(s.state.revision, before.revision + 1);
    assert.equal(s.state.dirty, false);
    assert.equal(s.state.current.properties.title.input.value, 'Canonical title');
    assert.deepEqual(
        s.state.current.properties.rows.rows.map((row) => row.key),
        ['new-ui', 'b'],
    );
    assert.equal(
        s.state.current.properties.rows.rows[0].value.properties.nested.rows[0].key,
        'inside',
    );
    assert.notEqual(s.state.original, s.state.current);
    frozen(s.state);
    assert.equal(before.current.properties.title.input.value, 'Draft');
});

for (const corrupt of [
    () => ({ id: 'only-id', version: 'v2' }),
    (doc) => {
        delete doc.properties.title;
        return doc;
    },
    (doc) => {
        doc.properties.extra = field('unexpected');
        return doc;
    },
    (doc) => {
        doc.properties.rows.rows.pop();
        return doc;
    },
    (doc) => {
        doc.properties.rows.rows[0].key = 'new-server-id';
        return doc;
    },
    (doc) => {
        doc.properties.rows.rows[0].value.properties.nested.rows[0].key = 'unmapped';
        return doc;
    },
    (doc) => {
        doc.properties.title.input = { kind: 'raw', text: 'raw' };
        return doc;
    },
    (doc) => {
        doc.properties.rows.rows[0].value.properties.quantity.equality = { type: 'exact' };
        return doc;
    },
])
    test('malformed, partial or unmapped acceptance requires recovery without losing drafts', () => {
        const s = session();
        edit(s);
        const before = s.state,
            attempt = submit(s);
        s.resolve(attempt, { kind: 'accepted', document: corrupt(clone(attempt.document)) });
        assert.equal(s.save.kind, 'recovery');
        assert.equal(s.save.reason, 'invalid-acceptance');
        assert.equal(s.state, before);
        assert(s.locked);
        assert.throws(() => submit(s));
        assert.throws(() => edit(s));
        s.recover(attempt, attempt.document);
        assert(!s.locked);
        assert.equal(s.state.dirty, false);
    });

for (const kind of ['committed', 'uncertain'])
    test(`${kind} cannot retry, edit or unlock on a failed readback; authoritative recovery succeeds`, () => {
        const s = session();
        edit(s);
        const attempt = submit(s),
            before = s.state;
        s.resolve(attempt, { kind });
        assert.equal(s.save.kind, kind === 'committed' ? 'reconciling' : 'recovery');
        assert.throws(() => edit(s));
        assert.throws(() => submit(s));
        assert.equal(s.state, before);
        s.resolve(attempt, { kind: 'rejected', reason: 'transport' });
        assert.equal(s.save.kind, 'recovery');
        assert.equal(s.save.reason, 'reconciliation-failed');
        s.recover(attempt, { version: 2 });
        assert.equal(s.save.kind, 'recovery');
        assert.equal(s.state, before);
        s.recover(attempt, attempt.document);
        assert.equal(s.save.kind, 'idle');
        assert.equal(s.state.dirty, false);
    });

test('foreign, forged, previous and completed attempt responses are ignored before inspecting payloads', () => {
    const s = session(),
        other = session(),
        first = submit(s),
        foreign = submit(other);
    const before = s.state,
        saving = s.save;
    for (const token of [foreign, { ...first }]) {
        assert.equal(s.resolve(token, null), false);
        assert.equal(s.recover(token, null), false);
    }
    assert.equal(s.save, saving);
    assert.equal(s.state, before);
    s.resolve(first, { kind: 'rejected', reason: 'conflict' });
    edit(s);
    const next = submit(s);
    assert.equal(s.resolve(first, { kind: 'accepted', document: first.document }), false);
    s.resolve(next, { kind: 'accepted', document: next.document });
    const clean = s.state;
    assert.equal(s.resolve(next, { kind: 'uncertain' }), false);
    assert.equal(s.state, clean);
});

test('revision exhaustion blocks before dispatch and uncertainty never implies a completed save even on an unchanged document', () => {
    const exhausted = new DocumentSession(createDocumentState(model(), Number.MAX_SAFE_INTEGER));
    assert.throws(() => exhausted.submit(plan));
    assert(!exhausted.locked);
    const s = session(),
        attempt = submit(s);
    s.resolve(attempt, { kind: 'uncertain' });
    assert.equal(s.state.dirty, false);
    assert.equal(s.save.kind, 'recovery');
    assert(s.locked);
});

test('all eleven semantic scalar types keep exact lexical values through submission and acceptance', () => {
    const examples = [
        ['BOOLEAN', true],
        ['STRING', '  unchanged 😀  '],
        ['TEXT', 'line one\nline two'],
        ['INTEGER', '18446744073709551615'],
        ['DECIMAL', '12345678901234567890.123456700'],
        ['UUID', '550e8400-e29b-41d4-a716-446655440000'],
        ['DATE', '2026-11-24'],
        ['TIME', '12:34:56.1234567'],
        ['DATETIME', '2026-11-24T12:34:56.1234567+01:00'],
        ['ENUM', ''],
        ['BINARY', 'Zm9v'],
    ];
    const doc = object(Object.fromEntries(examples.map(([type, value]) => [type, field(value)])));
    const scalarPlan = {
        kind: 'object',
        properties: Object.fromEntries(
            examples.map(([type]) => [
                type,
                def(
                    type,
                    {
                        DECIMAL: { allowExponent: true },
                        UUID: { casing: 'lower' },
                        DATE: { format: 'gregorian-date' },
                        TIME: { format: 'local-time', fractionalDigits: 7 },
                        DATETIME: { format: 'offset-instant', fractionalDigits: 7 },
                        ENUM: { choices: [''] },
                        BINARY: { format: 'base64' },
                    }[type] ?? {},
                ),
            ]),
        ),
    };
    const s = new DocumentSession(createDocumentState(doc));
    const attempt = submit(s, scalarPlan);
    s.resolve(attempt, { kind: 'accepted', document: attempt.document });
    assert.equal(s.save.kind, 'idle');
    for (const [type, value] of examples) {
        assert.equal(attempt.document.properties[type].input.value, value);
        assert.equal(s.state.current.properties[type].input.value, value);
    }
});

test('adapter maps regenerated persistence IDs to submitted UI keys without index or data-value matching', () => {
    const doc = object({
        rows: collection(
            ['ui-a', 'ui-b'].map((key) => ({
                key,
                value: object({ id: field('old-' + key), text: field('same duplicate text') }),
            })),
        ),
    });
    const p = {
        kind: 'object',
        properties: {
            rows: {
                kind: 'collection',
                row: { kind: 'object', properties: { id: def('STRING'), text: def('STRING') } },
            },
        },
    };
    const s = new DocumentSession(createDocumentState(doc));
    s.change({ kind: 'move-row', path: path('rows'), key: 'ui-b', before: 'ui-a' });
    const attempt = submit(s, p);
    // The synthetic adapter receives returned rows in a different order and maps
    // its own correlation data before passing the complete authoritative tree.
    const response = [
        { ui: 'ui-a', id: 'generated-100' },
        { ui: 'ui-b', id: 'generated-200' },
    ];
    const byUI = new Map(response.map((row) => [row.ui, row.id]));
    const accepted = clone(attempt.document);
    for (const row of accepted.properties.rows.rows)
        row.value.properties.id.input.value = byUI.get(row.key);
    s.resolve(attempt, { kind: 'accepted', document: accepted });
    assert.deepEqual(
        s.state.current.properties.rows.rows.map((row) => [
            row.key,
            row.value.properties.id.input.value,
        ]),
        [
            ['ui-b', 'generated-200'],
            ['ui-a', 'generated-100'],
        ],
    );
    assert.equal(s.state.dirty, false);
});

test('malformed adapter feedback and unsupported outcomes cannot unlock or alter an active attempt', () => {
    const s = session();
    edit(s);
    const attempt = submit(s),
        before = s.state,
        saving = s.save;
    for (const issues of [
        new Array(1),
        [{ path: new Array(1), code: 'bad', message: 'bad' }],
        [{ path: ['title'], code: 'bad', message: 'bad' }],
    ]) {
        assert.throws(() => s.resolve(attempt, { kind: 'rejected', reason: 'validation', issues }));
        assert.equal(s.save, saving);
        assert.equal(s.state, before);
    }
    assert.throws(() => s.resolve(attempt, { kind: 'unknown' }));
    assert.equal(s.save, saving);
});
