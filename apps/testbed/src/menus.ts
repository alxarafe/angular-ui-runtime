/** Installed-APF synthetic menu ownership and placement QA. */
import { Component, inject, input, output, signal } from '@angular/core';
import {
    ThemeShellOutlet,
    ThemePanelOutlet,
    ThemeService,
    type ThemeShellComponent,
    type ThemeNavigationItem,
    type ThemeNavigationSelection,
    type ThemeDefinition,
    type MenuDefinition,
    type MenuPlacement,
    type MenuDiagnostic,
    type MenuLinkActivationHandler,
} from '@alxarafe/ui-runtime';
import { DEFAULT_PACKAGE_THEMES } from './default-theme';
@Component({
    selector: 'qa-menu-region-shell',
    imports: [ThemePanelOutlet],
    template: `<header><ng-content select="[aur-shell-heading]" /></header>
        <aside aria-label="Special menu region">
            <ng-content select='[aur-theme-region="tools"]' />
        </aside>
        <main>
            <aur-theme-panel><ng-content select="[aur-shell-content]" /></aur-theme-panel>
        </main>
        <ng-content />`,
})
class MenuRegionShell implements ThemeShellComponent {
    readonly navigation = input<readonly ThemeNavigationItem[]>([]);
    readonly navigationSelected = output<ThemeNavigationSelection>();
}
export const MENU_THEMES: readonly ThemeDefinition[] = [
    ...DEFAULT_PACKAGE_THEMES,
    { id: 'menu-regions', cssClass: 'aur-default', overrides: { shell: MenuRegionShell } },
];
export const QA_MENUS: readonly MenuDefinition[] = ['primary', 'secondary', 'account'].flatMap(
    (kind) =>
        [0, 1].map((n) => ({
            id: kind + n,
            kind: kind as 'primary' | 'secondary' | 'account',
            label:
                kind +
                ' ' +
                n +
                ' — A very long menu label with repeated words and a verylongunbrokentokenabcdefghijklmnopqrstuv',
            items: [
                {
                    id: 'group',
                    current: n === 0,
                    label: 'Repeated group',
                    children: [
                        { id: 'action', label: 'Repeated action', action: 'opaque' },
                        {
                            id: 'disabled',
                            label: 'Disabled action',
                            action: 'opaque',
                            disabled: true,
                        },
                    ],
                },
                { id: 'native', label: 'Native link', href: '#native', current: n === 0 },
            ],
        })),
);
@Component({
    selector: 'qa-testbed',
    imports: [ThemeShellOutlet],
    template: `<h1>Typed menu QA</h1>
        <div class="themes">
            @for (id of themes; track id) {
                <button (click)="theme.activate(id)">{{ id }}</button>
            }
        </div>
        <button (click)="menus.set([])">Zero menus</button
        ><button (click)="menus.set([all[0]!])">One menu</button
        ><button (click)="menus.set(all)">Many menus</button>
        <output data-testid="menu-intent">{{ intent() }}</output><output
            data-testid="menu-diagnostics"
            >{{ diagnostics() }}</output
        ><output data-testid="menu-links">{{ links() }}</output>
        <aur-theme-shell
            [content]="content"
            [menus]="menus()"
            [menuPlacements]="placements"
            [navigation]="legacy"
            [menuLinkActivation]="link"
            (menuSelected)="intent.set($event.menuId + '/' + $event.itemId)"
            (menuDiagnostics)="diagnose($event)"
        />
        <ng-template #content
            ><label>Owned draft<input aria-label="Owned draft" value="Unsaved" /></label>
            <p id="native">Native destination</p></ng-template
        >`,
    styles: [
        ':host{display:block;min-width:0;max-width:100%;padding:.5rem;box-sizing:border-box}.themes{display:flex;flex-wrap:wrap;gap:.3rem}button,input{font:inherit;max-width:100%;box-sizing:border-box}output{display:block;overflow-wrap:anywhere}',
    ],
})
export class MenusTestbed {
    readonly theme = inject(ThemeService);
    readonly themes = [
        'default',
        'alternative',
        'cyberpunk',
        'vintage',
        'high-contrast',
        'menu-regions',
    ];
    readonly all = QA_MENUS;
    readonly menus = signal<readonly MenuDefinition[]>(QA_MENUS);
    readonly legacy: readonly ThemeNavigationItem[] = [
        { id: 'legacy', label: 'Legacy should be suppressed' },
    ];
    readonly placements: readonly MenuPlacement[] = [
        { menuId: 'primary0', region: 'tools' },
        { menuId: 'primary1', region: 'unknown' },
        { menuId: 'account0', region: 'tools' },
        { menuId: 'account0', region: 'tools' },
    ];
    readonly intent = signal('');
    readonly diagnostics = signal('');
    readonly links = signal(0);
    readonly link: MenuLinkActivationHandler = (activation) => {
        activation.preventDefault();
        this.links.update((n) => n + 1);
        this.intent.set(activation.menuId + '/' + activation.itemId);
    };
    diagnose(diagnostics: readonly MenuDiagnostic[]): void {
        this.diagnostics.set(diagnostics.map((d) => d.code).join(','));
    }
}
