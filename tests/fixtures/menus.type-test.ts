import {
    ThemeShellOutlet,
    type ThemeNavigationItem,
    type MenuDefinition,
    type MenuSelection,
    type MenuPlacement,
    type MenuKind,
} from '../../projects/ui-runtime/src/public-api.js';
const menus: readonly MenuDefinition[] = [
    {
        id: 'one',
        kind: 'primary',
        label: 'One',
        items: [{ id: 'a', label: 'Action', action: 'opaque' }],
    },
    {
        id: 'two',
        kind: 'primary',
        label: 'Two',
        items: [{ id: 'a', label: 'Link', href: '#native' }],
    },
];
const legacy: readonly ThemeNavigationItem[] = [{ id: 'old', label: 'Old action' }];
const placement: MenuPlacement = { menuId: 'one', region: 'tools' };
const selection: MenuSelection = { menuId: 'one', itemId: 'a' };
// @ts-expect-error Semantic kinds are a closed set, independent of region IDs.
const invalid: MenuKind = 'tools';
// @ts-expect-error Definitions are readonly snapshots.
menus[0]!.id = 'changed';
void [menus, legacy, placement, selection, invalid, ThemeShellOutlet];
