/** SPDX-License-Identifier: Apache-2.0 */
import { parseTemporal } from '../validation/temporal-values.js';
import {
    validateFieldDefinition,
    type TemporalBound,
    type TimeFieldDefinition,
} from '../validation/validate-field.js';

/** Native assistance is deliberately restricted to the exact whole-second grid. */
export function timeInputBounds(
    definition?: TimeFieldDefinition,
): { min: string; max: string } | undefined {
    if (!definition || definition.fractionalDigits !== 0 || validateFieldDefinition(definition, []))
        return undefined;
    function endpoint(
        bound: TemporalBound | undefined,
        fallback: string,
        direction: bigint,
    ): string {
        if (!bound) return fallback;
        const seconds =
            parseTemporal(bound.value, 'TIME', 0)! / 10000000n + (bound.exclusive ? direction : 0n);
        return [seconds / 3600n, (seconds / 60n) % 60n, seconds % 60n]
            .map((part) => String(part).padStart(2, '0'))
            .join(':');
    }
    return {
        min: endpoint(definition.constraints?.minimum, '00:00:00', 1n),
        max: endpoint(definition.constraints?.maximum, '23:59:59', -1n),
    };
}

/** A native minute selection explicitly chooses zero seconds; existing drafts are never rewritten. */
export function selectedTime(text: string): string | undefined {
    const candidate = /^[0-9]{2}:[0-9]{2}$/.test(text) ? text + ':00' : text;
    return parseTemporal(candidate, 'TIME', 0) === undefined ? undefined : candidate;
}
