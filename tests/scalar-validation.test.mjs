import test from 'node:test';
import assert from 'node:assert/strict';
import { validateField } from '../out-tsc/tests/projects/ui-runtime/src/validation/validate-field.js';
import {
    createDocumentState,
    applyDocumentChange,
} from '../out-tsc/tests/projects/ui-runtime/src/state/document-state.js';
const path = [
    { kind: 'property', name: 'details' },
    { kind: 'row', key: 'private-row-key' },
    { kind: 'property', name: 'content' },
];
const slot = (value) => ({ kind: 'value', value });
const definition = (type, extra = {}) => ({
    type,
    required: true,
    nullable: false,
    ...(type === 'ENUM'
        ? { choices: ['', 'OPEN', 'CLOSED'] }
        : type === 'BINARY'
          ? { format: 'base64' }
          : {}),
    ...extra,
});
const check = (type, input, extra) =>
    validateField({ definition: definition(type, extra), input, path });
function valid(type, value, extra) {
    assert.deepEqual(check(type, slot(value), extra), { state: 'valid', parsed: slot(value) });
}
function invalid(type, input, expected, extra) {
    const result = check(type, input, extra);
    assert.equal(result.state, 'invalid');
    assert.deepEqual(
        result.issues.map((issue) => issue.code),
        expected,
    );
    for (const issue of result.issues) {
        assert.equal(issue.source, 'local');
        assert.deepEqual(issue.path, path);
        assert(!issue.message.includes('private-row-key'));
        assert(!issue.message.includes('details'));
    }
    assert.equal('parsed' in result, false);
}
const types = ['STRING', 'TEXT', 'BOOLEAN', 'ENUM', 'BINARY'];
for (const type of types)
    for (const required of [false, true])
        for (const nullable of [false, true])
            test(`${type}: independent presence required=${required}, nullable=${nullable}`, () => {
                const flags = { required, nullable };
                if (required) invalid(type, { kind: 'absent' }, ['required'], flags);
                else
                    assert.deepEqual(check(type, { kind: 'absent' }, flags).parsed, {
                        kind: 'absent',
                    });
                if (!nullable) invalid(type, slot(null), ['null-not-allowed'], flags);
                else valid(type, null, flags);
                const value = type === 'BOOLEAN' ? false : '';
                valid(type, value, flags);
                invalid(type, { kind: 'raw', text: null }, ['type'], flags);
            });
for (const type of ['STRING', 'TEXT']) {
    test(`${type}: exact Unicode scalar lengths, whitespace and line endings`, () => {
        for (const [text, length] of [
            ['A', 1],
            ['😀', 1],
            ['e\u0301', 2],
            ['é', 1],
            ['', 0],
            [' \r\n\t ', 5],
            ['\u{10ffff}', 1],
            ['\u0000', 1],
            ['😀é\ne\u0301', 5],
        ]) {
            valid(type, text, { constraints: { minimumLength: length, maximumLength: length } });
            invalid(type, slot(text), ['minimum-length'], {
                constraints: { minimumLength: length + 1 },
            });
            if (length)
                invalid(type, slot(text), ['maximum-length'], {
                    constraints: { maximumLength: length - 1 },
                });
            assert.deepEqual(check(type, { kind: 'raw', text }).parsed, slot(text));
        }
        valid(type, '', { constraints: { minimumLength: 0, maximumLength: 0 } });
        invalid(type, slot(' '), ['maximum-length'], { constraints: { maximumLength: 0 } });
        // No numeric work cap and no grapheme counting or normalization.
        const long = '😀e\u0301\r\n'.repeat(20000);
        valid(type, long, { constraints: { minimumLength: 100000, maximumLength: 100000 } });
        invalid(type, slot(true), ['type']);
        invalid(type, slot(42), ['type']);
    });
    test(`${type}: isolated surrogates are invalid at every position`, () => {
        for (const text of [
            '\ud800',
            '\udbff',
            '\udc00',
            '\udfff',
            'a\ud800b',
            'a\udc00b',
            '\ud800\ud800',
            '\udc00\ud800',
            '😀\udfff',
            'é\ud800',
            '\ud800\n\udc00',
        ]) {
            invalid(type, slot(text), ['invalid-unicode']);
            invalid(type, { kind: 'raw', text }, ['invalid-unicode'], {
                constraints: { maximumLength: 0 },
            });
        }
        valid(type, '\ud800\udc00');
        valid(type, '\udbff\udfff');
    });
}
test('BOOLEAN accepts only primitive boolean value slots, with no raw or scalar coercion', () => {
    valid('BOOLEAN', true);
    valid('BOOLEAN', false);
    for (const value of [
        'true',
        'false',
        '0',
        '1',
        '',
        ' ',
        0,
        1,
        [],
        {},
        new Boolean(true),
        undefined,
    ])
        invalid('BOOLEAN', slot(value), ['type']);
    for (const text of ['true', 'false', '', '1', true])
        invalid('BOOLEAN', { kind: 'raw', text }, ['type']);
});
test('ENUM preserves catalogue order and exact membership, including empty, null and Unicode', () => {
    const choices = ['', 'OPEN', 'CLOSED', 'é', 'e\u0301', '😀', ' '];
    const before = [...choices];
    for (const value of choices) {
        valid('ENUM', value, { choices });
        assert.deepEqual(
            check('ENUM', { kind: 'raw', text: value }, { choices }).parsed,
            slot(value),
        );
    }
    assert.deepEqual(choices, before);
    assert.equal(Object.isFrozen(choices), false);
    for (const value of ['open', ' OPEN', 'OPEN ', 'unknown'])
        invalid('ENUM', slot(value), ['enum'], { choices });
    invalid('ENUM', slot(null), ['null-not-allowed'], { choices });
    valid('ENUM', null, { choices, nullable: true });
    valid('ENUM', '', { choices });
    invalid('ENUM', slot(false), ['type']);
    invalid('ENUM', slot('\ud800'), ['invalid-unicode']);
    invalid('ENUM', slot('OPEN'), ['maximum-length'], {
        choices,
        constraints: { maximumLength: 3 },
    });
    invalid('ENUM', slot('x'), ['minimum-length', 'enum'], {
        choices,
        constraints: { minimumLength: 2 },
    });
    valid('ENUM', '😀', { choices, constraints: { minimumLength: 1, maximumLength: 1 } });
    invalid('ENUM', slot('e\u0301'), ['maximum-length'], {
        choices,
        constraints: { maximumLength: 1 },
    });
});
test('BINARY admits canonical RFC 4648 vectors and preserves exact text', () => {
    for (const text of [
        '',
        'Zg==',
        'Zm8=',
        'Zm9v',
        'Zm9vYg==',
        'Zm9vYmE=',
        'Zm9vYmFy',
        'AA==',
        '/w==',
        '//8=',
        '////',
        '+/8=',
    ]) {
        valid('BINARY', text);
        assert.deepEqual(check('BINARY', { kind: 'raw', text }).parsed, slot(text));
    }
    for (const text of [
        'Zg',
        'Zg=',
        'Zg===',
        'A',
        'AAA',
        '====',
        '=AAA',
        'AA=A',
        'A===',
        'AA==AAAA',
        'Zg==\n',
        ' Zg==',
        'Z g==',
        'Zg==\r\n',
        'Zg==\t',
        '-w==',
        '_w==',
        'AA?=',
        'éAAA',
        '😀AA',
        '\ud800AAA',
        'AB==',
        'AZ==',
        'Zh==',
        'AAB=',
        'Zm9=',
        '//9=',
        '//+=',
    ])
        invalid('BINARY', slot(text), ['binary-format']);
    const long = 'Zm9v'.repeat(100000);
    valid('BINARY', long);
    invalid('BINARY', slot(long + 'AB=='), ['binary-format']);
    invalid('BINARY', slot(long.slice(0, -1) + '!'), ['binary-format']);
    invalid('BINARY', slot(true), ['type']);
});
test('Base64 pad-bit expectations cover all final sextets independently of decoder permissiveness', () => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    // One byte leaves four unused bits; two bytes leave two unused bits.
    for (let i = 0; i < 64; i++) {
        const a = check('BINARY', slot('A' + alphabet[i] + '=='));
        assert.equal(a.state, [0, 16, 32, 48].includes(i) ? 'valid' : 'invalid');
        const b = check('BINARY', slot('AA' + alphabet[i] + '='));
        assert.equal(
            b.state,
            [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60].includes(i)
                ? 'valid'
                : 'invalid',
        );
    }
    // Independent Node encoder provides canonical strings; validation never decodes them.
    for (let length = 0; length <= 65; length++) {
        const bytes = Buffer.from(Array.from({ length }, (_, i) => (i * 37 + length * 11) % 256));
        valid('BINARY', bytes.toString('base64'));
    }
});
test('scalar definitions fail before accepting absence/null; unsupported patterns never pass', () => {
    const cases = [];
    for (const type of types) {
        cases.push(
            [type, { required: undefined }, 'definition'],
            [type, { nullable: 'yes' }, 'definition'],
            [type, { unknown: true }, 'definition'],
        );
    }
    for (const type of ['STRING', 'TEXT', 'ENUM']) {
        for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1', null, true])
            for (const name of ['minimumLength', 'maximumLength'])
                cases.push([type, { constraints: { [name]: value } }, 'constraint']);
        cases.push(
            [type, { constraints: { minimumLength: 2, maximumLength: 1 } }, 'constraint'],
            [type, { constraints: null }, 'constraint'],
            [
                type,
                { constraints: { pattern: { dialect: 'portable-ascii-v1', source: 1 } } },
                'constraint',
            ],
        );
    }
    for (const choices of [
        [],
        null,
        'OPEN',
        [1],
        ['a', 'a'],
        ['\ud800'],
        ['ok', '\udc00'],
        [, 'a'],
    ])
        cases.push(['ENUM', { choices }, 'definition']);
    for (const constraints of [
        { minimumLength: 0 },
        { choices: ['a'] },
        { minimum: { value: '0' } },
        { pattern: '.*' },
    ])
        cases.push(['BOOLEAN', { constraints }, 'definition']);
    cases.push(
        ['BINARY', { format: undefined }, 'definition'],
        ['BINARY', { format: 'base64url' }, 'definition'],
        ['BINARY', { constraints: { maximumLength: 4096 } }, 'definition'],
    );
    for (const [type, extra, code] of cases)
        for (const input of [{ kind: 'absent' }, slot(null), slot('')]) {
            const result = check(type, input, {
                ...extra,
                required:
                    extra.required === undefined && Object.hasOwn(extra, 'required')
                        ? undefined
                        : false,
                nullable: Object.hasOwn(extra, 'nullable') ? extra.nullable : true,
            });
            assert.equal(result.state, 'definition-error');
            assert.deepEqual(
                result.diagnostics.map((d) => d.code),
                [code],
            );
            assert.equal(result.diagnostics[0].source, 'definition');
            assert.deepEqual(result.diagnostics[0].path, path);
            assert(!result.diagnostics[0].message.includes('private-row-key'));
        }
    const pattern = check('STRING', slot('A'), { constraints: { pattern: 'A' } });
    assert.match(pattern.diagnostics[0].message, /Pattern metadata/);
    valid('STRING', '', {
        constraints: { minimumLength: 0, maximumLength: Number.MAX_SAFE_INTEGER },
    });
});
test('scalar results and full paths are frozen snapshots; inputs and definitions stay caller-owned', () => {
    const mutablePath = path.map((part) => ({ ...part }));
    const input = { kind: 'raw', text: 'e\u0301' };
    const d = definition('STRING');
    const result = validateField({ definition: d, input, path: mutablePath });
    const invalidResult = validateField({
        definition: definition('ENUM'),
        input: slot('unknown'),
        path: mutablePath,
    });
    const diagnostic = validateField({
        definition: definition('BINARY', { format: 'url' }),
        input,
        path: mutablePath,
    });
    mutablePath[1].key = 'outside';
    input.text = 'outside';
    d.required = false;
    assert.deepEqual(result.parsed, slot('e\u0301'));
    assert.deepEqual(invalidResult.issues[0].path, path);
    assert.deepEqual(diagnostic.diagnostics[0].path, path);
    const frozen = (v) => {
        if (v && typeof v === 'object') {
            assert(Object.isFrozen(v));
            Object.values(v).forEach(frozen);
        }
    };
    [result, invalidResult, diagnostic].forEach(frozen);
    assert.throws(() => {
        invalidResult.issues[0].path[1].key = 'bad';
    }, TypeError);
    assert.equal(Object.isFrozen(input), false);
    assert.equal(Object.isFrozen(d), false);
});
test('all scalar types preserve STATE snapshots/revision and independent dirty/valid axes', () => {
    const fieldPath = [{ kind: 'property', name: 'content' }];
    const cases = [
        ['STRING', 'é', 'e\u0301', true, 'valid'],
        ['TEXT', 'a', '\ud800', true, 'invalid'],
        ['BOOLEAN', false, true, true, 'valid'],
        ['BOOLEAN', 'false', 'false', false, 'invalid'],
        ['ENUM', '', 'OPEN', true, 'valid'],
        ['ENUM', 'unknown', 'unknown', false, 'invalid'],
        ['BINARY', 'Zg==', 'Zh==', true, 'invalid'],
        ['BINARY', '', '', false, 'valid'],
    ];
    for (const [type, original, draft, dirty, validity] of cases) {
        const root = {
            kind: 'object',
            properties: {
                content: { kind: 'field', equality: { type: 'exact' }, input: slot(original) },
            },
        };
        const initial = createDocumentState(root);
        const state = applyDocumentChange(initial, {
            kind: 'field',
            path: fieldPath,
            input: slot(draft),
        });
        const before = JSON.stringify(state);
        const result = validateField({
            definition: definition(type),
            input: state.current.properties.content.input,
            path: fieldPath,
        });
        assert.equal(result.state, validity);
        assert.equal(state.dirty, dirty);
        assert.equal(state.revision, 1);
        assert.equal(state.original, initial.original);
        assert.equal(initial.current.properties.content.input.value, original);
        assert.equal(JSON.stringify(state), before);
        assert.equal(
            applyDocumentChange(state, { kind: 'field', path: fieldPath, input: slot(original) })
                .dirty,
            false,
        );
    }
    for (const type of types) {
        const text = type === 'ENUM' ? 'OPEN' : type === 'BINARY' ? 'Zg==' : 'true';
        const initial = createDocumentState({
            kind: 'object',
            properties: {
                content: { kind: 'field', equality: { type: 'exact' }, input: slot(text) },
            },
        });
        const state = applyDocumentChange(initial, {
            kind: 'field',
            path: fieldPath,
            input: { kind: 'raw', text },
        });
        const before = JSON.stringify(state);
        const result = validateField({
            definition: definition(type),
            input: state.current.properties.content.input,
            path: fieldPath,
        });
        assert.equal(result.state, type === 'BOOLEAN' ? 'invalid' : 'valid');
        assert.equal(state.dirty, true);
        assert.equal(JSON.stringify(state), before);
        assert.deepEqual(state.current.properties.content.input, { kind: 'raw', text });
    }
});
