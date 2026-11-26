/** SPDX-License-Identifier: Apache-2.0 */
import type { TemporalConstraints } from './validate-field.js';
export type TemporalKind = 'DATE' | 'TIME' | 'DATETIME';
const secondTicks = 10000000n;
const dayTicks = 86400n * secondTicks;
function leap(year: bigint): boolean {
    return year % 4n === 0n && (year % 100n !== 0n || year % 400n === 0n);
}
function monthDays(year: bigint, month: bigint): bigint {
    if (month === 2n) return leap(year) ? 29n : 28n;
    return [4n, 6n, 9n, 11n].includes(month) ? 30n : 31n;
}
function precedingDays(year: bigint): bigint {
    const previous = year - 1n;
    return 365n * previous + previous / 4n - previous / 100n + previous / 400n;
}
const dateDays = precedingDays(10000n);
function dateOrdinal(text: string): bigint | undefined {
    if (text.length !== 10) return undefined;
    const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(text);
    if (!match || match[0] !== text) return undefined;
    const year = BigInt(match[1]!),
        month = BigInt(match[2]!),
        day = BigInt(match[3]!);
    if (
        year < 1n ||
        year > 9999n ||
        month < 1n ||
        month > 12n ||
        day < 1n ||
        day > monthDays(year, month)
    )
        return undefined;
    let ordinal = precedingDays(year) + day - 1n;
    for (let m = 1n; m < month; m++) ordinal += monthDays(year, m);
    return ordinal;
}
function localTicks(text: string, fractionalDigits: number): bigint | undefined {
    if (text.length < 8 || text.length > 16) return undefined;
    const match = /^([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.([0-9]{1,7}))?$/.exec(text);
    if (!match || match[0] !== text || (match[4]?.length ?? 0) > fractionalDigits) return undefined;
    const hour = BigInt(match[1]!),
        minute = BigInt(match[2]!),
        second = BigInt(match[3]!);
    if (hour > 23n || minute > 59n || second > 59n) return undefined;
    return (
        ((hour * 60n + minute) * 60n + second) * secondTicks +
        BigInt((match[4] ?? '').padEnd(7, '0'))
    );
}
/** Strict, fixed-size profiles. Definitions have already admitted fractionalDigits.
 * DATE uses ordinal days from 0001-01-01; clocks/instants use exact 100 ns ticks.
 */
export function parseTemporal(
    text: string,
    type: TemporalKind,
    fractionalDigits: number,
): bigint | undefined {
    if (type === 'DATE') return dateOrdinal(text);
    if (type === 'TIME') return localTicks(text, fractionalDigits);
    if (text.length < 20 || text.length > 33) return undefined;
    const match =
        /^([0-9]{4}-[0-9]{2}-[0-9]{2})T([0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,7})?)(Z|[+-][0-9]{2}:[0-9]{2})$/.exec(
            text,
        );
    if (!match || match[0] !== text) return undefined;
    const date = dateOrdinal(match[1]!),
        time = localTicks(match[2]!, fractionalDigits);
    if (date === undefined || time === undefined) return undefined;
    const offset = match[3]!;
    let minutes = 0n;
    if (offset !== 'Z') {
        const hour = BigInt(offset.slice(1, 3)),
            minute = BigInt(offset.slice(4, 6));
        if (hour > 14n || minute > 59n || (hour === 14n && minute !== 0n)) return undefined;
        minutes = (hour * 60n + minute) * (offset[0] === '-' ? -1n : 1n);
    }
    const instant = date * dayTicks + time - minutes * 60n * secondTicks;
    return instant < 0n || instant >= dateDays * dayTicks ? undefined : instant;
}
/** Intrinsic domains and representable grids for contradiction detection, not normalization. */
export function temporalDomain(type: TemporalKind, fractionalDigits: number) {
    const step = type === 'DATE' ? 1n : 10n ** BigInt(7 - fractionalDigits);
    const end = type === 'DATE' ? dateDays : type === 'TIME' ? dayTicks : dateDays * dayTicks;
    return { minimum: 0n, maximum: end - step, step };
}
export function canonicalUuid(text: string, casing: 'lower' | 'either'): boolean {
    if (text.length !== 36) return false;
    const match = (
        casing === 'lower'
            ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
            : /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
    ).exec(text);
    return !!match && match[0] === text;
}

/** Translate admitted DATE bounds to inclusive native hints without changing field values. */
export function dateInputBounds(constraints?: TemporalConstraints): { min: string; max: string } {
    const intrinsic = { min: '0001-01-01', max: '9999-12-31' };
    function endpoint(
        bound: TemporalConstraints['minimum'],
        direction: 1 | -1,
    ): string | undefined {
        if (
            !bound ||
            typeof bound.value !== 'string' ||
            parseTemporal(bound.value, 'DATE', 0) === undefined
        )
            return undefined;
        if (!bound.exclusive) return bound.value;
        let year = BigInt(bound.value.slice(0, 4)),
            month = BigInt(bound.value.slice(5, 7)),
            day = BigInt(bound.value.slice(8, 10)) + BigInt(direction);
        if (day > monthDays(year, month)) {
            day = 1n;
            if (++month > 12n) {
                month = 1n;
                year++;
            }
        } else if (day < 1n) {
            if (--month < 1n) {
                month = 12n;
                year--;
            }
            day = monthDays(year, month);
        }
        if (year < 1n || year > 9999n) return '';
        return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    const min = endpoint(constraints?.minimum, 1),
        max = endpoint(constraints?.maximum, -1);
    // A reversed range disables every native date when an exclusive endpoint exhausts the domain.
    if (min === '' || max === '') return { min: intrinsic.max, max: intrinsic.min };
    return { min: min ?? intrinsic.min, max: max ?? intrinsic.max };
}
