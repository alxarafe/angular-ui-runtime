/** SPDX-License-Identifier: Apache-2.0 */
import { gridIdentity } from './grid-definition.js';
import {
    snapshotChoiceOptions,
    type ChoiceOption,
    type ChoicePageDirection,
} from '../selector/choice-options.js';

export interface ListSelectionChange {
    readonly key: string;
    readonly selected: boolean;
}
/** Availability is application supplied; totals never imply a data source or row-count heuristic. */
export interface ListPaging {
    readonly offset: number;
    readonly pageSize: number;
    readonly total?: number;
    readonly previous: boolean;
    readonly next: boolean;
}
export interface ListPageChange {
    readonly direction: ChoicePageDirection;
    readonly offset: number;
    readonly pageSize: number;
}
/** A presentation input identity, not a backend field, filter operator or query expression. */
export interface ListQueryInput {
    readonly id: string;
    readonly label: string;
    readonly value: string;
    readonly choices?: readonly ChoiceOption[];
    readonly disabled?: boolean;
    readonly readOnly?: boolean;
    readonly message?: string;
}
export interface ListQuery {
    readonly inputs: readonly ListQueryInput[];
    readonly applyLabel?: string;
}
export interface ListQueryChange {
    readonly id: string;
    readonly value: string;
}
export function validateSelectedKeys(keys: readonly string[]): void {
    if (!Array.isArray(keys)) throw new Error('Invalid selected keys');
    const seen = new Set<string>();
    for (const key of keys) {
        gridIdentity(key);
        if (seen.has(key)) throw new Error('Duplicate selected key');
        seen.add(key);
    }
}
export function validateListPaging(page: ListPaging): void {
    if (
        !page ||
        !Number.isSafeInteger(page.offset) ||
        page.offset < 0 ||
        !Number.isSafeInteger(page.pageSize) ||
        page.pageSize < 1 ||
        (page.total !== undefined && (!Number.isSafeInteger(page.total) || page.total < 0)) ||
        typeof page.previous !== 'boolean' ||
        typeof page.next !== 'boolean'
    )
        throw new Error('Invalid list paging');
}
export function snapshotListQuery(query: ListQuery): ListQuery {
    if (!query || !Array.isArray(query.inputs)) throw new Error('Invalid list query inputs');
    if (query.applyLabel !== undefined) gridIdentity(query.applyLabel);
    const ids = new Set<string>();
    return Object.freeze({
        ...query,
        inputs: Object.freeze(
            Array.from(query.inputs, (input) => {
                gridIdentity(input?.id);
                gridIdentity(input.label);
                if (ids.has(input.id)) throw new Error('Duplicate list query identity');
                ids.add(input.id);
                if (
                    typeof input.value !== 'string' ||
                    [input.disabled, input.readOnly].some(
                        (flag) => flag !== undefined && typeof flag !== 'boolean',
                    ) ||
                    (input.message !== undefined && typeof input.message !== 'string')
                )
                    throw new Error('Invalid list query input');
                const choices =
                    input.choices === undefined
                        ? undefined
                        : snapshotChoiceOptions({
                              options: input.choices,
                              previous: false,
                              next: false,
                          }).options;
                if (choices && !choices.some((choice) => choice.value === input.value))
                    throw new Error('Unknown list query choice');
                return Object.freeze({ ...input, ...(choices ? { choices } : {}) });
            }),
        ),
    });
}
