/** SPDX-License-Identifier: Apache-2.0 */
import { parseNumeric, compareNumeric } from './numeric-syntax.js';
export type NumericSemantics =
    { readonly type: 'INTEGER' } | { readonly type: 'DECIMAL'; readonly allowExponent: boolean };

/** Exact mathematical equality, or undefined for unsupported syntax/work bounds.
 * This is not validation of ranges, precision, scale, or any application rule.
 */
export function exactNumericEqual(
    left: string,
    right: string,
    semantics: NumericSemantics,
): boolean | undefined {
    const a = parseNumeric(left, semantics),
        b = parseNumeric(right, semantics);
    return !a.ok || !b.ok ? undefined : compareNumeric(a.value, b.value) === 0;
}
