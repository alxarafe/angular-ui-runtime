import test from 'node:test';
import assert from 'node:assert/strict';
import { validateField } from '../out-tsc/tests/projects/ui-runtime/src/validation/validate-field.js';
import { exactNumericEqual } from '../out-tsc/tests/projects/ui-runtime/src/state/exact-numeric.js';
import { numericMultipleOf } from '../out-tsc/tests/projects/ui-runtime/src/state/numeric-syntax.js';
import {
    createDocumentState,
    applyDocumentChange,
} from '../out-tsc/tests/projects/ui-runtime/src/state/document-state.js';
const path = [
    { kind: 'property', name: 'details' },
    { kind: 'row', key: 'row-a' },
    { kind: 'property', name: 'amount' },
];
const slot = (value) => ({ kind: 'value', value });
const definition = (extra = {}) => ({
    type: 'DECIMAL',
    required: true,
    nullable: false,
    allowExponent: true,
    ...extra,
});
const check = (input, constraints, extra = {}) =>
    validateField({ definition: definition({ constraints, ...extra }), input, path });
const valid = (text, constraints, extra) => {
    assert.deepEqual(check(slot(text), constraints, extra), { state: 'valid', parsed: slot(text) });
};
const bad = (text, codes, constraints, extra) => {
    const result = check(slot(text), constraints, extra);
    assert.equal(result.state, 'invalid');
    assert.deepEqual(
        result.issues.map((issue) => issue.code),
        codes,
    );
    for (const issue of result.issues) {
        assert.equal(issue.source, 'local');
        assert.deepEqual(issue.path, path);
        assert(issue.message.length);
    }
    assert.equal('parsed' in result, false);
};
test('DECIMAL grammar shares STATE syntax and preserves admitted lexical input', () => {
    for (const text of [
        '12',
        '12.3400',
        '0.0012',
        '-0.50',
        '1e3',
        '1.25e-2',
        '+001.20E+3',
        '-0',
        '-0.000e4096',
        '1e-4096',
        '1e+04096',
    ])
        valid(text);
    for (const text of [
        '',
        ' ',
        ' 1',
        '1 ',
        '1\n',
        '.5',
        '1.',
        '-',
        '+',
        '1e',
        '1e-',
        '1e+',
        '--1',
        '+-1',
        'NaN',
        'Infinity',
        '0x10',
        '0b1',
        '1,2',
        '1_000',
        '１２.３',
    ]) {
        bad(text, ['decimal-syntax']);
        assert.equal(
            exactNumericEqual(text, text, { type: 'DECIMAL', allowExponent: true }),
            undefined,
        );
    }
    for (const text of ['1e0', '1E+3', '0e-1'])
        bad(text, ['decimal-syntax'], undefined, { allowExponent: false });
    for (const text of ['0', '-0.00', '+001.20']) valid(text, undefined, { allowExponent: false });
    for (const value of [true, false, 1, 0.3, NaN, Infinity, 1n, {}, undefined])
        bad(value, ['type']);
});
for (const required of [false, true])
    for (const nullable of [false, true])
        test(`DECIMAL presence required=${required}, nullable=${nullable}`, () => {
            assert.equal(
                check({ kind: 'absent' }, undefined, { required, nullable }).state,
                required ? 'invalid' : 'valid',
            );
            assert.equal(
                check(slot(null), undefined, { required, nullable }).state,
                nullable ? 'valid' : 'invalid',
            );
            if (required)
                assert.equal(
                    check({ kind: 'absent' }, undefined, { required, nullable }).issues[0].code,
                    'required',
                );
            if (!nullable) bad(null, ['null-not-allowed'], undefined, { required, nullable });
            bad('', ['decimal-syntax'], undefined, { required, nullable });
            bad(' ', ['decimal-syntax'], undefined, { required, nullable });
        });
for (const [text, precision, scale] of [
    ['12.3400', 4, 2],
    ['1.234e2', 4, 1],
    ['1000', 4, 0],
    ['0.0012', 2, 4],
    ['-12.3400', 4, 2],
    ['0.0000', 1, 0],
    ['1.2300e-2', 3, 4],
    ['+00012.34000', 4, 2],
    ['-0e-4096', 1, 0],
    ['1e3', 4, 0],
    ['120e-3', 2, 2],
])
    test(`normalized dimensions ${text}: precision=${precision}, scale=${scale}`, () => {
        valid(text, { precision, scale });
        bad(text, ['precision'], { precision: precision - 1 });
        if (scale) bad(text, ['scale'], { scale: scale - 1 });
        valid(text, { precision: precision + 1, scale: scale + 1 });
    });
test('precision and scale are independent with no precision >= scale assumption', () => {
    valid('0.0012', { precision: 2, scale: 4 });
    bad('0.0012', ['precision', 'scale'], { precision: 1, scale: 3 });
    valid('9'.repeat(4096), { precision: 4096, scale: 0 });
    bad('1e4096', ['precision'], { precision: 4096 });
    valid('1e4096'); // work policy is not a declared semantic precision constraint
});
test('DECIMAL bounds compare exact mathematical values and independent exclusivity', () => {
    for (const minimumExclusive of [false, true])
        for (const maximumExclusive of [false, true]) {
            const constraints = {
                minimum: { value: '-1.2', exclusive: minimumExclusive },
                maximum: { value: '1.20', exclusive: maximumExclusive },
            };
            bad('-1.25', ['minimum'], constraints);
            bad('1.21', ['maximum'], constraints);
            valid('0', constraints);
            valid('-0', constraints);
            valid('-1.199', constraints);
            assert.equal(
                check(slot('-1.2000'), constraints).state,
                minimumExclusive ? 'invalid' : 'valid',
            );
            assert.equal(
                check(slot('1.2'), constraints).state,
                maximumExclusive ? 'invalid' : 'valid',
            );
        }
    valid('1e3', { minimum: { value: '1000' }, maximum: { value: '1000.00' } });
    bad('1e3', ['maximum'], { maximum: { value: '1000', exclusive: true } });
    valid('9007199254740993.000000001', {
        minimum: { value: '9007199254740993' },
        maximum: { value: '9007199254740993.000000002' },
    });
    bad('9007199254740993.000000003', ['maximum'], {
        maximum: { value: '9007199254740993.000000002' },
    });
    valid('0.15', {
        minimum: { value: '0.1', exclusive: true },
        maximum: { value: '0.2', exclusive: true },
    });
    bad('9e4095', ['maximum'], { maximum: { value: '1e4095' } });
    bad('-1e4096', ['minimum'], { minimum: { value: '-9e4095' } });
    valid('1e-4096', { minimum: { value: '-0' }, maximum: { value: '1e4096' } });
});
test('fractional multipleOf is exact for signs, zero, scale alignment and exponents', () => {
    for (const [text, divisor] of [
        ['0.3', '0.1'],
        ['-1.25', '0.05'],
        ['1e-3', '0.0005'],
        ['0', '1e-4096'],
        ['-0.0000', '+000.05'],
        ['9007199254740993.25', '0.05'],
        ['1e4096', '1e-4096'],
    ])
        valid(text, { multipleOf: divisor });
    for (const [text, divisor] of [
        ['0.31', '0.1'],
        ['-1.251', '0.05'],
        ['1e-4096', '1e4096'],
        ['9007199254740993.26', '0.05'],
    ])
        bad(text, ['multiple-of'], { multipleOf: divisor });
    // Finite open interval is valid; this increment never enumerates decimal multiples.
    bad('0.15', ['multiple-of'], {
        minimum: { value: '0.1', exclusive: true },
        maximum: { value: '0.2', exclusive: true },
        multipleOf: '1',
    });
});
test('DECIMAL definition diagnostics reject malformed constraints, flags and counters', () => {
    const cases = [
        [{ allowExponent: undefined }, 'definition'],
        [{ allowExponent: 'yes' }, 'definition'],
        [{ required: 1 }, 'definition'],
        [{ capacity: { bits: 64, signed: true } }, 'definition'],
        [{ constraints: null }, 'constraint'],
        [{ constraints: { step: '0.1' } }, 'constraint'],
        [{ constraints: { minimum: { value: '1', exclusive: 'yes' } } }, 'constraint'],
        [
            { constraints: { minimum: { value: '1.2' }, maximum: { value: '1.19' } } },
            'contradictory-bounds',
        ],
        [
            {
                constraints: {
                    minimum: { value: '-0', exclusive: true },
                    maximum: { value: '0.00' },
                },
            },
            'contradictory-bounds',
        ],
        [
            {
                constraints: {
                    minimum: { value: '1' },
                    maximum: { value: '1.0', exclusive: true },
                },
            },
            'contradictory-bounds',
        ],
        [{ allowExponent: false, constraints: { multipleOf: '1e0' } }, 'constraint'],
    ];
    for (const divisor of ['0', '-0.00', '-0.05'])
        cases.push([{ constraints: { multipleOf: divisor } }, 'multiple-of-definition']);
    for (const value of ['.5', '1.', '1e-', 'NaN', 'Infinity', ' 1', '1\n', 0.1, true])
        for (const name of ['minimum', 'maximum', 'multipleOf'])
            cases.push([
                { constraints: { [name]: name === 'multipleOf' ? value : { value } } },
                'constraint',
            ]);
    for (const name of ['precision', 'scale']) {
        for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '2', null, true])
            cases.push([{ constraints: { [name]: value } }, 'constraint']);
        for (const value of [4097, Number.MAX_SAFE_INTEGER])
            cases.push([{ constraints: { [name]: value } }, 'constraint-limit']);
    }
    for (const text of ['1e4097', '1e-4097', '1e0000000', '9'.repeat(4097)])
        for (const name of ['minimum', 'maximum', 'multipleOf'])
            cases.push([
                { constraints: { [name]: name === 'multipleOf' ? text : { value: text } } },
                'constraint-limit',
            ]);
    for (const [extra, code] of cases)
        for (const input of [slot('1'), slot(null), { kind: 'absent' }]) {
            const result = check(input, undefined, extra);
            assert.equal(result.state, 'definition-error');
            assert.deepEqual(
                result.diagnostics.map((d) => d.code),
                [code],
            );
            assert.equal(result.diagnostics[0].source, 'definition');
            assert.deepEqual(result.diagnostics[0].path, path);
        }
    valid('0', { scale: 0, precision: 1 });
    bad('0', ['precision'], { precision: 0 });
});
test('bounded decimal work rejects unsupported lexemes before arithmetic, including zero', () => {
    for (const text of ['1e4097', '0e-4097', '1e0000000', '1e+000000', '1'.repeat(4097)]) {
        bad(text, ['input-limit']);
        assert.equal(
            exactNumericEqual(text, text, { type: 'DECIMAL', allowExponent: true }),
            undefined,
        );
    }
    const tiny = '0.' + '0'.repeat(4087) + '1e-4096';
    assert.equal(tiny.length, 4096);
    const huge = '1' + '0'.repeat(4090) + 'e4096';
    assert.equal(huge.length, 4096);
    valid(huge, { multipleOf: tiny });
    bad(tiny, ['multiple-of'], { multipleOf: huge });
    bad(tiny, ['scale'], { scale: 4096 });
    bad(huge, ['precision'], { precision: 4096 });
    const synthetic = { sign: 1, digits: '1', exponent: 20000n };
    assert.equal(numericMultipleOf(synthetic, { sign: 1, digits: '1', exponent: 0n }), undefined);
});
test('raw DECIMAL inputs and immutable detached paths/results preserve editing state', () => {
    const input = { kind: 'raw', text: '1e-' },
        mutablePath = path.map((part) => ({ ...part }));
    const result = validateField({ definition: definition(), input, path: mutablePath });
    assert.equal(result.state, 'invalid');
    assert.equal(result.issues[0].code, 'decimal-syntax');
    assert.deepEqual(input, { kind: 'raw', text: '1e-' });
    input.text = '+001.2500';
    const corrected = validateField({ definition: definition(), input, path: mutablePath });
    assert.deepEqual(corrected.parsed, slot('+001.2500'));
    const diagnostic = check(slot('1'), { scale: -1 });
    mutablePath[1].key = 'outside';
    input.text = 'outside';
    assert.deepEqual(result.issues[0].path, path);
    assert.equal(corrected.parsed.value, '+001.2500');
    function frozen(value) {
        if (value && typeof value === 'object') {
            assert(Object.isFrozen(value));
            Object.values(value).forEach(frozen);
        }
    }
    [result, corrected, diagnostic].forEach(frozen);
    assert.throws(() => {
        result.issues[0].path[1].key = 'bad';
    }, TypeError);
});
test('DECIMAL validation leaves STATE snapshots, keys, revisions and exact dirtiness independent', () => {
    const root = (text) => ({
        kind: 'object',
        properties: {
            amount: {
                kind: 'field',
                equality: { type: 'DECIMAL', allowExponent: true },
                input: slot(text),
            },
        },
    });
    const fieldPath = [{ kind: 'property', name: 'amount' }];
    for (const [original, text, dirty, validity] of [
        ['1.20', '1.2', false, 'valid'],
        ['-', '-', false, 'invalid'],
        ['1.20', '1.25', true, 'valid'],
        ['1.20', '1e-', true, 'invalid'],
        ['0', '-0.0000e4096', false, 'valid'],
    ]) {
        const initial = createDocumentState(root(original));
        const state = applyDocumentChange(initial, {
            kind: 'field',
            path: fieldPath,
            input: slot(text),
        });
        const before = JSON.stringify(state);
        const result = validateField({
            definition: definition(),
            input: state.current.properties.amount.input,
            path: fieldPath,
        });
        assert.equal(result.state, validity);
        assert.equal(state.dirty, dirty);
        assert.equal(state.original, initial.original);
        assert.equal(JSON.stringify(state), before);
        assert.equal(initial.current.properties.amount.input.value, original);
    }
});
test('fixed-seed generated decimal comparisons and divisibility agree with independent rational arithmetic', () => {
    let seed = 177013n;
    const next = () => {
        seed = (seed * 48271n) % 2147483647n;
        return seed;
    };
    const sample = (positive = false) => {
        const coefficient = positive ? (next() % 10000n) + 1n : (next() % 20001n) - 10000n;
        const exponent = (next() % 9n) - 4n;
        const numerator = exponent >= 0n ? coefficient * 10n ** exponent : coefficient;
        const denominator = exponent < 0n ? 10n ** -exponent : 1n;
        return { text: `${coefficient}e${exponent}`, numerator, denominator };
    };
    for (let i = 0; i < 256; i++) {
        const a = sample(),
            b = sample(),
            d = sample(true);
        const difference = a.numerator * b.denominator - b.numerator * a.denominator;
        assert.equal(
            check(slot(a.text), { minimum: { value: b.text } }).state,
            difference >= 0n ? 'valid' : 'invalid',
        );
        assert.equal(
            check(slot(a.text), { maximum: { value: b.text, exclusive: true } }).state,
            difference < 0n ? 'valid' : 'invalid',
        );
        const divisible = (a.numerator * d.denominator) % (a.denominator * d.numerator) === 0n;
        assert.equal(
            check(slot(a.text), { multipleOf: d.text }).state,
            divisible ? 'valid' : 'invalid',
        );
        assert.equal(
            exactNumericEqual(a.text, b.text, { type: 'DECIMAL', allowExponent: true }),
            difference === 0n,
        );
    }
});
