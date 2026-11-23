/** SPDX-License-Identifier: Apache-2.0 */
// Shared lexical/work policy. Internal: equality is not a validity certificate.
export const numericTextLimit = 4096;
export function integerMatch(text: string): RegExpExecArray | undefined {
    if (typeof text !== 'string' || text.length > numericTextLimit) return undefined;
    const match = /^([+-]?)([0-9]+)$/.exec(text);
    return match && match[0] === text ? match : undefined;
}

export interface ExactNumeric {
    readonly sign: -1 | 0 | 1;
    /** Zero is represented by digits '0', sign 0 and exponent 0. */
    readonly digits: string;
    readonly exponent: bigint;
}
export type NumericParse =
    | { readonly ok: true; readonly value: ExactNumeric }
    | { readonly ok: false; readonly reason: 'syntax' | 'limit' };
export function parseNumeric(
    text: string,
    semantics:
        | { readonly type: 'INTEGER' }
        | { readonly type: 'DECIMAL'; readonly allowExponent: boolean },
): NumericParse {
    if (typeof text !== 'string') return { ok: false, reason: 'syntax' };
    if (text.length > numericTextLimit) return { ok: false, reason: 'limit' };
    const integer = semantics.type === 'INTEGER';
    if (!integer && (semantics.type !== 'DECIMAL' || typeof semantics.allowExponent !== 'boolean'))
        return { ok: false, reason: 'syntax' };
    const match = integer
        ? integerMatch(text)
        : /^([+-]?)([0-9]+)(?:\.([0-9]+))?(?:[eE]([+-]?[0-9]+))?$/.exec(text);
    if (!match || match[0] !== text || (!integer && !semantics.allowExponent && match[4]))
        return { ok: false, reason: 'syntax' };
    const exponentText = match[4] ?? '0';
    if (exponentText.length > 6) return { ok: false, reason: 'limit' };
    const exponent = BigInt(exponentText);
    if (exponent > 4096n || exponent < -4096n) return { ok: false, reason: 'limit' };
    const digits = (match[2]! + (match[3] ?? '')).replace(/^0+/, '');
    if (!digits) return { ok: true, value: { sign: 0, digits: '0', exponent: 0n } };
    const trimmed = digits.replace(/0+$/, '');
    return {
        ok: true,
        value: {
            sign: match[1] === '-' ? -1 : 1,
            digits: trimmed,
            exponent:
                exponent - BigInt((match[3] ?? '').length) + BigInt(digits.length - trimmed.length),
        },
    };
}

/** Compare signs, decimal orders, then at most 4096 padded coefficient digits. */
export function compareNumeric(a: ExactNumeric, b: ExactNumeric): -1 | 0 | 1 {
    if (a.sign !== b.sign) return a.sign < b.sign ? -1 : 1;
    if (a.sign === 0) return 0;
    const orderA = BigInt(a.digits.length) + a.exponent;
    const orderB = BigInt(b.digits.length) + b.exponent;
    let magnitude: -1 | 0 | 1;
    if (orderA !== orderB) magnitude = orderA < orderB ? -1 : 1;
    else {
        const length = Math.max(a.digits.length, b.digits.length);
        const left = a.digits.padEnd(length, '0'),
            right = b.digits.padEnd(length, '0');
        magnitude = left === right ? 0 : left < right ? -1 : 1;
    }
    return a.sign === -1 ? (magnitude === 0 ? 0 : magnitude === 1 ? -1 : 1) : magnitude;
}

/** Defined only for admitted numeric representations and a positive divisor.
 * Each normalized exponent is within +/-8192; alignment is at most 16384 zeros.
 */
export function numericMultipleOf(value: ExactNumeric, divisor: ExactNumeric): boolean | undefined {
    if (divisor.sign !== 1) return undefined;
    if (value.sign === 0) return true;
    const delta = value.exponent - divisor.exponent;
    if (delta > 16384n || delta < -16384n) return undefined;
    const numerator = BigInt(value.digits),
        denominator = BigInt(divisor.digits);
    return delta >= 0n
        ? (numerator * 10n ** delta) % denominator === 0n
        : numerator % (denominator * 10n ** -delta) === 0n;
}
export function numericDimensions(value: ExactNumeric): { precision: bigint; scale: bigint } {
    if (value.sign === 0) return { precision: 1n, scale: 0n };
    return {
        precision: BigInt(value.digits.length) + (value.exponent > 0n ? value.exponent : 0n),
        scale: value.exponent < 0n ? -value.exponent : 0n,
    };
}
