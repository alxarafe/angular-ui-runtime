import test from 'node:test';
import assert from 'node:assert/strict';
import { validateField } from '../out-tsc/tests/projects/ui-runtime/src/validation/validate-field.js';
import { parseTemporal } from '../out-tsc/tests/projects/ui-runtime/src/validation/temporal-values.js';
import {
    createDocumentState,
    applyDocumentChange,
} from '../out-tsc/tests/projects/ui-runtime/src/state/document-state.js';
const path = [
    { kind: 'property', name: 'details' },
    { kind: 'row', key: 'private-key' },
    { kind: 'property', name: 'value' },
];
const slot = (value) => ({ kind: 'value', value });
const profiles = {
    UUID: { casing: 'lower' },
    DATE: { format: 'gregorian-date' },
    TIME: { format: 'local-time', fractionalDigits: 7 },
    DATETIME: { format: 'offset-instant', fractionalDigits: 7 },
};
const definition = (type, extra = {}) => ({
    type,
    required: true,
    nullable: false,
    ...profiles[type],
    ...extra,
});
const check = (type, input, extra) =>
    validateField({ definition: definition(type, extra), input, path });
const valid = (type, text, extra) =>
    assert.deepEqual(check(type, slot(text), extra), { state: 'valid', parsed: slot(text) });
function bad(type, text, expected = [type.toLowerCase() + '-format'], extra) {
    const result = check(type, slot(text), extra);
    assert.equal(result.state, 'invalid');
    assert.deepEqual(
        result.issues.map((issue) => issue.code),
        expected,
    );
    assert.equal('parsed' in result, false);
    for (const issue of result.issues) {
        assert.equal(issue.source, 'local');
        assert.deepEqual(issue.path, path);
        assert(!issue.message.includes('private-key'));
    }
}
for (const type of Object.keys(profiles))
    for (const required of [false, true])
        for (const nullable of [false, true])
            test(`${type} presence: required=${required}, nullable=${nullable}`, () => {
                const flags = { required, nullable };
                const absent = check(type, { kind: 'absent' }, flags);
                assert.equal(absent.state, required ? 'invalid' : 'valid');
                if (required) assert.equal(absent.issues[0].code, 'required');
                else assert.deepEqual(absent.parsed, { kind: 'absent' });
                if (nullable) valid(type, null, flags);
                else bad(type, null, ['null-not-allowed'], flags);
                for (const text of ['', ' ', '\n']) bad(type, text, undefined, flags);
                for (const value of [true, false, 0, 1, {}, [], undefined])
                    bad(type, value, ['type'], flags);
            });
test('UUID canonical hyphens, ASCII hex, casing and unrestricted version/variant nibbles', () => {
    const examples = [
        '00000000-0000-0000-0000-000000000000',
        'ffffffff-ffff-ffff-ffff-ffffffffffff',
        '123e4567-e89b-12d3-a456-426614174000',
        '01234567-89ab-cdef-0123-456789abcdef',
    ];
    for (const text of examples) {
        valid('UUID', text);
        valid('UUID', text, { casing: 'either' });
        valid('UUID', text.toUpperCase(), { casing: 'either' });
    }
    valid('UUID', '01234567-89aB-cDef-0123-456789AbCDEF', { casing: 'either' });
    bad('UUID', 'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF');
    for (const text of [
        '123e4567e89b12d3a456426614174000',
        '{123e4567-e89b-12d3-a456-426614174000}',
        ' 123e4567-e89b-12d3-a456-426614174000',
        '123e4567-e89b-12d3-a456-426614174000\n',
        'g23e4567-e89b-12d3-a456-426614174000',
        '123e456-7e89b-12d3-a456-426614174000',
        '１２３e4567-e89b-12d3-a456-426614174000',
    ])
        bad('UUID', text);
    for (const nibble of '0123456789abcdef')
        valid('UUID', `01234567-89ab-${nibble}def-${nibble}123-456789abcdef`);
});
test('DATE validates every month length and Gregorian century/leap-year rules', () => {
    const lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    for (const [i, days] of lengths.entries()) {
        const month = String(i + 1).padStart(2, '0');
        valid('DATE', `2026-${month}-01`);
        valid('DATE', `2026-${month}-${days}`);
        bad('DATE', `2026-${month}-${days + 1}`);
    }
    for (const text of [
        '2000-02-29',
        '2024-02-29',
        '0400-02-29',
        '0004-02-29',
        '2400-02-29',
        '0001-01-01',
        '9999-12-31',
    ])
        valid('DATE', text);
    for (const text of [
        '1900-02-29',
        '2025-02-29',
        '0100-02-29',
        '2100-02-29',
        '2026-04-31',
        '0000-01-01',
        '10000-01-01',
        '1-01-01',
        '2026-1-01',
        '2026-01-1',
        '2026-00-01',
        '2026-13-01',
        '2026-01-00',
        '2026-01-01Z',
        '2026-01-01\n',
        '2026/01/01',
        '２０２６-01-01',
    ])
        bad('DATE', text);
});
test('DATE ordinal anchors and exclusive/inclusive intervals are exact', () => {
    // Independently known Gregorian ordinal anchors, not Date or a second parser.
    for (const [text, ordinal] of [
        ['0001-01-01', 0n],
        ['1970-01-01', 719162n],
        ['2000-01-01', 730119n],
        ['2026-01-01', 739616n],
        ['9999-12-31', 3652058n],
    ])
        assert.equal(parseTemporal(text, 'DATE', 0), ordinal);
    for (const minExclusive of [false, true])
        for (const maxExclusive of [false, true]) {
            const extra = {
                constraints: {
                    minimum: { value: '2024-02-28', exclusive: minExclusive },
                    maximum: { value: '2024-03-01', exclusive: maxExclusive },
                },
            };
            valid('DATE', '2024-02-29', extra);
            assert.equal(
                check('DATE', slot('2024-02-28'), extra).state,
                minExclusive ? 'invalid' : 'valid',
            );
            assert.equal(
                check('DATE', slot('2024-03-01'), extra).state,
                maxExclusive ? 'invalid' : 'valid',
            );
            bad('DATE', '2024-02-27', ['minimum'], extra);
            bad('DATE', '2024-03-02', ['maximum'], extra);
        }
    valid('DATE', '2000-02-29', {
        constraints: { minimum: { value: '2000-02-29' }, maximum: { value: '2000-02-29' } },
    });
});
for (let precision = 0; precision <= 7; precision++)
    test(`TIME fractionalDigits=${precision} is maximum input precision, not required output width`, () => {
        const extra = { fractionalDigits: precision };
        valid('TIME', '00:00:00', extra);
        valid('TIME', '23:59:59', extra);
        for (let digits = 1; digits <= precision; digits++)
            valid('TIME', '12:30:00.' + '1234567'.slice(0, digits), extra);
        bad('TIME', '12:30:00.' + '0'.repeat(precision + 1), undefined, extra);
        const text = precision ? '12:30:00.' + '1'.repeat(precision) : '12:30:00';
        valid('DATETIME', `2026-11-23T${text}Z`, extra);
        bad('DATETIME', `2026-11-23T12:30:00.${'1'.repeat(precision + 1)}Z`, undefined, extra);
    });
test('TIME rejects invalid clocks, offsets and incomplete syntax without correction', () => {
    for (const text of [
        '24:00:00',
        '12:60:00',
        '12:30:60',
        '23:59:60',
        '12:30',
        '1:30:00',
        '12:3:00',
        '12:30:0',
        '12:30:00.',
        '12:30:00Z',
        '12:30:00+01:00',
        '12:30:00,1',
        '12:30:00.12345678',
        '12:30:00\n',
        '-1:00:00',
    ])
        bad('TIME', text);
    assert.equal(parseTemporal('00:00:00.0000001', 'TIME', 7), 1n);
    assert.equal(parseTemporal('23:59:59.9999999', 'TIME', 7), 863999999999n);
});
test('TIME bounds compare fractional seconds mathematically at one-tick precision', () => {
    valid('TIME', '12:00:00.1', {
        constraints: { minimum: { value: '12:00:00.1000000' }, maximum: { value: '12:00:00.1' } },
    });
    bad('TIME', '12:00:00.1000000', ['minimum'], {
        constraints: { minimum: { value: '12:00:00.1', exclusive: true } },
    });
    bad('TIME', '12:00:00.1000001', ['maximum'], {
        constraints: { maximum: { value: '12:00:00.1000000' } },
    });
    valid('TIME', '12:00:00.1000001', {
        constraints: {
            minimum: { value: '12:00:00.1', exclusive: true },
            maximum: { value: '12:00:00.1000002', exclusive: true },
        },
    });
});
test('DATETIME grammar, offsets and clock/calendar validation use the declared profile', () => {
    for (const suffix of [
        'Z',
        '+00:00',
        '-00:00',
        '+14:00',
        '-14:00',
        '+13:59',
        '-13:59',
        '+05:45',
        '-03:30',
    ])
        valid('DATETIME', '2026-11-23T18:00:00.1234567' + suffix);
    for (const text of [
        '2026-11-23T18:00:00',
        '2026-11-23 18:00:00Z',
        '2026-11-23t18:00:00z',
        '2026-11-23T18:00Z',
        '2026-11-23T18:00:00+01',
        '2026-11-23T18:00:00+0100',
        '2026-11-23T18:00:00+1:00',
        '2026-11-23T18:00:00+01:0',
        '2026-11-23T18:00:00+00:60',
        '2026-11-23T18:00:00+14:01',
        '2026-11-23T18:00:00-14:01',
        '2026-11-23T18:00:00+15:00',
        '2026-11-23T18:00:00-18:00',
        '2026-11-23T18:00:00+01:00:00',
        '2026-11-23T18:00:00Z[Europe/Madrid]',
        '1900-02-29T12:00:00Z',
        '2026-04-31T00:00:00Z',
        '0000-01-01T00:00:00Z',
        '2026-11-23T24:00:00Z',
        '2026-11-23T23:59:60Z',
        '2026-11-23T23:60:00Z',
        '2026-11-23T18:00:00.12345678Z',
        '2026-11-23T18:00:00Z\n',
    ])
        bad('DATETIME', text);
});
test('DATETIME exact instant anchors, rollovers and equivalent offset bounds', () => {
    const day = 864000000000n,
        second = 10000000n;
    const cases = [
        ['2026-11-23T18:00:00+01:00', '2026-11-23T17:00:00Z', 739942n * day + 17n * 3600n * second],
        ['2026-01-01T00:30:00+01:00', '2025-12-31T23:30:00Z', 739616n * day - 1800n * second],
        ['2000-03-01T00:30:00+01:00', '2000-02-29T23:30:00Z', 730179n * day - 1800n * second],
        ['1900-03-01T00:30:00+01:00', '1900-02-28T23:30:00Z', 693654n * day - 1800n * second],
        ['2000-02-29T23:30:00-01:00', '2000-03-01T00:30:00Z', 730179n * day + 1800n * second],
        [
            '2026-11-14T23:59:59.7654321-02:00',
            '2026-11-15T01:59:59.7654321Z',
            739934n * day + 7199n * second + 7654321n,
        ],
        ['2026-11-23T17:00:00-00:00', '2026-11-23T17:00:00Z', 739942n * day + 17n * 3600n * second],
    ];
    for (const [a, b, expected] of cases) {
        assert.equal(parseTemporal(a, 'DATETIME', 7), expected);
        assert.equal(parseTemporal(b, 'DATETIME', 7), expected);
        valid('DATETIME', a, { constraints: { minimum: { value: b }, maximum: { value: b } } });
        valid('DATETIME', b, { constraints: { minimum: { value: a }, maximum: { value: a } } });
        bad('DATETIME', a, ['minimum'], {
            constraints: { minimum: { value: b, exclusive: true } },
        });
        bad('DATETIME', a, ['maximum'], {
            constraints: { maximum: { value: b, exclusive: true } },
        });
    }
});
test('DATETIME UTC and local year limits reject overflow with exact tick boundaries', () => {
    const maximum = 3155378975999999999n;
    assert.equal(parseTemporal('0001-01-01T00:00:00Z', 'DATETIME', 7), 0n);
    assert.equal(parseTemporal('0001-01-01T14:00:00.0000001+14:00', 'DATETIME', 7), 1n);
    assert.equal(parseTemporal('9999-12-31T09:59:59.9999999-14:00', 'DATETIME', 7), maximum);
    valid('DATETIME', '0001-01-01T14:00:00+14:00');
    valid('DATETIME', '9999-12-31T23:59:59.9999999Z');
    for (const text of [
        '0001-01-01T00:00:00+00:01',
        '0001-01-01T13:59:59.9999999+14:00',
        '9999-12-31T23:59:59-00:01',
        '9999-12-31T10:00:00-14:00',
    ])
        bad('DATETIME', text);
    bad('DATETIME', '9999-12-31T23:59:59.9999999Z', ['maximum'], {
        constraints: { maximum: { value: '9999-12-31T23:59:59.9999998Z' } },
    });
    valid('DATETIME', '9999-12-31T23:59:59.9999998Z', {
        constraints: { maximum: { value: '9999-12-31T23:59:59.9999999Z', exclusive: true } },
    });
});
test('profile, precision, bound and interval definition errors precede absence/null acceptance', () => {
    const cases = [
        ['UUID', { casing: undefined }, 'definition'],
        ['UUID', { casing: 'upper' }, 'definition'],
        ['UUID', { constraints: {} }, 'definition'],
        ['DATE', { format: 'iso-date' }, 'definition'],
        ['DATE', { fractionalDigits: 0 }, 'definition'],
        ['TIME', { format: 'utc-time' }, 'definition'],
        ['DATETIME', { format: 'local-datetime' }, 'definition'],
        ['DATE', { constraints: { minimum: { value: '2025-02-29' } } }, 'constraint'],
        [
            'TIME',
            { fractionalDigits: 0, constraints: { minimum: { value: '12:00:00.0' } } },
            'constraint',
        ],
        ['DATETIME', { constraints: { maximum: { value: '2026-01-01T00:00:00' } } }, 'constraint'],
        [
            'DATETIME',
            { constraints: { minimum: { value: '0001-01-01T00:00:00+00:01' } } },
            'constraint',
        ],
    ];
    for (const type of Object.keys(profiles))
        cases.push(
            [type, { required: undefined }, 'definition'],
            [type, { nullable: 1 }, 'definition'],
            [type, { extra: true }, 'definition'],
        );
    for (const type of ['TIME', 'DATETIME']) {
        for (const value of [
            undefined,
            -1,
            0.5,
            NaN,
            Infinity,
            Number.MAX_SAFE_INTEGER + 1,
            '7',
            null,
            true,
        ])
            cases.push([type, { fractionalDigits: value }, 'definition']);
        for (const value of [8, Number.MAX_SAFE_INTEGER])
            cases.push([type, { fractionalDigits: value }, 'constraint-limit']);
    }
    for (const type of ['DATE', 'TIME', 'DATETIME']) {
        const text =
            type === 'DATE' ? '2026-11-23' : type === 'TIME' ? '12:00:00' : '2026-11-23T12:00:00Z';
        for (const value of [
            null,
            { value: 1 },
            { value: '' },
            { value: text, exclusive: 'yes' },
            { value: text, extra: true },
        ])
            cases.push([type, { constraints: { minimum: value } }, 'constraint']);
        cases.push([type, { constraints: { pattern: '.*' } }, 'constraint']);
        cases.push([
            type,
            {
                constraints: {
                    minimum: { value: text, exclusive: true },
                    maximum: { value: text },
                },
            },
            'contradictory-bounds',
        ]);
    }
    const intervals = [
        ['DATE', '2026-01-02', '2026-01-01', 7],
        ['DATE', '2026-01-01', '2026-01-02', 7],
        ['TIME', '12:00:00.1', '12:00:00.1000000', 7],
        ['TIME', '12:00:00', '12:00:01', 0],
        ['DATETIME', '2026-11-23T18:00:00+01:00', '2026-11-23T17:00:00Z', 7],
        ['DATETIME', '2026-11-23T17:00:01Z', '2026-11-23T17:00:00Z', 7],
    ];
    for (const [type, a, b, precision] of intervals)
        cases.push([
            type,
            {
                ...(type !== 'DATE' ? { fractionalDigits: precision } : {}),
                constraints: {
                    minimum: { value: a, exclusive: true },
                    maximum: { value: b, exclusive: true },
                },
            },
            'contradictory-bounds',
        ]);
    cases.push([
        'DATE',
        { constraints: { minimum: { value: '9999-12-31', exclusive: true } } },
        'contradictory-bounds',
    ]);
    cases.push([
        'TIME',
        { constraints: { maximum: { value: '00:00:00', exclusive: true } } },
        'contradictory-bounds',
    ]);
    for (const [type, extra, code] of cases)
        for (const input of [{ kind: 'absent' }, slot(null), slot('')]) {
            const result = check(type, input, {
                ...extra,
                required: Object.hasOwn(extra, 'required') ? extra.required : false,
                nullable: Object.hasOwn(extra, 'nullable') ? extra.nullable : true,
            });
            assert.equal(result.state, 'definition-error');
            assert.deepEqual(
                result.diagnostics.map((d) => d.code),
                [code],
            );
            assert.equal(result.diagnostics[0].source, 'definition');
            assert.deepEqual(result.diagnostics[0].path, path);
        }
});
test('raw drafts, parsed lexemes and nested paths remain detached and frozen', () => {
    const mutablePath = path.map((part) => ({ ...part }));
    for (const [type, text] of [
        ['UUID', 'ffffffff-ffff-ffff-ffff-ffffffffffff'],
        ['DATE', '2024-02-29'],
        ['TIME', '12:30:00.1000000'],
        ['DATETIME', '2026-11-23T18:00:00.1000000+01:00'],
    ]) {
        const input = { kind: 'raw', text };
        const result = validateField({ definition: definition(type), input, path: mutablePath });
        assert.deepEqual(result, { state: 'valid', parsed: slot(text) });
        input.text = 'outside';
        assert.equal(result.parsed.value, text);
    }
    const invalid = validateField({
        definition: definition('DATETIME'),
        input: { kind: 'raw', text: '2026-11-23T18:00:00+' },
        path: mutablePath,
    });
    const diagnostic = validateField({
        definition: definition('TIME', { fractionalDigits: 8 }),
        input: slot(null),
        path: mutablePath,
    });
    mutablePath[1].key = 'outside';
    assert.deepEqual(invalid.issues[0].path, path);
    assert.deepEqual(diagnostic.diagnostics[0].path, path);
    const frozen = (v) => {
        if (v && typeof v === 'object') {
            assert(Object.isFrozen(v));
            Object.values(v).forEach(frozen);
        }
    };
    [invalid, diagnostic, check('TIME', slot('12:30:00.1000000'))].forEach(frozen);
    assert.throws(() => {
        invalid.issues[0].path[1].key = 'bad';
    }, TypeError);
});
test('temporal validation and bound comparison do not invoke JavaScript Date', () => {
    const NativeDate = globalThis.Date;
    try {
        globalThis.Date = class {
            constructor() {
                throw new Error('Date forbidden');
            }
            static parse() {
                throw new Error('Date.parse forbidden');
            }
        };
        valid('DATE', '2000-02-29');
        valid('TIME', '23:59:59.1234567');
        valid('DATETIME', '2026-11-23T18:00:00+01:00', {
            constraints: { maximum: { value: '2026-11-23T17:00:00Z' } },
        });
        bad('DATE', '1900-02-29');
    } finally {
        globalThis.Date = NativeDate;
    }
});
test('STATE keeps lexical dirty equality independent from instant-bound validity', () => {
    const fieldPath = [{ kind: 'property', name: 'value' }];
    const cases = [
        [
            'UUID',
            'ffffffff-ffff-ffff-ffff-ffffffffffff',
            'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF',
            true,
            'valid',
            { casing: 'either' },
        ],
        ['DATE', '2024-02-29', '2025-02-29', true, 'invalid', {}],
        ['DATE', '2025-02-29', '2025-02-29', false, 'invalid', {}],
        ['TIME', '12:00:00.1', '12:00:00.1000000', true, 'valid', {}],
        [
            'DATETIME',
            '2026-11-23T18:00:00+01:00',
            '2026-11-23T17:00:00Z',
            true,
            'valid',
            {
                constraints: {
                    minimum: { value: '2026-11-23T18:00:00+01:00' },
                    maximum: { value: '2026-11-23T18:00:00+01:00' },
                },
            },
        ],
    ];
    for (const [type, original, text, dirty, validity, extra] of cases) {
        const initial = createDocumentState({
            kind: 'object',
            properties: {
                value: { kind: 'field', equality: { type: 'exact' }, input: slot(original) },
            },
        });
        const state = applyDocumentChange(initial, {
            kind: 'field',
            path: fieldPath,
            input: slot(text),
        });
        const before = JSON.stringify(state);
        assert.equal(
            validateField({
                definition: definition(type, extra),
                input: state.current.properties.value.input,
                path: fieldPath,
            }).state,
            validity,
        );
        assert.equal(state.dirty, dirty);
        assert.equal(state.revision, 1);
        assert.equal(state.original, initial.original);
        assert.equal(JSON.stringify(state), before);
        assert.equal(initial.current.properties.value.input.value, original);
        const raw = applyDocumentChange(state, {
            kind: 'field',
            path: fieldPath,
            input: { kind: 'raw', text },
        });
        validateField({
            definition: definition(type, extra),
            input: raw.current.properties.value.input,
            path: fieldPath,
        });
        assert.deepEqual(raw.current.properties.value.input, { kind: 'raw', text });
        assert.equal(raw.revision, 2);
        assert.equal(raw.original, initial.original);
    }
});
test('deterministic instant samples use independent day anchors and clock tick arithmetic', () => {
    const days = ['2000-02-27', '2000-02-28', '2000-02-29', '2000-03-01', '2000-03-02'];
    const offsets = [-840n, -330n, 0n, 345n, 840n];
    let seed = 17011n;
    const next = () => {
        seed = (seed * 48271n) % 2147483647n;
        return seed;
    };
    for (let i = 0; i < 128; i++) {
        const dayIndex = i % days.length;
        const offset = offsets[i % offsets.length];
        const time = (next() * next()) % 864000000000n;
        const hour = time / 36000000000n,
            minute = (time / 600000000n) % 60n,
            second = (time / 10000000n) % 60n,
            fraction = time % 10000000n;
        const absolute = offset < 0n ? -offset : offset;
        const zone = `${offset < 0n ? '-' : '+'}${String(absolute / 60n).padStart(2, '0')}:${String(absolute % 60n).padStart(2, '0')}`;
        const text = `${days[dayIndex]}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}.${String(fraction).padStart(7, '0')}${zone}`;
        const expected = (730176n + BigInt(dayIndex)) * 864000000000n + time - offset * 600000000n;
        assert.equal(parseTemporal(text, 'DATETIME', 7), expected);
        valid('DATETIME', text);
    }
});
