/** SPDX-License-Identifier: Apache-2.0 */
import { Component, input, output } from '@angular/core';
import { activateThemeLink } from '../structure/link-activation.js';
import type {
    MenuDefinition,
    MenuItem,
    MenuSelection,
    MenuLinkActivationHandler,
} from './menu-definition.js';

const styles = `:host{display:block;min-width:0;max-width:100%;overflow-wrap:anywhere}ul{list-style:none;margin:0;padding:.25rem}li{min-width:0}ul ul{padding-inline-start:1rem}a,button,summary{box-sizing:border-box;max-width:100%;white-space:normal;overflow-wrap:anywhere;font:inherit;min-height:2.75rem;padding:.5rem;color:inherit}button{cursor:pointer}a{display:inline-block}a:focus-visible,button:focus-visible,summary:focus-visible{outline:3px solid currentColor;outline-offset:2px}h2{font:inherit;font-weight:bold;overflow-wrap:anywhere}details{min-width:0}`;
@Component({
    selector: 'aur-menu-item-control',
    template: `@if (item().href && !blocked() && !item().disabled) {
            <a
                [href]="item().href"
                [attr.target]="item().target ?? null"
                [attr.download]="item().download ?? null"
                [attr.aria-current]="item().current ? 'page' : null"
                (click)="link(item(), $event)"
                >{{ item().label }}</a
            >
        } @else {
            <button
                type="button"
                [disabled]="blocked() || item().disabled"
                [attr.aria-current]="item().current ? 'page' : null"
                (click)="activate(item())"
            >
                {{ item().label }}
            </button>
        }`,
    styles: [styles],
})
class MenuItemControl {
    readonly item = input.required<MenuItem>();
    readonly menuId = input.required<string>();
    readonly blocked = input(false);
    readonly linkActivation = input<MenuLinkActivationHandler>();
    readonly selected = output<MenuSelection>();
    activate(item: MenuItem): void {
        if (!this.blocked() && !item.disabled && item.action)
            this.selected.emit({ menuId: this.menuId(), itemId: item.id });
    }
    link(item: MenuItem, event: MouseEvent): void {
        activateThemeLink(item, event, (activation) =>
            this.linkActivation()?.(
                Object.freeze({
                    menuId: this.menuId(),
                    itemId: activation.itemId,
                    href: activation.href,
                    get defaultPrevented() {
                        return activation.defaultPrevented;
                    },
                    preventDefault: () => activation.preventDefault(),
                }),
            ),
        );
    }
}

@Component({
    selector: 'aur-menu-items',
    imports: [MenuItemsView, MenuItemControl],
    styles: [styles],
    template: `<ul>
        @for (item of items(); track item.id) {
            <li [attr.data-aur-menu-item]="item.id">
                @if (item.children?.length) {
                    <details>
                        <summary
                            [attr.aria-current]="item.current ? 'page' : null"
                            [attr.aria-disabled]="blocked() || item.disabled ? 'true' : null"
                        >
                            {{ item.label }}
                        </summary>
                        @if (item.action || item.href) {
                            <aur-menu-item-control
                                [item]="item"
                                [menuId]="menuId()"
                                [blocked]="blocked()"
                                [linkActivation]="linkActivation()"
                                (selected)="selected.emit($event)"
                            />
                        }
                        <aur-menu-items
                            [items]="item.children!"
                            [menuId]="menuId()"
                            [blocked]="blocked() || !!item.disabled"
                            [linkActivation]="linkActivation()"
                            (selected)="selected.emit($event)"
                        />
                    </details>
                } @else {
                    <aur-menu-item-control
                        [item]="item"
                        [menuId]="menuId()"
                        [blocked]="blocked()"
                        [linkActivation]="linkActivation()"
                        (selected)="selected.emit($event)"
                    />
                }
            </li>
        }
    </ul>`,
})
class MenuItemsView {
    readonly items = input.required<readonly MenuItem[]>();
    readonly menuId = input.required<string>();
    readonly blocked = input(false);
    readonly linkActivation = input<MenuLinkActivationHandler>();
    readonly selected = output<MenuSelection>();
}

@Component({
    selector: 'aur-menu-view',
    imports: [MenuItemsView],
    template: `<nav [attr.aria-label]="menu().label" [attr.data-aur-menu]="menu().id">
        <h2>{{ menu().label }}</h2>
        <aur-menu-items
            [menuId]="menu().id"
            [items]="menu().items"
            [linkActivation]="linkActivation()"
            (selected)="selected.emit($event)"
        />
    </nav>`,
    styles: [styles],
})
export class MenuView {
    readonly menu = input.required<MenuDefinition>();
    readonly selected = output<MenuSelection>();
    readonly linkActivation = input<MenuLinkActivationHandler>();
}
