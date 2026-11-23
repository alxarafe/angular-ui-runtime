/** SPDX-License-Identifier: Apache-2.0 */
/** Linear scan, constant auxiliary space. Undefined means an isolated surrogate. */
export function scalarLength(text: string): number | undefined {
    let length = 0;
    for (let i = 0; i < text.length; i++) {
        const unit = text.charCodeAt(i);
        if (unit >= 0xd800 && unit <= 0xdbff) {
            const next = text.charCodeAt(++i);
            if (!(next >= 0xdc00 && next <= 0xdfff)) return undefined;
        } else if (unit >= 0xdc00 && unit <= 0xdfff) return undefined;
        length++;
    }
    return length;
}
function sextet(unit: number): number {
    if (unit >= 65 && unit <= 90) return unit - 65;
    if (unit >= 97 && unit <= 122) return unit - 97 + 26;
    if (unit >= 48 && unit <= 57) return unit - 48 + 52;
    return unit === 43 ? 62 : unit === 47 ? 63 : -1;
}
/** Strict canonical RFC 4648 section 4 Base64, including zero unused pad bits.
 * No decoded allocation, repair, whitespace skipping or MIME/base64url profile.
 */
export function canonicalBase64(text: string): boolean {
    if (text.length % 4 !== 0) return false;
    if (!text.length) return true;
    const padding = text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0;
    const end = text.length - padding;
    for (let i = 0; i < end; i++) if (sextet(text.charCodeAt(i)) < 0) return false;
    const last = sextet(text.charCodeAt(end - 1));
    return padding === 2 ? last % 16 === 0 : padding === 1 ? last % 4 === 0 : true;
}
