/** SPDX-License-Identifier: Apache-2.0 */
// Shared lexical/work policy. Internal: equality is not a validity certificate.
export const numericTextLimit = 4096;
export function integerMatch(text: string): RegExpExecArray | undefined {
    if (typeof text !== 'string' || text.length > numericTextLimit) return undefined;
    const match = /^([+-]?)([0-9]+)$/.exec(text);
    return match && match[0] === text ? match : undefined;
}
