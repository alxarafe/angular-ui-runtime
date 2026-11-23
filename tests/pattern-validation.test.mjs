import test from 'node:test';
import assert from 'node:assert/strict';
import {
    compilePortable,
    matchPortable,
} from '../out-tsc/tests/projects/ui-runtime/src/validation/portable-pattern.js';
import { validateField } from '../out-tsc/tests/projects/ui-runtime/src/validation/validate-field.js';
import {
    createDocumentState,
    applyDocumentChange,
} from '../out-tsc/tests/projects/ui-runtime/src/state/document-state.js';
const path = [
    { kind: 'property', name: 'details' },
    { kind: 'row', key: 'private-row-key' },
    { kind: 'property', name: 'code' },
];
const slot = (value) => ({ kind: 'value', value });
const portable = (source) => ({ dialect: 'portable-ascii-v1', source });
const server = (source = 'private-server-source') => ({ dialect: 'server', source });
const check = (pattern, value, extra = {}) =>
    validateField({
        definition: {
            type: 'STRING',
            required: true,
            nullable: false,
            ...extra,
            constraints: { ...extra.constraints, ...(pattern === undefined ? {} : { pattern }) },
        },
        input: slot(value),
        path,
    });
const codes = (result) => result.issues?.map((issue) => issue.code);
const nonfatal = (result, code) => {
    assert.deepEqual(result.checks, [{ reason: 'server-pattern', path }]);
    assert.deepEqual(
        result.diagnostics.map((d) => d.code),
        [code],
    );
    for (const diagnostic of result.diagnostics) {
        assert.equal(diagnostic.source, 'pattern');
        assert.deepEqual(diagnostic.path, path);
        for (const secret of ['private-row-key', 'private-server-source', 'secret-input-value'])
            assert(!diagnostic.message.includes(secret));
    }
};
const slash = String.fromCharCode(92);
for (const [source, yes, no] of [
    ['^$', [''], ['A', '\n']],
    ['^ABC$', ['ABC'], ['', 'AB', 'ABCD', 'xABC', 'ABC\n', 'ABC\r\n', 'AB\nC']],
    [
        '^[A-Z][A-Z0-9_]{0,29}$',
        ['A', 'ABC_09', 'A'.repeat(30)],
        ['', '1A', 'a', 'Á', 'A'.repeat(31), 'ABC\n'],
    ],
    ['^[A]{0,0}$', [''], ['A']],
    ['^[AB]{0,3}$', ['', 'A', 'ABA'], ['ABAB', 'C']],
    ['^[AB]{2,2}$', ['AB', 'BA'], ['', 'A', 'ABA']],
    ['^[A-Z][0-9]_!$', ['A0_!', 'Z9_!'], ['a0_!', 'A0_!\n']],
    ['^[-A-Z]$', ['-', 'A', 'Z'], ['0', 'a']],
    ['^[A-Z-]$', ['-', 'B'], ['0']],
    ['^[A' + slash + '-Z]$', ['A', '-', 'Z'], ['M']],
    ['^[+.*?(){}$|^]$', ['+', '.', '*', '?', '(', ')', '{', '}', '$', '|', '^'], ['A']],
])
    test(`portable whole-input instructions: ${source}`, () => {
        const compiled = compilePortable(source);
        assert.equal(compiled.state, 'compiled');
        for (const text of yes) {
            assert.equal(matchPortable(compiled.program, text), 'matched');
            assert.deepEqual(check(portable(source), text), { state: 'valid', parsed: slot(text) });
        }
        for (const text of no) {
            assert.equal(matchPortable(compiled.program, text), 'mismatch');
            const result = check(portable(source), text);
            assert.equal(result.state, 'invalid');
            assert.deepEqual(codes(result), ['pattern']);
            assert.equal('checks' in result, false);
            assert.equal('diagnostics' in result, false);
        }
    });
test('quoted reserved punctuation and ASCII range boundaries have exact literal semantics', () => {
    const punctuation = '^$.|?*+()[]{}-' + slash;
    const source = '^' + [...punctuation].map((char) => slash + char).join('') + '$';
    assert.equal(check(portable(source), punctuation).state, 'valid');
    assert.deepEqual(codes(check(portable(source), punctuation + '\n')), ['pattern']);
    const ascii = portable('^[ -~]$');
    for (let code = 32; code <= 126; code++)
        assert.equal(check(ascii, String.fromCharCode(code)).state, 'valid');
    for (const text of ['\u001f', '\u007f', '\n', '\r', 'é', '😀', 'e\u0301'])
        assert.deepEqual(codes(check(ascii, text)), ['pattern']);
});
test('supported programs are deeply frozen, including classes and repeated instructions', () => {
    const compiled = compilePortable('^[A-Z][0-9_]{0,29}$');
    const frozen = (v) => {
        if (v && typeof v === 'object') {
            assert(Object.isFrozen(v));
            Object.values(v).forEach(frozen);
        }
    };
    frozen(compiled);
    assert.throws(() => {
        compiled.program.repeat.maximum = 999;
    }, TypeError);
    assert.throws(() => {
        compiled.program.prefix[0].ranges[0][0] = 0;
    }, TypeError);
});
test('meaningful unapproved syntax is deferred without claiming general regex validity', () => {
    const sources = [
        '^(a+)+$',
        '^a++$',
        '^(?:a)$',
        '^(a|b)$',
        '^a|b$',
        '^(?=a)a$',
        '^(?!b)a$',
        '^(?<=b)a$',
        '^.$',
        '^a*$',
        '^a+$',
        '^a?$',
        '^a{1,2}$',
        '^[A]{1}$',
        '^[A]{1,}$',
        '^[A]{,2}$',
        '^[A]{1,2}B$',
        '^[A]{1,2}{1,2}$',
        '^[^A]$',
        '^[A&&B]$',
        '^[[A]]$',
        '^' + slash + 'd$',
        '^' + slash + 'w$',
        '^' + slash + '1$',
        '^' + slash + 'p{L}$',
        '^' + slash + 'x41$',
        '^A$/i',
        '(?i)^A$',
        'A',
        '^A',
        'A$',
        '^é$',
        '^A\n$',
        '^($',
    ];
    for (const source of sources) {
        const compiled = compilePortable(source);
        assert.deepEqual(compiled, { state: 'deferred', reason: 'unsupported' });
        const result = check(portable(source), 'secret-input-value');
        assert.equal(result.state, 'pending');
        assert.deepEqual(result.parsed, slot('secret-input-value'));
        nonfatal(result, 'pattern-unsupported');
    }
    // The last dollar is quoted and does not supply a whole-input end anchor.
    assert.equal(check(portable('^A' + slash + '$'), 'A$').state, 'pending');
});
test('confident errors in portable declarations are fatal definition diagnostics', () => {
    for (const source of [
        '^[A-Z$',
        '^[]$',
        '^[Z-A]$',
        '^A]$',
        '^[A]{2,1}$',
        '^[A]{-1,2}$',
        '^[A]{1.5,2}$',
        '^[A]{x,2}$',
        '^[A]{1,2,3}$',
        '^[A]{1,2$',
        '^' + slash + 'q$',
        '^' + slash + '!$',
        '^[' + slash + ']$',
    ]) {
        assert.deepEqual(compilePortable(source), { state: 'malformed' });
        for (const input of [slot('A'), { kind: 'absent' }, slot(null)]) {
            const result = validateField({
                definition: {
                    type: 'STRING',
                    required: false,
                    nullable: true,
                    constraints: { pattern: portable(source) },
                },
                input,
                path,
            });
            assert.equal(result.state, 'definition-error');
            assert.equal(result.diagnostics[0].source, 'definition');
            assert.equal(result.diagnostics[0].code, 'constraint');
            assert.equal('checks' in result, false);
            assert.match(result.diagnostics[0].message, /Malformed portable/);
        }
    }
});
test('malformed pattern metadata and unapproved flags are fatal on every input state', () => {
    for (const pattern of [
        null,
        'A',
        {},
        { dialect: 'server' },
        { source: '^A$' },
        { dialect: 'unknown', source: '^A$' },
        { dialect: 'server', source: 1 },
        { dialect: 'portable-ascii-v1', source: /^A$/ },
        { dialect: 'portable-ascii-v1', source: '^A$', flags: 'i' },
    ]) {
        for (const input of [slot('A'), slot(null), { kind: 'absent' }]) {
            const result = validateField({
                definition: {
                    type: 'STRING',
                    required: false,
                    nullable: true,
                    constraints: { pattern },
                },
                input,
                path,
            });
            assert.equal(result.state, 'definition-error');
            assert.equal(result.diagnostics[0].code, 'constraint');
        }
    }
});
test('source, prefix and repetition work profiles defer instead of silently passing', () => {
    const fullSource = '^[' + 'A'.repeat(252) + ']$';
    assert.equal(fullSource.length, 256);
    assert.equal(check(portable(fullSource), 'A').state, 'valid');
    const cases = [
        ['^[' + 'A'.repeat(253) + ']$', 'pattern-source-limit'],
        ['^' + 'A'.repeat(65) + '$', 'pattern-prefix-limit'],
        ['^[A]{0,4097}$', 'pattern-repetition-limit'],
        ['^[A]{99999999999999999999,99999999999999999999}$', 'pattern-repetition-limit'],
        ['^' + 'A'.repeat(100000) + '$', 'pattern-source-limit'],
    ];
    for (const [source, code] of cases) {
        const result = check(portable(source), 'A');
        assert.equal(result.state, 'pending');
        nonfatal(result, code);
    }
    assert.equal(check(portable('^' + 'A'.repeat(64) + '$'), 'A'.repeat(64)).state, 'valid');
    assert.equal(
        check(portable('^' + 'A'.repeat(64) + '[A]{0,4096}$'), 'A'.repeat(4096)).state,
        'valid',
    );
    assert.equal(check(portable('^[A]{4096,4096}$'), 'A'.repeat(4096)).state, 'valid');
    assert.equal(check(portable('^[A]{4097,4096}$'), 'A').state, 'definition-error');
});
test('4096 scalar execution cap preserves independent lengths and Unicode rules', () => {
    const pattern = portable('^[A]{0,4096}$');
    assert.equal(check(pattern, 'A'.repeat(4096)).state, 'valid');
    const pending = check(pattern, 'A'.repeat(4097));
    assert.equal(pending.state, 'pending');
    nonfatal(pending, 'pattern-input-limit');
    const invalid = check(pattern, 'A'.repeat(4097), { constraints: { maximumLength: 4096 } });
    assert.equal(invalid.state, 'invalid');
    assert.deepEqual(codes(invalid), ['maximum-length']);
    nonfatal(invalid, 'pattern-input-limit');
    const astral = check(pattern, '😀'.repeat(4096));
    assert.deepEqual(codes(astral), ['pattern']);
    const astralLong = check(pattern, '😀'.repeat(4097));
    assert.equal(astralLong.state, 'pending');
    nonfatal(astralLong, 'pattern-input-limit');
    assert.deepEqual(codes(check(portable('^e$'), 'e\u0301')), ['pattern']);
    for (const text of ['\ud800', '\udc00', 'A\ud800B']) {
        const local = check(pattern, text);
        assert.deepEqual(codes(local), ['invalid-unicode']);
        assert.equal('checks' in local, false);
        const deferred = check(server(), text);
        assert.deepEqual(codes(deferred), ['invalid-unicode']);
        nonfatal(deferred, 'pattern-server-only');
    }
    assert.equal(check(undefined, 'A'.repeat(50000)).state, 'valid');
});
test('server-only and unsupported obligations survive local errors with invalid precedence', () => {
    for (const pattern of [server(), portable('^(a+)+$')]) {
        const result = check(pattern, 'A', { constraints: { minimumLength: 5 } });
        assert.equal(result.state, 'invalid');
        assert.deepEqual(codes(result), ['minimum-length']);
        nonfatal(
            result,
            pattern.dialect === 'server' ? 'pattern-server-only' : 'pattern-unsupported',
        );
        assert.equal('parsed' in result, false);
    }
    const result = check(server(''), ''); // Server source is opaque, not parsed as portable syntax.
    assert.equal(result.state, 'pending');
    nonfatal(result, 'pattern-server-only');
    const definitionError = check(server(), 'A', { constraints: { minimumLength: -1 } });
    assert.equal(definitionError.state, 'definition-error');
    assert.equal('checks' in definitionError, false);
});
test('pattern applicability keeps absence, null, strings, raw envelopes and type errors separate', () => {
    for (const type of ['STRING', 'TEXT', 'ENUM'])
        for (const pattern of [server(), portable('^(a+)+$'), portable('^$')]) {
            const base = {
                type,
                required: false,
                nullable: true,
                ...(type === 'ENUM' ? { choices: ['', 'A'] } : {}),
                constraints: { pattern },
            };
            for (const input of [{ kind: 'absent' }, slot(null)]) {
                const result = validateField({ definition: base, input, path });
                assert.deepEqual(result, { state: 'valid', parsed: input });
            }
            for (const [input, code] of [
                [{ kind: 'absent' }, 'required'],
                [slot(null), 'null-not-allowed'],
                [slot(true), 'type'],
            ]) {
                const result = validateField({
                    definition: { ...base, required: true, nullable: false },
                    input,
                    path,
                });
                assert.equal(result.state, 'invalid');
                assert.deepEqual(codes(result), [code]);
                assert.equal('checks' in result, false);
            }
            const input = { kind: 'raw', text: '' };
            const result = validateField({ definition: base, input, path });
            assert.equal(result.state, pattern.source === '^$' ? 'valid' : 'pending');
            assert.deepEqual(result.parsed, slot(''));
            assert.deepEqual(input, { kind: 'raw', text: '' });
        }
    const invalid = validateField({
        definition: {
            type: 'TEXT',
            required: true,
            nullable: false,
            constraints: { pattern: portable('^A$') },
        },
        input: { kind: 'raw', text: 'A\n' },
        path,
    });
    assert.deepEqual(codes(invalid), ['pattern']);
});
test('ENUM membership and lengths remain mandatory independently of pattern disposition', () => {
    const extra = { type: 'ENUM', choices: ['', 'A', 'B'] };
    assert.equal(check(portable('^A$'), 'A', extra).state, 'valid');
    assert.deepEqual(codes(check(portable('^A$'), 'B', extra)), ['pattern']);
    assert.deepEqual(codes(check(portable('^X$'), 'X', extra)), ['enum']);
    assert.deepEqual(
        codes(check(portable('^A$'), 'X', { ...extra, constraints: { minimumLength: 2 } })),
        ['minimum-length', 'enum', 'pattern'],
    );
    const result = check(server(), 'X', extra);
    assert.deepEqual(codes(result), ['enum']);
    nonfatal(result, 'pattern-server-only');
    const choices = ['', 'A'];
    const before = [...choices];
    check(server(), 'A', { type: 'ENUM', choices });
    assert.deepEqual(choices, before);
    assert.equal(check(portable('^$'), '', extra).state, 'valid');
});
test('patterns are not silently enabled on any other semantic definition', () => {
    const definitions = [
        { type: 'BOOLEAN' },
        { type: 'BINARY', format: 'base64' },
        { type: 'UUID', casing: 'lower' },
        { type: 'INTEGER' },
        { type: 'DECIMAL', allowExponent: true },
        { type: 'DATE', format: 'gregorian-date' },
        { type: 'TIME', format: 'local-time', fractionalDigits: 7 },
        { type: 'DATETIME', format: 'offset-instant', fractionalDigits: 7 },
    ];
    for (const definition of definitions) {
        const result = validateField({
            definition: {
                ...definition,
                required: false,
                nullable: true,
                constraints: { pattern: server() },
            },
            input: { kind: 'absent' },
            path,
        });
        assert.equal(result.state, 'definition-error');
    }
});
test('pattern code never invokes a regex constructor or an executable regex engine', () => {
    const NativeRegExp = globalThis.RegExp;
    const exec = NativeRegExp.prototype.exec,
        regexTest = NativeRegExp.prototype.test;
    let attempts = 0;
    const forbidden = () => {
        attempts++;
        throw new Error('Pattern regex execution forbidden');
    };
    try {
        globalThis.RegExp = new Proxy(NativeRegExp, { construct: forbidden, apply: forbidden });
        NativeRegExp.prototype.exec = forbidden;
        NativeRegExp.prototype.test = forbidden;
        const sources = ['^(a+)+$', '^(a|aa)+$', '^[A-Z][A-Z0-9_]{0,29}$', '^[A]{0,4096}$'];
        for (const source of sources) {
            const result = check(portable(source), 'a'.repeat(4096) + '!');
            assert.equal(result.state, 'pending');
        }
        assert.equal(check(portable('^[A-Z][A-Z0-9_]{0,29}$'), 'CODE_1').state, 'valid');
        assert.deepEqual(codes(check(portable('^A$'), 'A\n')), ['pattern']);
    } finally {
        globalThis.RegExp = NativeRegExp;
        NativeRegExp.prototype.exec = exec;
        NativeRegExp.prototype.test = regexTest;
    }
    assert.equal(attempts, 0);
});
test('pending and invalid deferred evidence is frozen, detached and private in messages', () => {
    const mutablePath = path.map((part) => ({ ...part }));
    const pattern = server();
    const input = { kind: 'raw', text: 'secret-input-value' };
    const definition = {
        type: 'STRING',
        required: true,
        nullable: false,
        constraints: { pattern },
    };
    const pending = validateField({ definition, input, path: mutablePath });
    const invalid = validateField({
        definition: { ...definition, constraints: { pattern, minimumLength: 100 } },
        input,
        path: mutablePath,
    });
    pattern.source = '^different$';
    input.text = 'outside';
    mutablePath[1].key = 'outside';
    assert.equal(pending.parsed.value, 'secret-input-value');
    assert.deepEqual(pending.checks[0].path, path);
    nonfatal(pending, 'pattern-server-only');
    nonfatal(invalid, 'pattern-server-only');
    const frozen = (v) => {
        if (v && typeof v === 'object') {
            assert(Object.isFrozen(v));
            Object.values(v).forEach(frozen);
        }
    };
    [pending, invalid].forEach(frozen);
    assert.throws(() => {
        pending.checks[0].path[1].key = 'bad';
    }, TypeError);
    assert.equal(Object.isFrozen(pattern), false);
    assert.equal(Object.isFrozen(input), false);
});
test('no-pattern results preserve the previous exact valid and invalid shapes', () => {
    assert.deepEqual(check(undefined, 'A'), { state: 'valid', parsed: slot('A') });
    const result = check(undefined, 'A', { constraints: { minimumLength: 2 } });
    assert.deepEqual(Object.keys(result).sort(), ['issues', 'state']);
    assert.deepEqual(codes(result), ['minimum-length']);
});
test('STATE clean/dirty is independent of pending/invalid and retains snapshots and revisions', () => {
    const fieldPath = [{ kind: 'property', name: 'code' }];
    const make = (text) =>
        createDocumentState({
            kind: 'object',
            properties: { code: { kind: 'field', equality: { type: 'exact' }, input: slot(text) } },
        });
    for (const [original, draft, minimumLength, expected, dirty] of [
        ['A', 'A', 0, 'pending', false],
        ['A', 'AB', 0, 'pending', true],
        ['A', 'A', 5, 'invalid', false],
        ['A', 'AB', 5, 'invalid', true],
    ]) {
        const initial = make(original);
        const state = applyDocumentChange(initial, {
            kind: 'field',
            path: fieldPath,
            input: slot(draft),
        });
        const before = JSON.stringify(state);
        const result = validateField({
            definition: {
                type: 'STRING',
                required: true,
                nullable: false,
                constraints: { minimumLength, pattern: server() },
            },
            input: state.current.properties.code.input,
            path: fieldPath,
        });
        assert.equal(result.state, expected);
        assert.equal(result.checks[0].reason, 'server-pattern');
        assert.equal(state.dirty, dirty);
        assert.equal(state.revision, 1);
        assert.equal(state.original, initial.original);
        assert.equal(JSON.stringify(state), before);
        assert.equal(initial.current.properties.code.input.value, original);
    }
});
