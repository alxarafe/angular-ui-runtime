/** SPDX-License-Identifier: Apache-2.0 */
import type { ThemeLinkActivation } from '../structure/link-activation.js';

export type MenuKind = 'primary' | 'secondary' | 'account';
export interface MenuItem {
    readonly id: string;
    readonly label: string;
    readonly action?: string;
    readonly href?: string;
    readonly target?: string;
    readonly download?: string;
    readonly disabled?: boolean;
    readonly current?: boolean;
    readonly children?: readonly MenuItem[];
}
export interface MenuDefinition {
    readonly id: string;
    readonly kind: MenuKind;
    readonly label: string;
    readonly items: readonly MenuItem[];
}
export interface MenuPlacement {
    readonly menuId: string;
    readonly region: string;
}
export interface MenuSelection {
    readonly menuId: string;
    readonly itemId: string;
}
export interface MenuLinkActivation extends ThemeLinkActivation {
    readonly menuId: string;
}
export type MenuLinkActivationHandler = (activation: MenuLinkActivation) => void;
export interface MenuDiagnostic {
    readonly code:
        'invalid-placement' | 'conflicting-placement' | 'unavailable-region' | 'mixed-navigation';
    readonly menuId?: string;
}
export interface ComposedMenu {
    readonly menu: MenuDefinition;
    /** null is the mandatory host-owned overflow. */
    readonly region: string | null;
}
export interface MenuComposition {
    readonly menus: readonly ComposedMenu[];
    readonly diagnostics: readonly MenuDiagnostic[];
}

const record = (value: unknown): value is Record<string, unknown> =>
    !!value &&
    typeof value === 'object' &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value));
const text = (value: unknown): value is string => typeof value === 'string' && !!value.trim();
function fail(): never {
    throw new Error('Invalid menu definition');
}
function array(value: unknown): asserts value is readonly unknown[] {
    if (!Array.isArray(value) || Object.keys(value).length !== value.length) fail();
}
function members(value: Record<string, unknown>, allowed: readonly string[]): void {
    if (Reflect.ownKeys(value).some((key) => typeof key !== 'string' || !allowed.includes(key)))
        fail();
}
/** All-or-nothing admission and defensive immutable snapshot; labels never identify nodes. */
export function snapshotMenus(value: readonly MenuDefinition[]): readonly MenuDefinition[] {
    array(value);
    const menus = new Set<string>();
    return Object.freeze(
        value.map((menu) => {
            if (!record(menu)) fail();
            members(menu, ['id', 'kind', 'label', 'items']);
            if (
                !text(menu['id']) ||
                menus.has(menu['id']) ||
                !text(menu['label']) ||
                !['primary', 'secondary', 'account'].includes(menu['kind'] as string)
            )
                fail();
            menus.add(menu['id']);
            const ids = new Set<string>();
            const ancestors = new Set<object>();
            function items(source: unknown, depth: number): readonly MenuItem[] {
                array(source);
                return Object.freeze(
                    source.map((item) => {
                        if (!record(item) || ancestors.has(item) || depth > 128) fail();
                        members(item, [
                            'id',
                            'label',
                            'action',
                            'href',
                            'target',
                            'download',
                            'disabled',
                            'current',
                            'children',
                        ]);
                        if (!text(item['id']) || ids.has(item['id']) || !text(item['label']))
                            fail();
                        ids.add(item['id']);
                        for (const name of ['action', 'href', 'target'])
                            if (item[name] !== undefined && !text(item[name])) fail();
                        if (item['download'] !== undefined && typeof item['download'] !== 'string')
                            fail();
                        for (const name of ['disabled', 'current'])
                            if (item[name] !== undefined && typeof item[name] !== 'boolean') fail();
                        if (item['action'] !== undefined && item['href'] !== undefined) fail();
                        if (
                            (item['target'] !== undefined || item['download'] !== undefined) &&
                            item['href'] === undefined
                        )
                            fail();
                        ancestors.add(item);
                        const children =
                            item['children'] === undefined
                                ? undefined
                                : items(item['children'], depth + 1);
                        ancestors.delete(item);
                        if (
                            !children?.length &&
                            item['action'] === undefined &&
                            item['href'] === undefined
                        )
                            fail();
                        return Object.freeze({
                            ...item,
                            ...(children === undefined ? {} : { children }),
                        }) as unknown as MenuItem;
                    }),
                );
            }
            return Object.freeze({
                id: menu['id'],
                kind: menu['kind'],
                label: menu['label'],
                items: items(menu['items'], 0),
            }) as MenuDefinition;
        }),
    );
}

/** Regions are mounted shell projection names, excluding application-owned region templates. */
export function composeMenus(
    definitions: readonly MenuDefinition[],
    placements: readonly MenuPlacement[] = [],
    regions: readonly string[] = [],
): MenuComposition {
    const menus = snapshotMenus(definitions);
    const diagnostics: MenuDiagnostic[] = [];
    const assignments = new Map<string, (string | null)[]>();
    const ids = new Set(menus.map((menu) => menu['id']));
    if (!Array.isArray(placements)) throw new Error('Invalid menu placements');
    for (const placement of placements) {
        if (
            !record(placement) ||
            !text(placement['menuId']) ||
            !ids.has(placement['menuId']) ||
            !text(placement['region']) ||
            !/^[a-z][a-z0-9-]*$/.test(placement['region']) ||
            Reflect.ownKeys(placement).some((key) => !['menuId', 'region'].includes(String(key)))
        ) {
            diagnostics.push(
                Object.freeze({
                    code: 'invalid-placement',
                    ...(record(placement) && typeof placement['menuId'] === 'string'
                        ? { menuId: placement['menuId'] }
                        : {}),
                }),
            );
            if (
                record(placement) &&
                typeof placement['menuId'] === 'string' &&
                ids.has(placement['menuId'])
            ) {
                const list = assignments.get(placement['menuId']) ?? [];
                list.push(null);
                assignments.set(placement['menuId'], list);
            }
            continue;
        }
        const list = assignments.get(placement['menuId']) ?? [];
        list.push(placement['region']);
        assignments.set(placement['menuId'], list);
    }
    const result = menus
        .filter((menu) => menu['items'].length)
        .map((menu) => {
            const assigned = assignments.get(menu['id']) ?? [];
            let region: string | null = null;
            if (assigned.length > 1)
                diagnostics.push(
                    Object.freeze({ code: 'conflicting-placement', menuId: menu['id'] }),
                );
            else if (assigned.length === 1 && assigned[0] !== null) {
                if (regions.includes(assigned[0]!)) region = assigned[0]!;
                else
                    diagnostics.push(
                        Object.freeze({ code: 'unavailable-region', menuId: menu['id'] }),
                    );
            }
            return Object.freeze({ menu, region });
        });
    return Object.freeze({ menus: Object.freeze(result), diagnostics: Object.freeze(diagnostics) });
}
