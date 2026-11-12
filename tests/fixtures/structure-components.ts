import { Component, input, output } from '@angular/core';
import {
  ThemeNavigationComponent, ThemeNavigationItem, ThemeNavigationSelection, ThemeShellComponent,
} from '../../projects/ui-runtime/src/public-api.js';

@Component({ template: '<ng-content select="[aur-shell-content]" /><ng-content select="[aur-theme-region=tools]" /><ng-content />' })
export class ShellPortProbe implements ThemeShellComponent {
  readonly navigation = input<readonly ThemeNavigationItem[]>([]);
  readonly navigationSelected = output<ThemeNavigationSelection>();
}
@Component({ template: '' })
export class NavigationPortProbe implements ThemeNavigationComponent {
  readonly items = input<readonly ThemeNavigationItem[]>([]);
  readonly selected = output<ThemeNavigationSelection>();
}
@Component({ template: '<ng-content />' })
export class PanelPortProbe {}
@Component({ template: '<ng-content select="[aur-shell-content]" />' })
export class MissingCatchAllProbe implements ThemeShellComponent {
  readonly navigation = input<readonly ThemeNavigationItem[]>([]);
  readonly navigationSelected = output<ThemeNavigationSelection>();
}
@Component({ template: '<ng-content select="[aur-shell-content]" /><ng-content select=".private-app-slot" /><ng-content />' })
export class UnsupportedSelectorProbe implements ThemeShellComponent {
  readonly navigation = input<readonly ThemeNavigationItem[]>([]);
  readonly navigationSelected = output<ThemeNavigationSelection>();
}
@Component({ template: '<ng-content select="[aur-shell-content]" /><ng-content />' })
export class MissingShellBindingsProbe {}
@Component({ template: '<ng-content select="[private]" />' })
export class InvalidPanelProjectionProbe {}
@Component({ template: '' })
export class MissingNavigationOutputProbe {
  readonly items = input<readonly ThemeNavigationItem[]>([]);
}

const tree: readonly ThemeNavigationItem[] = [{
  id: 'group', label: 'Group', children: [{ id: 'draft', label: 'Draft', href: '#draft', current: true }],
}];
const intent: ThemeNavigationSelection = { itemId: 'draft' };
// @ts-expect-error Ports do not introduce an application router flag.
const routerItem: ThemeNavigationItem = { id: 'route', label: 'Route', applicationRoute: true };
// @ts-expect-error Intent never carries an executable business callback.
const operation: ThemeNavigationSelection = { itemId: 'draft', execute: () => {} };
// @ts-expect-error Navigation inputs are immutable snapshots.
tree.push({ id: 'other', label: 'Other' });
void [intent, routerItem, operation];
