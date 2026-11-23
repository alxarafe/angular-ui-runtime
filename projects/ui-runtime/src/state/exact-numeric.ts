/** SPDX-License-Identifier: Apache-2.0 */
export type NumericSemantics =
    { readonly type: 'INTEGER' } | { readonly type: 'DECIMAL'; readonly allowExponent: boolean };

// Work bounds, not semantic range/precision constraints. No powers or expanded zeros.
const limit = 4096;
function canonical(text: string, semantics: NumericSemantics): string | undefined {
    if (typeof text !== 'string' || text.length > limit) return undefined;
    const integer = semantics.type === 'INTEGER';
    if (!integer && (semantics.type !== 'DECIMAL' || typeof semantics.allowExponent !== 'boolean'))
        return undefined;
    const match = integer
        ? /^([+-]?)([0-9]+)$/.exec(text)
        : /^([+-]?)([0-9]+)(?:\.([0-9]+))?(?:[eE]([+-]?[0-9]+))?$/.exec(text);
    if (!match || match[0] !== text || (!integer && !semantics.allowExponent && match[4]))
        return undefined;
    const exponentText = match[4] ?? '0';
    if (exponentText.length > 6) return undefined;
    // BigInt only parses a bounded exponent, never a field coefficient through Number.
    const exponent = BigInt(exponentText);
    if (exponent > BigInt(limit) || exponent < -BigInt(limit)) return undefined;
    let digits = (match[2]! + (match[3] ?? '')).replace(/^0+/, '');
    if (!digits) return '0';
    const trimmed = digits.replace(/0+$/, '');
    const power =
        exponent - BigInt((match[3] ?? '').length) + BigInt(digits.length - trimmed.length);
    digits = trimmed;
    return `${match[1] === '-' ? '-' : ''}${digits}e${power}`;
}

/** Exact mathematical equality, or undefined for unsupported syntax/work bounds.
 * This is not validation of ranges, precision, scale, or any application rule.
 */
export function exactNumericEqual(
    left: string,
    right: string,
    semantics: NumericSemantics,
): boolean | undefined {
    const a = canonical(left, semantics),
        b = canonical(right, semantics);
    return a === undefined || b === undefined ? undefined : a === b;
}
