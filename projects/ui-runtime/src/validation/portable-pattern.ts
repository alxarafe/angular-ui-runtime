/** SPDX-License-Identifier: Apache-2.0 */
import { scalarLength } from './scalar-values.js';

interface Atom {
    readonly ranges: readonly (readonly [number, number])[];
}
export interface PortableProgram {
    readonly prefix: readonly Atom[];
    readonly repeat?: { readonly atom: Atom; readonly minimum: number; readonly maximum: number };
}
export type PatternDeferReason =
    'unsupported' | 'source-limit' | 'prefix-limit' | 'repetition-limit';
export type PortableCompilation =
    | { readonly state: 'compiled'; readonly program: PortableProgram }
    | { readonly state: 'deferred'; readonly reason: PatternDeferReason }
    | { readonly state: 'malformed' };
class ParseFailure {
    constructor(readonly reason: PatternDeferReason | 'malformed') {}
}
function stop(reason: PatternDeferReason | 'malformed'): never {
    throw new ParseFailure(reason);
}
function atom(ranges: [number, number][]): Atom {
    return Object.freeze({ ranges: Object.freeze(ranges.map((range) => Object.freeze(range))) });
}
const reserved = '\\^$.|?*+()[]{}-';
const regexEscapes = 'dDsSwWbBfnrtv0xucpPkK';
/** A deterministic subset parser, never a regex syntax validator for other dialects.
 * Limit checks precede parsing. No dynamic RegExp, recursion, cache or backend types.
 */
export function compilePortable(source: string): PortableCompilation {
    if (source.length > 256) return Object.freeze({ state: 'deferred', reason: 'source-limit' });
    let slashes = 0;
    for (let j = source.length - 2; j >= 0 && source[j] === '\\'; j--) slashes++;
    if (!source.startsWith('^') || !source.endsWith('$') || source.length < 2 || slashes % 2)
        return Object.freeze({ state: 'deferred', reason: 'unsupported' });
    let i = 1;
    const end = source.length - 1;
    const prefix: Atom[] = [];
    function unit(): { code: number; quoted: boolean } {
        if (i >= end) return stop('malformed');
        let char = source[i++]!;
        let quoted = false;
        if (char === '\\') {
            if (i >= end) return stop('malformed');
            char = source[i++]!;
            if (regexEscapes.includes(char) || (char >= '1' && char <= '9'))
                return stop('unsupported');
            if (!reserved.includes(char)) return stop('malformed');
            quoted = true;
        }
        const code = char.charCodeAt(0);
        if (code < 32 || code > 126) return stop('unsupported');
        return { code, quoted };
    }
    function characterClass(): Atom {
        i++; // '['
        if (source[i] === '^') return stop('unsupported');
        const tokens: { code: number; quoted: boolean }[] = [];
        while (i < end && source[i] !== ']') {
            if (source[i] === '[' || (source[i] === '&' && source[i + 1] === '&'))
                return stop('unsupported');
            tokens.push(unit());
        }
        if (i >= end || !tokens.length) return stop('malformed');
        i++; // ']'
        const ranges: [number, number][] = [];
        for (let j = 0; j < tokens.length; j++) {
            const token = tokens[j]!;
            const dash = token.code === 45 && !token.quoted;
            if (dash) {
                if (j !== 0 && j !== tokens.length - 1) return stop('malformed');
                ranges.push([45, 45]);
            } else if (tokens[j + 1]?.code === 45 && !tokens[j + 1]!.quoted && tokens[j + 2]) {
                const upper = tokens[j + 2]!.code;
                if (upper < token.code) return stop('malformed');
                ranges.push([token.code, upper]);
                j += 2;
            } else ranges.push([token.code, token.code]);
        }
        return atom(ranges);
    }
    function digits(text: string): boolean {
        return !!text.length && [...text].every((char) => char >= '0' && char <= '9');
    }
    function repetition() {
        const close = source.indexOf('}', i + 1);
        if (close < 0 || close >= end) return stop('malformed');
        const parts = source.slice(i + 1, close).split(',');
        i = close + 1;
        if (parts.length === 1 && digits(parts[0]!)) return stop('unsupported'); // {n}
        if (
            parts.length === 2 &&
            ((!parts[0] && digits(parts[1]!)) || (!parts[1] && digits(parts[0]!)))
        )
            return stop('unsupported'); // {,n}, {m,}
        if (parts.length !== 2 || !digits(parts[0]!) || !digits(parts[1]!))
            return stop('malformed');
        const minimum = BigInt(parts[0]!),
            maximum = BigInt(parts[1]!);
        if (minimum > maximum) return stop('malformed');
        if (maximum > 4096n) return stop('repetition-limit');
        return { minimum: Number(minimum), maximum: Number(maximum) };
    }
    try {
        while (i < end) {
            let current: Atom;
            if (source[i] === '[') {
                current = characterClass();
                if (source[i] === '{') {
                    const bounds = repetition();
                    if (i !== end) return stop('unsupported');
                    const repeat = Object.freeze({ atom: current, ...bounds });
                    return Object.freeze({
                        state: 'compiled',
                        program: Object.freeze({ prefix: Object.freeze(prefix), repeat }),
                    });
                }
            } else {
                if (source[i] !== '\\' && '^$.*+?()|{}'.includes(source[i]!))
                    return stop('unsupported');
                if (source[i] === ']') return stop('malformed');
                const literal = unit();
                current = atom([[literal.code, literal.code]]);
            }
            prefix.push(current);
            if (prefix.length > 64) return stop('prefix-limit');
        }
        return Object.freeze({
            state: 'compiled',
            program: Object.freeze({ prefix: Object.freeze(prefix) }),
        });
    } catch (error) {
        if (!(error instanceof ParseFailure)) throw error;
        return error.reason === 'malformed'
            ? Object.freeze({ state: 'malformed' })
            : Object.freeze({ state: 'deferred', reason: error.reason });
    }
}
/** Direct whole-input scan. Matching has no recursion, branching search or backtracking. */
export function matchPortable(
    program: PortableProgram,
    text: string,
): 'matched' | 'mismatch' | 'input-limit' | 'invalid-unicode' {
    const length = scalarLength(text);
    if (length === undefined) return 'invalid-unicode';
    if (length > 4096) return 'input-limit';
    const tail = length - program.prefix.length;
    if (
        program.repeat ? tail < program.repeat.minimum || tail > program.repeat.maximum : tail !== 0
    )
        return 'mismatch';
    let index = 0;
    for (const char of text) {
        const instruction = program.prefix[index++] ?? program.repeat?.atom;
        const code = char.codePointAt(0)!;
        if (!instruction || !instruction.ranges.some(([low, high]) => code >= low && code <= high))
            return 'mismatch';
    }
    return 'matched';
}
