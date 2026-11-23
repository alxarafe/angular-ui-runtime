/** SPDX-License-Identifier: Apache-2.0 */
import type { ValuePath } from './form-definition.js';
export function formPathKey(path: ValuePath): string {
    if (!Array.isArray(path) || !path.length) throw new Error('Invalid field path');
    for (const segment of path) {
        if (!segment || (segment.kind !== 'property' && segment.kind !== 'row'))
            throw new Error('Invalid field path');
        const identity = segment.kind === 'property' ? segment.name : segment.key;
        if (typeof identity !== 'string' || !identity.trim())
            throw new Error('Invalid form identity');
    }
    return JSON.stringify(
        path.map((segment) =>
            segment.kind === 'property' ? ['property', segment.name] : ['row', segment.key],
        ),
    );
}
