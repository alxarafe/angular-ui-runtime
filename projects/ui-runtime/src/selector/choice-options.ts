/** SPDX-License-Identifier: Apache-2.0 */
/** Opaque application-owned identity, never parsed or derived from its label. */
export interface ChoiceOption {
    readonly value: string;
    readonly label: string;
}
export type ChoicePageDirection = 'previous' | 'next';
/** One immutable page. Applications own queries, request ordering and wire conversion. */
export interface ChoiceSelectorOptions {
    readonly options: readonly ChoiceOption[];
    readonly previous: boolean;
    readonly next: boolean;
    /** Label for the current value, including when it is outside this page. */
    readonly current?: ChoiceOption;
    readonly pageLabel?: string;
    readonly busy?: boolean;
    readonly error?: string;
}
export function snapshotChoiceOptions(page: ChoiceSelectorOptions): ChoiceSelectorOptions {
    if (
        !page ||
        !Array.isArray(page.options) ||
        typeof page.previous !== 'boolean' ||
        typeof page.next !== 'boolean' ||
        (page.busy !== undefined && typeof page.busy !== 'boolean') ||
        [page.pageLabel, page.error].some(
            (value) => value !== undefined && typeof value !== 'string',
        ) ||
        (page.current !== undefined &&
            (!page.current ||
                typeof page.current.value !== 'string' ||
                typeof page.current.label !== 'string')) ||
        Array.from(page.options).some(
            (option) =>
                !option || typeof option.value !== 'string' || typeof option.label !== 'string',
        ) ||
        new Set(page.options.map((option) => option.value)).size !== page.options.length
    )
        throw new Error('Invalid choice selector page');
    return Object.freeze({
        ...page,
        ...(page.current ? { current: Object.freeze({ ...page.current }) } : {}),
        options: Object.freeze(page.options.map((option) => Object.freeze({ ...option }))),
    });
}
