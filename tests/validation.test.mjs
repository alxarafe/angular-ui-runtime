import test from 'node:test';
import assert from 'node:assert/strict';
import { validateField } from '../out-tsc/tests/projects/ui-runtime/src/validation/validate-field.js';
import { exactNumericEqual } from '../out-tsc/tests/projects/ui-runtime/src/state/exact-numeric.js';
import {
    createDocumentState,
    applyDocumentChange,
} from '../out-tsc/tests/projects/ui-runtime/src/state/document-state.js';
const path = [
    { kind: 'property', name: 'details' },
    { kind: 'row', key: 'stable-a' },
    { kind: 'property', name: 'quantity' },
];
const definition = (extra = {}) => ({ type: 'INTEGER', required: true, nullable: false, ...extra });
const slot = (value) => ({ kind: 'value', value });
const check = (input, extra = {}) => validateField({ definition: definition(extra), input, path });
const codes = (result) => result.issues.map((issue) => issue.code);
function bad(input, expected, extra = {}) {
    const result = check(input, extra);
    assert.equal(result.state, 'invalid');
    assert.deepEqual(codes(result), expected);
    for (const issue of result.issues) {
        assert.equal(issue.source, 'local');
        assert.deepEqual(issue.path, path);
        assert.equal(typeof issue.message, 'string');
    }
    assert.equal('parsed' in result, false);
}
for (const required of [false, true])
    for (const nullable of [false, true])
        test(`presence and nullability are independent: required=${required}, nullable=${nullable}`, () => {
            const flags = { required, nullable };
            assert.equal(check({ kind: 'absent' }, flags).state, required ? 'invalid' : 'valid');
            if (required) bad({ kind: 'absent' }, ['required'], flags);
            else assert.deepEqual(check({ kind: 'absent' }, flags).parsed, { kind: 'absent' });
            assert.equal(check(slot(null), flags).state, nullable ? 'valid' : 'invalid');
            if (!nullable) bad(slot(null), ['null-not-allowed'], flags);
            else assert.deepEqual(check(slot(null), flags).parsed, slot(null));
            for (const text of ['', ' ', '\t', '\n']) bad(slot(text), ['integer-syntax'], flags);
            assert.equal(check(slot('0'), flags).state, 'valid');
        });
for (const bits of [8, 16, 32, 64])
    for (const signed of [true, false])
        test(`${bits}-bit ${signed ? 'signed' : 'unsigned'} exact capacity boundaries`, () => {
            const power = 1n << BigInt(signed ? bits - 1 : bits);
            const min = signed ? -power : 0n,
                max = power - 1n;
            const capacity = { bits, signed };
            for (const value of [min, min + 1n, 0n, max - 1n, max])
                assert.equal(check(slot(value.toString()), { capacity }).state, 'valid');
            for (const value of [min - 1n, max + 1n])
                bad(slot(value.toString()), ['integer-range'], { capacity });
            if (!signed) bad(slot('-1'), ['integer-range'], { capacity });
        });
test('unsigned 64 maximum and above-safe integers remain exact', () => {
    const extra = { capacity: { bits: 64, signed: false } };
    assert.equal(check(slot('18446744073709551615'), extra).state, 'valid');
    bad(slot('18446744073709551616'), ['integer-range'], extra);
    assert.equal(check(slot('9007199254740993'), extra).parsed.value, '9007199254740993');
    assert.equal(check(slot('9'.repeat(4096))).state, 'valid'); // No inferred capacity.
});
test('INTEGER lexical grammar is shared with STATE and retains exact input spelling', () => {
    for (const text of ['0', '-0', '+0', '+00012', '-0012', '12345678901234567890']) {
        assert.deepEqual(check(slot(text)).parsed, slot(text));
        assert.equal(exactNumericEqual(text, BigInt(text).toString(), { type: 'INTEGER' }), true);
    }
    for (const text of [
        '1.0',
        '.1',
        '1.',
        '1e0',
        'NaN',
        'Infinity',
        '-Infinity',
        '0x10',
        '0b10',
        '0o10',
        '--1',
        '+-1',
        '++1',
        '+',
        '-',
        '1_000',
        ' 1',
        '1 ',
        '1\n',
        '１２',
        '١',
    ]) {
        bad(slot(text), ['integer-syntax']);
        assert.equal(exactNumericEqual(text, text, { type: 'INTEGER' }), undefined);
    }
    for (const value of [true, false, 1, 0, 1n, undefined, {}, []]) bad(slot(value), ['type']);
});
test('raw drafts validate without mutation or fallback and corrected text parses locally', () => {
    for (const text of ['-', '', '1e-']) {
        const input = { kind: 'raw', text };
        bad(input, ['integer-syntax']);
        assert.deepEqual(input, { kind: 'raw', text });
    }
    assert.deepEqual(check({ kind: 'raw', text: '+0012' }), {
        state: 'valid',
        parsed: slot('+0012'),
    });
    bad({ kind: 'raw', text: null }, ['type']);
});
test('inclusive and exclusive bounds intersect capacity without widening it', () => {
    for (const exclusive of [false, true]) {
        const extra = {
            constraints: {
                minimum: { value: '-10', exclusive },
                maximum: { value: '10', exclusive },
            },
        };
        bad(slot('-11'), ['minimum'], extra);
        bad(slot('11'), ['maximum'], extra);
        for (const text of ['-9', '0', '9']) assert.equal(check(slot(text), extra).state, 'valid');
        assert.equal(check(slot('-10'), extra).state, exclusive ? 'invalid' : 'valid');
        assert.equal(check(slot('10'), extra).state, exclusive ? 'invalid' : 'valid');
        if (exclusive) {
            bad(slot('-10'), ['minimum'], extra);
            bad(slot('10'), ['maximum'], extra);
        }
    }
    const extra = {
        capacity: { bits: 8, signed: true },
        constraints: { minimum: { value: '-1000' }, maximum: { value: '1000' } },
    };
    bad(slot('-129'), ['integer-range'], extra);
    bad(slot('128'), ['integer-range'], extra);
    assert.equal(check(slot('127'), extra).state, 'valid');
    bad(slot('9007199254740993'), ['maximum'], {
        constraints: { maximum: { value: '9007199254740992' } },
    });
});
test('exact positive multipleOf handles negative operands and zero', () => {
    for (const text of ['-12', '0', '12', '+00018'])
        assert.equal(check(slot(text), { constraints: { multipleOf: '+003' } }).state, 'valid');
    for (const text of ['-11', '11'])
        bad(slot(text), ['multiple-of'], { constraints: { multipleOf: '3' } });
    const divisor = 9007199254740993n;
    assert.equal(
        check(slot((divisor * -3n).toString()), { constraints: { multipleOf: divisor.toString() } })
            .state,
        'valid',
    );
    bad(slot((divisor * 3n + 1n).toString()), ['multiple-of'], {
        constraints: { multipleOf: divisor.toString() },
    });
    bad(slot('-1'), ['minimum', 'multiple-of'], {
        constraints: { minimum: { value: '0' }, multipleOf: '2' },
    });
});
test('invalid definitions have distinguished immutable diagnostics even for absent/null input', () => {
    const cases = [
        [undefined, 'definition'],
        [null, 'definition'],
        [{}, 'definition'],
        [definition({ type: 'DECIMAL' }), 'definition'],
        [definition({ required: undefined }), 'definition'],
        [definition({ nullable: 'yes' }), 'definition'],
        [definition({ capacity: {} }), 'capacity'],
        [definition({ capacity: { bits: 8 } }), 'capacity'],
        [definition({ capacity: { signed: true } }), 'capacity'],
        [definition({ capacity: { bits: 128, signed: true } }), 'capacity'],
        [definition({ capacity: { bits: 8, signed: 1 } }), 'capacity'],
        [definition({ constraints: null }), 'constraint'],
        [definition({ constraints: { step: '2' } }), 'constraint'],
        [definition({ constraints: { minimum: { value: '1', exclusive: 'yes' } } }), 'constraint'],
        [
            definition({ constraints: { minimum: { value: '2' }, maximum: { value: '1' } } }),
            'contradictory-bounds',
        ],
        [
            definition({
                constraints: {
                    minimum: { value: '1', exclusive: true },
                    maximum: { value: '2', exclusive: true },
                },
            }),
            'contradictory-bounds',
        ],
        [
            definition({
                capacity: { bits: 8, signed: false },
                constraints: { maximum: { value: '-1' } },
            }),
            'contradictory-bounds',
        ],
        [
            definition({
                constraints: { minimum: { value: '1' }, maximum: { value: '2' }, multipleOf: '3' },
            }),
            'contradictory-bounds',
        ],
        [definition({ constraints: { minimum: { value: '9'.repeat(4097) } } }), 'constraint-limit'],
    ];
    for (const text of ['0', '-1', '-0'])
        cases.push([definition({ constraints: { multipleOf: text } }), 'multiple-of-definition']);
    for (const value of ['1.0', '1e2', '', ' 1', '1\n', true, 2])
        for (const name of ['minimum', 'maximum', 'multipleOf'])
            cases.push([
                definition({ constraints: { [name]: name === 'multipleOf' ? value : { value } } }),
                'constraint',
            ]);
    for (const [d, code] of cases)
        for (const input of [slot('1'), slot(null), { kind: 'absent' }]) {
            const result = validateField({ definition: d, input, path });
            assert.equal(result.state, 'definition-error');
            assert.deepEqual(
                result.diagnostics.map((issue) => issue.code),
                [code],
            );
            assert.equal(result.diagnostics[0].source, 'definition');
            assert.deepEqual(result.diagnostics[0].path, path);
            assert.equal('parsed' in result, false);
        }
});
test('bounded INTEGER arithmetic handles limits and rejects excess before parsing', () => {
    assert.equal(check(slot('1'.repeat(4096))).state, 'valid');
    bad(slot('1'.repeat(4097)), ['input-limit']);
    bad({ kind: 'raw', text: '-'.repeat(4097) }, ['input-limit']);
    assert.equal(
        check(slot('9'.repeat(4096)), { constraints: { multipleOf: '9'.repeat(4096) } }).state,
        'valid',
    );
    assert.equal(
        check(slot('-3'), {
            constraints: { minimum: { value: '-5' }, maximum: { value: '-3' }, multipleOf: '3' },
        }).state,
        'valid',
    );
});
test('results deeply freeze detached parsed slots and full nested paths', () => {
    const input = slot('+001');
    const mutablePath = path.map((p) => ({ ...p }));
    const results = [
        validateField({ definition: definition(), input, path: mutablePath }),
        validateField({ definition: definition(), input: slot('-'), path: mutablePath }),
        validateField({ definition: definition({ capacity: {} }), input, path: mutablePath }),
    ];
    input.value = 'mutated';
    mutablePath[1].key = 'mutated';
    mutablePath.push({ kind: 'property', name: 'extra' });
    assert.equal(results[0].parsed.value, '+001');
    assert.deepEqual(results[1].issues[0].path, path);
    assert.deepEqual(results[2].diagnostics[0].path, path);
    function frozen(value) {
        if (value && typeof value === 'object') {
            assert(Object.isFrozen(value));
            for (const child of Object.values(value)) frozen(child);
        }
    }
    results.forEach(frozen);
    assert.throws(() => {
        results[1].issues[0].path[1].key = 'bad';
    }, TypeError);
    for (const badPath of [
        [],
        [null],
        [{ kind: 'row', key: '' }],
        [{ kind: 'property', name: 'n', extra: true }],
        Array(129).fill(path[0]),
    ])
        assert.throws(() =>
            validateField({ definition: definition(), input: slot('1'), path: badPath }),
        );
});
test('STATE clean/dirty and valid/invalid axes stay independent with unchanged snapshots', () => {
    const root = (text) => ({
        kind: 'object',
        properties: { n: { kind: 'field', equality: { type: 'INTEGER' }, input: slot(text) } },
    });
    const fieldPath = [{ kind: 'property', name: 'n' }];
    for (const [original, draft, dirty, validity] of [
        ['1', '1', false, 'valid'],
        ['-', '-', false, 'invalid'],
        ['1', '2', true, 'valid'],
        ['1', '-', true, 'invalid'],
        ['1', '+001', false, 'valid'],
    ]) {
        const initial = createDocumentState(root(original));
        const state = applyDocumentChange(initial, {
            kind: 'field',
            path: fieldPath,
            input: slot(draft),
        });
        const before = JSON.stringify(state);
        assert.equal(
            validateField({
                definition: definition(),
                input: state.current.properties.n.input,
                path: fieldPath,
            }).state,
            validity,
        );
        assert.equal(state.dirty, dirty);
        assert.equal(JSON.stringify(state), before);
        assert.equal(state.original, initial.original);
    }
});
