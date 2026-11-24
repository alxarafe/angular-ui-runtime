import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDocument } from '../out-tsc/tests/projects/ui-runtime/src/validation/validate-document.js';
import {
    createDocumentState,
    applyDocumentChange,
} from '../out-tsc/tests/projects/ui-runtime/src/state/document-state.js';

const property = (name) => ({ kind: 'property', name });
const planField = (definition) => ({ kind: 'field', definition });
const planObject = (properties) => ({ kind: 'object', properties });
const planCollection = (properties) => ({
    kind: 'collection',
    row: planObject(properties),
});
const docValue = (value, equality = { type: 'exact' }) => ({
    kind: 'field',
    equality,
    input: { kind: 'value', value },
});
const docAbsent = (equality = { type: 'exact' }) => ({
    kind: 'field',
    equality,
    input: { kind: 'absent' },
});
const docRaw = (text, equality = { type: 'exact' }) => ({
    kind: 'field',
    equality,
    input: { kind: 'raw', text },
});
const docObject = (properties) => ({ kind: 'object', properties });
const docRow = (key, properties) => ({ key, value: docObject(properties) });
const docCollection = (rows, options = {}) => ({
    kind: 'collection',
    ordered: true,
    allowAdd: true,
    allowRemove: true,
    allowReorder: true,
    rows,
    ...options,
});
const integer = { type: 'INTEGER', required: true, nullable: false };
const text = { type: 'STRING', required: true, nullable: false };
const serverText = {
    type: 'STRING',
    required: true,
    nullable: false,
    constraints: { pattern: { dialect: 'server', source: '^SERVER_[A-Z]+$' } },
};
const localText = {
    type: 'STRING',
    required: true,
    nullable: false,
    constraints: { pattern: { dialect: 'portable-ascii-v1', source: '^[A-Z][A-Z0-9_]{0,29}$' } },
};
const fieldStates = (result) => result.fields.map((entry) => entry.result.state);
const issuePaths = (result) => result.issues.map((issue) => issue.path);

function validate(document, plan) {
    return validateDocument({ document, plan });
}
function deepFreezeExpectations(value, seen = new Set()) {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    assert.equal(Object.isFrozen(value), true);
    for (const key of Object.keys(value)) deepFreezeExpectations(value[key], seen);
}

test('empty document with empty matching plan is valid without invented field results', () => {
    const result = validate(docObject({}), planObject({}));
    assert.equal(result.state, 'valid');
    assert.deepEqual(result.fields, []);
    assert.deepEqual(result.issues, []);
    assert.deepEqual(result.diagnostics, []);
    assert.deepEqual(result.patternDiagnostics, []);
    assert.deepEqual(result.checks, []);
});

test('one and multiple valid fields produce deterministic sorted field order', () => {
    const single = validate(
        docObject({ quantity: docValue('1') }),
        planObject({ quantity: planField(integer) }),
    );
    assert.equal(single.state, 'valid');
    assert.deepEqual(
        single.fields.map((entry) => entry.path),
        [[property('quantity')]],
    );

    const result = validate(
        docObject({ b: docValue('2'), a: docValue('1') }),
        planObject({ a: planField(integer), b: planField(integer) }),
    );
    assert.equal(result.state, 'valid');
    assert.deepEqual(
        result.fields.map((entry) => entry.path),
        [[property('a')], [property('b')]],
    );
});

test('one and multiple independent invalid fields retain every local issue', () => {
    const one = validate(
        docObject({ quantity: docRaw('1e-') }),
        planObject({ quantity: planField(integer) }),
    );
    assert.equal(one.state, 'invalid');
    assert.deepEqual(issuePaths(one), [[property('quantity')]]);
    assert.equal(one.fields[0].result.state, 'invalid');
    assert.equal('parsed' in one.fields[0].result, false);

    const two = validate(
        docObject({ first: docRaw('x'), second: docAbsent() }),
        planObject({ first: planField(integer), second: planField(integer) }),
    );
    assert.equal(two.state, 'invalid');
    assert.deepEqual(
        two.issues.map((issue) => issue.code),
        ['integer-syntax', 'required'],
    );
    assert.deepEqual(issuePaths(two), [[property('first')], [property('second')]]);
});

test('pending fields preserve deferred server checks and nonfatal diagnostics', () => {
    const result = validate(
        docObject({ code: docValue('SERVER_ONE') }),
        planObject({ code: planField(serverText) }),
    );
    assert.equal(result.state, 'pending');
    assert.deepEqual(fieldStates(result), ['pending']);
    assert.equal(result.checks.length, 1);
    assert.deepEqual(result.checks[0].path, [property('code')]);
    assert.equal(result.checks[0].reason, 'server-pattern');
    assert.equal(result.patternDiagnostics.length, 1);
    assert.equal(result.patternDiagnostics[0].code, 'pattern-server-only');
});

test('invalid precedence retains a sibling pending check and its diagnostic', () => {
    const result = validate(
        docObject({ amount: docRaw('1e-'), code: docValue('SERVER_ONE') }),
        planObject({ amount: planField(integer), code: planField(serverText) }),
    );
    assert.equal(result.state, 'invalid');
    assert.deepEqual(issuePaths(result), [[property('amount')]]);
    assert.equal(result.checks.length, 1);
    assert.deepEqual(result.checks[0].path, [property('code')]);
    assert.equal(result.patternDiagnostics.length, 1);
});

test('fatal definition errors take precedence without discarding sibling evidence', () => {
    const malformed = {
        type: 'INTEGER',
        required: true,
        nullable: false,
        capacity: { bits: 7, signed: true },
    };
    const result = validate(
        docObject({
            broken: docValue('1'),
            invalid: docRaw('1e-'),
            code: docValue('SERVER_ONE'),
        }),
        planObject({
            broken: planField(malformed),
            invalid: planField(integer),
            code: planField(serverText),
        }),
    );
    assert.equal(result.state, 'definition-error');
    assert.equal(result.diagnostics[0].source, 'definition');
    assert.equal(result.diagnostics[0].code, 'capacity');
    assert.deepEqual(issuePaths(result), [[property('invalid')]]);
    assert.equal(result.checks.length, 1);
    assert.deepEqual(result.checks[0].path, [property('code')]);
    assert.deepEqual(fieldStates(result), ['definition-error', 'pending', 'invalid']);
});

test('nested objects validate with exact typed paths', () => {
    const document = docObject({
        customer: docObject({
            code: docValue('C1'),
            address: docObject({ postcode: docRaw('') }),
        }),
    });
    const plan = planObject({
        customer: planObject({
            code: planField(text),
            address: planObject({ postcode: planField(integer) }),
        }),
    });
    const result = validate(document, plan);
    assert.equal(result.state, 'invalid');
    assert.deepEqual(
        result.fields.map((entry) => entry.path),
        [
            [property('customer'), property('address'), property('postcode')],
            [property('customer'), property('code')],
        ],
    );
    assert.deepEqual(issuePaths(result), [
        [property('customer'), property('address'), property('postcode')],
    ]);
});

test('zero one and multiple rows, different schemas and nested collections', () => {
    const empty = validate(
        docObject({ lines: docCollection([]) }),
        planObject({ lines: planCollection({ quantity: planField(integer) }) }),
    );
    assert.equal(empty.state, 'valid');
    assert.deepEqual(empty.fields, []);

    const plan = planObject({
        first: planCollection({ quantity: planField(integer) }),
        second: planCollection({ label: planField(text) }),
    });
    const document = docObject({
        first: docCollection([
            docRow('a', { quantity: docValue('1') }),
            docRow('b', { quantity: docValue('2') }),
        ]),
        second: docCollection([docRow('x', { label: docValue('hello') })]),
    });
    const result = validate(document, plan);
    assert.equal(result.state, 'valid');
    assert.deepEqual(
        result.fields.map((entry) => entry.path),
        [
            [property('first'), { kind: 'row', key: 'a' }, property('quantity')],
            [property('first'), { kind: 'row', key: 'b' }, property('quantity')],
            [property('second'), { kind: 'row', key: 'x' }, property('label')],
        ],
    );

    const nested = validate(
        docObject({
            lines: docCollection([
                docRow('l1', {
                    quantity: docValue('1'),
                    notes: docCollection([docRow('n1', { text: docRaw('bad') })]),
                }),
            ]),
        }),
        planObject({
            lines: planCollection({
                quantity: planField(integer),
                notes: planCollection({ text: planField(integer) }),
            }),
        }),
    );
    assert.equal(nested.state, 'invalid');
    assert.deepEqual(issuePaths(nested), [
        [
            property('lines'),
            { kind: 'row', key: 'l1' },
            property('notes'),
            { kind: 'row', key: 'n1' },
            property('text'),
        ],
    ]);
});

test('reordering rows changes traversal order without changing keyed paths', () => {
    const document = docObject({
        lines: docCollection([
            docRow('a', { quantity: docValue('1') }),
            docRow('b', { quantity: docValue('2') }),
        ]),
    });
    const plan = planObject({ lines: planCollection({ quantity: planField(integer) }) });
    const before = validate(document, plan);
    const reordered = validate(
        docObject({
            lines: docCollection([
                docRow('b', { quantity: docValue('2') }),
                docRow('a', { quantity: docValue('1') }),
            ]),
        }),
        plan,
    );
    assert.deepEqual(
        before.fields.map((entry) => entry.path[1].key),
        ['a', 'b'],
    );
    assert.deepEqual(
        reordered.fields.map((entry) => entry.path[1].key),
        ['b', 'a'],
    );
    assert.deepEqual(
        new Set(before.fields.map((entry) => JSON.stringify(entry.path))),
        new Set(reordered.fields.map((entry) => JSON.stringify(entry.path))),
    );
});

test('adding and removing rows evaluates only the supplied current snapshot', () => {
    let state = createDocumentState(
        docObject({ lines: docCollection([docRow('a', { quantity: docValue('1') })]) }),
    );
    const plan = planObject({ lines: planCollection({ quantity: planField(integer) }) });
    const initial = validate(state.current, plan);
    assert.equal(initial.fields.length, 1);

    state = applyDocumentChange(state, {
        kind: 'add-row',
        path: [property('lines')],
        row: docRow('b', { quantity: docRaw('1e-') }),
    });
    const added = validate(state.current, plan);
    assert.equal(added.state, 'invalid');
    assert.deepEqual(issuePaths(added), [
        [property('lines'), { kind: 'row', key: 'b' }, property('quantity')],
    ]);

    state = applyDocumentChange(state, {
        kind: 'remove-row',
        path: [property('lines')],
        key: 'b',
    });
    const removed = validate(state.current, plan);
    assert.equal(removed.state, 'valid');
    assert.deepEqual(removed.issues, []);
    assert.deepEqual(removed.checks, []);
    assert.deepEqual(
        removed.fields.map((entry) => entry.path),
        [[property('lines'), { kind: 'row', key: 'a' }, property('quantity')]],
    );
});

test('duplicate values in different rows remain independent and a failing row does not hide others', () => {
    const plan = planObject({ lines: planCollection({ quantity: planField(integer) }) });
    const duplicate = validate(
        docObject({
            lines: docCollection([
                docRow('a', { quantity: docValue('7') }),
                docRow('b', { quantity: docValue('7') }),
            ]),
        }),
        plan,
    );
    assert.equal(duplicate.state, 'valid');
    assert.equal(duplicate.fields.length, 2);
    assert.notEqual(duplicate.fields[0].path, duplicate.fields[1].path);

    const mixed = validate(
        docObject({
            lines: docCollection([
                docRow('a', { quantity: docRaw('1e-') }),
                docRow('b', { quantity: docValue('2') }),
                docRow('c', { quantity: docRaw('x') }),
            ]),
        }),
        plan,
    );
    assert.equal(mixed.state, 'invalid');
    assert.deepEqual(issuePaths(mixed), [
        [property('lines'), { kind: 'row', key: 'a' }, property('quantity')],
        [property('lines'), { kind: 'row', key: 'c' }, property('quantity')],
    ]);
});

test('a pending row check survives while a different row is invalid', () => {
    const result = validate(
        docObject({
            lines: docCollection([
                docRow('a', { quantity: docRaw('1e-'), code: docValue('SERVER_ONE') }),
                docRow('b', { quantity: docValue('2'), code: docValue('SERVER_TWO') }),
            ]),
        }),
        planObject({
            lines: planCollection({
                quantity: planField(integer),
                code: planField(serverText),
            }),
        }),
    );
    assert.equal(result.state, 'invalid');
    assert.deepEqual(issuePaths(result), [
        [property('lines'), { kind: 'row', key: 'a' }, property('quantity')],
    ]);
    assert.equal(result.checks.length, 2);
    assert.deepEqual(
        result.checks.map((check) => check.path),
        [
            [property('lines'), { kind: 'row', key: 'a' }, property('code')],
            [property('lines'), { kind: 'row', key: 'b' }, property('code')],
        ],
    );
});

test('nested row and collection failures keep complete keyed paths', () => {
    const result = validate(
        docObject({
            lines: docCollection([
                docRow('stable-line', {
                    quantity: docRaw('1e-'),
                    notes: docCollection([docRow('stable-note', { code: docRaw('') })]),
                }),
            ]),
        }),
        planObject({
            lines: planCollection({
                quantity: planField(integer),
                notes: planCollection({ code: planField(integer) }),
            }),
        }),
    );
    assert.equal(result.state, 'invalid');
    assert.deepEqual(issuePaths(result), [
        [
            property('lines'),
            { kind: 'row', key: 'stable-line' },
            property('notes'),
            { kind: 'row', key: 'stable-note' },
            property('code'),
        ],
        [property('lines'), { kind: 'row', key: 'stable-line' }, property('quantity')],
    ]);
});

test('all eleven semantic types pass through document aggregation unchanged', () => {
    const definitions = {
        amount: { type: 'DECIMAL', required: true, nullable: false, allowExponent: true },
        binary: { type: 'BINARY', required: true, nullable: false, format: 'base64' },
        choice: { type: 'ENUM', required: true, nullable: false, choices: ['', 'OPEN'] },
        clock: {
            type: 'TIME',
            required: true,
            nullable: false,
            format: 'local-time',
            fractionalDigits: 7,
        },
        date: { type: 'DATE', required: true, nullable: false, format: 'gregorian-date' },
        flag: { type: 'BOOLEAN', required: true, nullable: false },
        instant: {
            type: 'DATETIME',
            required: true,
            nullable: false,
            format: 'offset-instant',
            fractionalDigits: 7,
        },
        notes: { type: 'TEXT', required: true, nullable: false },
        quantity: integer,
        title: localText,
        uuid: { type: 'UUID', required: true, nullable: false, casing: 'either' },
    };
    const values = {
        amount: '-12.3400',
        binary: 'Zg==',
        choice: '',
        clock: '12:30:00.1234567',
        date: '2024-02-29',
        flag: true,
        instant: '2026-11-23T18:00:00.1234567+01:00',
        notes: 'hello',
        quantity: '9007199254740993',
        title: 'ABC_1',
        uuid: '123e4567-e89b-12d3-a456-426614174000',
    };
    const result = validate(
        docObject(
            Object.fromEntries(Object.entries(values).map(([id, value]) => [id, docValue(value)])),
        ),
        planObject(
            Object.fromEntries(
                Object.entries(definitions).map(([id, definition]) => [id, planField(definition)]),
            ),
        ),
    );
    assert.equal(result.state, 'valid');
    assert.equal(result.fields.length, 11);
    assert.deepEqual(fieldStates(result), Array(11).fill('valid'));
    const parsed = Object.fromEntries(
        result.fields.map((entry) => [entry.path[0].name, entry.result.parsed]),
    );
    assert.deepEqual(parsed.quantity, { kind: 'value', value: '9007199254740993' });
    assert.deepEqual(parsed.amount, { kind: 'value', value: '-12.3400' });
    assert.deepEqual(parsed.choice, { kind: 'value', value: '' });
    assert.deepEqual(parsed.flag, { kind: 'value', value: true });
});

test('invalid raw drafts and server-only patterns retain their independent semantics', () => {
    const result = validate(
        docObject({ quantity: docRaw('1e-'), code: docValue('SERVER_ONE') }),
        planObject({ quantity: planField(integer), code: planField(serverText) }),
    );
    assert.equal(result.state, 'invalid');
    assert.equal(result.fields[0].result.state, 'pending');
    assert.equal(result.fields[1].result.state, 'invalid');
    assert.equal('parsed' in result.fields[1].result, false);
    assert.equal(result.checks.length, 1);
});

test('missing document definitions are fatal structural diagnostics', () => {
    const result = validate(docObject({ ghost: docValue('1') }), planObject({}));
    assert.equal(result.state, 'definition-error');
    assert.equal(result.diagnostics.length, 1);
    assert.equal(result.diagnostics[0].code, 'missing-definition');
    assert.deepEqual(result.diagnostics[0].path, [property('ghost')]);
    assert.deepEqual(result.fields, []);
});

test('definitions for nonexistent nodes are fatal structural diagnostics', () => {
    const result = validate(docObject({}), planObject({ ghost: planField(integer) }));
    assert.equal(result.state, 'definition-error');
    assert.equal(result.diagnostics[0].code, 'unknown-definition');
    assert.deepEqual(result.diagnostics[0].path, [property('ghost')]);
});

test('field object and collection kind mismatches fail closed', () => {
    const result = validate(
        docObject({ node: docValue('1') }),
        planObject({ node: planObject({}) }),
    );
    assert.equal(result.state, 'definition-error');
    assert.equal(result.diagnostics[0].code, 'kind-mismatch');
});

test('malformed field definitions keep their existing definition-error meaning', () => {
    const result = validate(
        docObject({ quantity: docValue('1'), other: docValue('2') }),
        planObject({
            quantity: planField({
                type: 'INTEGER',
                required: true,
                nullable: false,
                capacity: { bits: 7, signed: true },
            }),
            other: planField(integer),
        }),
    );
    assert.equal(result.state, 'definition-error');
    assert.equal(result.fields[0].result.state, 'valid');
    assert.equal(result.fields[1].result.state, 'definition-error');
    assert.equal(result.fields[1].result.diagnostics[0].code, 'capacity');
    assert.deepEqual(result.issues, []);
});

test('malformed collection row schemas, unsupported members and node kinds are rejected', () => {
    const schema = validate(
        docObject({ lines: docCollection([]) }),
        planObject({ lines: { kind: 'collection', row: planField(integer) } }),
    );
    assert.equal(schema.diagnostics[0].code, 'malformed-row-schema');

    const extra = validate(
        docObject({ quantity: docValue('1') }),
        planObject({ quantity: { kind: 'field', definition: integer, extra: true } }),
    );
    assert.equal(extra.diagnostics[0].code, 'malformed-plan');

    const kind = validate(
        docObject({ quantity: docValue('1') }),
        planObject({ quantity: { kind: 'root', definition: integer } }),
    );
    assert.equal(kind.diagnostics[0].code, 'malformed-plan');
});

test('cyclic validation plans are detected without recursion overflow', () => {
    const document = { kind: 'object', properties: {} };
    document.properties.self = document;
    const plan = { kind: 'object', properties: {} };
    plan.properties.self = plan;
    const result = validate(document, plan);
    assert.equal(result.state, 'definition-error');
    assert.equal(result.diagnostics[0].code, 'plan-cycle');
});

test('excessive nesting respects the STATE structural depth limit', () => {
    const leafDocument = () => docObject({ value: docValue('1') });
    const leafPlan = () => planObject({ value: planField(integer) });
    let document = leafDocument();
    let plan = leafPlan();
    for (let index = 0; index < 130; index += 1) {
        document = docObject({ next: document });
        plan = planObject({ next: plan });
    }
    const result = validate(document, plan);
    assert.equal(result.state, 'definition-error');
    assert.equal(result.diagnostics[0].code, 'depth-limit');
});

test('malformed requests and malformed root documents fail closed', () => {
    const extra = validateDocument({ document: docObject({}), plan: planObject({}), other: true });
    assert.equal(extra.state, 'definition-error');
    assert.equal(extra.diagnostics[0].code, 'invalid-request');

    const malformed = validateDocument({ document: { kind: 'object' }, plan: planObject({}) });
    assert.equal(malformed.state, 'definition-error');
    assert.equal(malformed.diagnostics[0].code, 'invalid-document');
});

test('results, paths, issues, diagnostics and checks are deeply frozen', () => {
    const result = validate(
        docObject({ quantity: docRaw('1e-'), code: docValue('SERVER_ONE') }),
        planObject({ quantity: planField(integer), code: planField(serverText) }),
    );
    deepFreezeExpectations(result);
    assert.notEqual(result.fields[0].path, result.fields[1].path);
});

test('caller-owned definitions and plan objects are neither mutated nor frozen', () => {
    const definition = { ...integer };
    const plan = planObject({ quantity: planField(definition) });
    const document = docObject({ quantity: docValue('1') });
    assert.equal(Object.isFrozen(definition), false);
    assert.equal(Object.isFrozen(plan), false);
    validate(document, plan);
    assert.equal(Object.isFrozen(definition), false);
    assert.equal(Object.isFrozen(plan), false);
    assert.deepEqual(definition, integer);
});

test('human-readable diagnostics do not leak field values or pattern sources', () => {
    const secret = {
        type: 'STRING',
        required: true,
        nullable: false,
        constraints: { pattern: { dialect: 'portable-ascii-v1', source: '^PRIVATE[A-Z]+$' } },
    };
    const result = validate(
        docObject({ code: docRaw('SECRET-VALUE'), broken: docValue('1') }),
        planObject({
            code: planField(secret),
            broken: planField({
                type: 'INTEGER',
                required: true,
                nullable: false,
                capacity: { bits: 7, signed: true },
            }),
        }),
    );
    const messages = [
        ...result.issues.map((issue) => issue.message),
        ...result.diagnostics.map((diagnostic) => diagnostic.message),
        ...result.patternDiagnostics.map((diagnostic) => diagnostic.message),
    ].join(' ');
    assert.equal(messages.includes('SECRET-VALUE'), false);
    assert.equal(messages.includes('PRIVATE'), false);
});

test('document validation never mutates STATE, revision, dirty state or row identity', () => {
    const initial = createDocumentState(
        docObject({ lines: docCollection([docRow('a', { quantity: docValue('1') })]) }),
    );
    const plan = planObject({ lines: planCollection({ quantity: planField(integer) }) });
    const original = initial.original;
    const current = initial.current;
    const rows = current.properties.lines.rows;
    const result = validate(current, plan);
    assert.equal(result.state, 'valid');
    assert.equal(initial.revision, 0);
    assert.equal(initial.dirty, false);
    assert.equal(initial.original, original);
    assert.equal(initial.current, current);
    assert.equal(initial.current.properties.lines.rows, rows);
});

test('removing a row removes its pending checks from the next explicit evaluation', () => {
    let state = createDocumentState(
        docObject({
            lines: docCollection([
                docRow('a', { code: docValue('SERVER_ONE') }),
                docRow('b', { code: docValue('SERVER_TWO') }),
            ]),
        }),
    );
    const plan = planObject({ lines: planCollection({ code: planField(serverText) }) });
    const before = validate(state.current, plan);
    assert.equal(before.state, 'pending');
    assert.equal(before.checks.length, 2);
    state = applyDocumentChange(state, {
        kind: 'remove-row',
        path: [property('lines')],
        key: 'a',
    });
    const after = validate(state.current, plan);
    assert.equal(after.state, 'pending');
    assert.equal(after.checks.length, 1);
    assert.deepEqual(after.checks[0].path, [
        property('lines'),
        { kind: 'row', key: 'b' },
        property('code'),
    ]);
});
