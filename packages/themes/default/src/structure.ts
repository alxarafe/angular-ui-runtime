/** SPDX-License-Identifier: Apache-2.0; adapted from ERBAS; see NOTICE. */
import { Component, input, output } from '@angular/core';
import {
  ThemeNavigationOutlet, ThemePanelOutlet, activateThemeLink, type ThemeLinkActivationHandler,
  type ThemeShellComponent, type ThemeNavigationComponent,
  type ThemeNavigationItem, type ThemeNavigationSelection,
} from '@alxarafe/ui-runtime';

@Component({
  selector: 'aur-default-navigation-tree', imports: [NavigationTree],
  template: `
    <ul>
      @for (item of items(); track item.id) {
        <li>
          @if (item.disabled) {
            <span aria-disabled="true">{{ item.label }}</span>
          } @else if (item.href) {
            <a [href]="item.href" [attr.target]="item.target ?? null" [attr.download]="item.download ?? null" (click)="activateLink(item, $event, linkActivation())" [attr.aria-current]="item.current ? 'page' : null">{{ item.label }}</a>
          } @else if (item.children?.length) {
            <span>{{ item.label }}</span>
          } @else {
            <button type="button" (click)="selected.emit({ itemId: item.id })">{{ item.label }}</button>
          }
          @if (!item.disabled && item.children?.length) {
            <aur-default-navigation-tree [items]="item.children!" [linkActivation]="linkActivation()" (selected)="selected.emit($event)" />
          }
        </li>
      }
    </ul>`,
})
class NavigationTree {
  readonly items = input<readonly ThemeNavigationItem[]>([]);
  readonly linkActivation = input<ThemeLinkActivationHandler>();
  readonly activateLink = activateThemeLink;
  readonly selected = output<ThemeNavigationSelection>();
}

@Component({
  selector: 'aur-default-navigation', imports: [NavigationTree],
  template: '<nav aria-label="Application sections"><aur-default-navigation-tree [items]="items()" [linkActivation]="linkActivation()" (selected)="selected.emit($event)" /></nav>',
})
export class DefaultNavigation implements ThemeNavigationComponent {
  readonly items = input<readonly ThemeNavigationItem[]>([]);
  readonly linkActivation = input<ThemeLinkActivationHandler>();
  readonly selected = output<ThemeNavigationSelection>();
}

@Component({ selector: 'aur-default-panel', template: '<div class="aur-default-panel"><ng-content /></div>' })
export class DefaultPanel {}

@Component({
  selector: 'aur-default-shell', imports: [ThemeNavigationOutlet, ThemePanelOutlet],
  templateUrl: './shell.html',
})
export class DefaultShell implements ThemeShellComponent {
  readonly navigation = input<readonly ThemeNavigationItem[]>([]);
  readonly linkActivation = input<ThemeLinkActivationHandler>();
  readonly navigationSelected = output<ThemeNavigationSelection>();
}
