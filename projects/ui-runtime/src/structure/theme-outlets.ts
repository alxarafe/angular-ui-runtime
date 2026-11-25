import { MenuView } from '../menu/menu-view.js';
import {
    composeMenus,
    type MenuDefinition,
    type MenuPlacement,
    type MenuSelection,
    type MenuLinkActivationHandler,
    type MenuDiagnostic,
} from '../menu/menu-definition.js';
import {
    Component,
    ComponentRef,
    ElementRef,
    computed,
    signal,
    EmbeddedViewRef,
    Injector,
    Renderer2,
    TemplateRef,
    Type,
    ViewContainerRef,
    effect,
    inject,
    input,
    inputBinding,
    output,
    outputBinding,
    reflectComponentType,
    viewChild,
} from '@angular/core';
import type { ThemeLinkActivationHandler } from './link-activation.js';
import { captureRetainedFocus } from './retained-focus.js';
import { ThemeArtifact } from '../theme/theme-definition.js';
import { ThemeResolver, ThemeService } from '../theme/theme-runtime.js';
import {
    THEME_NAVIGATION_BINDINGS,
    THEME_REGION_ATTRIBUTE,
    THEME_SHELL_BINDINGS,
    THEME_SHELL_PROJECTION,
    ThemeNavigationItem,
    ThemeNavigationSelection,
    ThemeRegions,
} from './theme-ports.js';

const REGION_ID = /^[a-z][a-z0-9-]*$/;
const REGION_SELECTOR =
    /^\[aur-theme-region=(?:"([a-z][a-z0-9-]*)"|'([a-z][a-z0-9-]*)'|([a-z][a-z0-9-]*))\]$/;

/** Internal validation for opt-in hosts; legacy registry admission is unchanged. */
export function structureSelectors(
    component: Type<unknown>,
    artifact: 'shell' | 'navigation' | 'panel',
    requireLinkActivation = false,
): readonly string[] {
    const mirror = reflectComponentType(component);
    if (!mirror?.isStandalone)
        throw new Error('Structural ports require a compiled standalone component');
    const bindings =
        artifact === ThemeArtifact.Shell ? THEME_SHELL_BINDINGS : THEME_NAVIGATION_BINDINGS;
    if (artifact !== ThemeArtifact.Panel) {
        const [name, event] = Object.values(bindings);
        if (
            !mirror.inputs.some((input) => input.templateName === name) ||
            !mirror.outputs.some((output) => output.templateName === event)
        )
            throw new Error(`Missing ${artifact} presentation bindings`);
    }
    if (
        requireLinkActivation &&
        !mirror.inputs.some((input) => input.templateName === 'linkActivation')
    )
        throw new Error(`Missing ${artifact} linkActivation capability`);
    const selectors = mirror.ngContentSelectors.map((selector) => {
        const region = REGION_SELECTOR.exec(selector)?.slice(1).find(Boolean);
        return region ? `[${THEME_REGION_ATTRIBUTE}="${region}"]` : selector;
    });
    const shellSelectors: readonly string[] = Object.values(THEME_SHELL_PROJECTION);
    if (artifact === ThemeArtifact.Shell) {
        if (
            !selectors.includes(THEME_SHELL_PROJECTION.content) ||
            !selectors.includes('*') ||
            new Set(selectors).size !== selectors.length ||
            selectors.some(
                (selector) =>
                    selector !== '*' &&
                    !shellSelectors.includes(selector) &&
                    !REGION_SELECTOR.test(selector),
            )
        )
            throw new Error(
                'Shell requires content and catch-all projection with distinct supported selectors',
            );
    } else if (
        artifact === ThemeArtifact.Panel &&
        (selectors.length !== 1 || selectors[0] !== '*')
    ) {
        throw new Error('Panel requires exactly one catch-all projection');
    }
    return selectors;
}

// Do not bind an unknown input on legacy structural components when the port is unused.
function linkActivationBindings(
    component: Type<unknown>,
    handler: () => ThemeLinkActivationHandler | undefined,
) {
    return reflectComponentType(component)!.inputs.some(
        (input) => input.templateName === 'linkActivation',
    )
        ? [inputBinding('linkActivation', handler)]
        : [];
}

interface OwnedProjection {
    readonly template: TemplateRef<unknown>;
    readonly view: EmbeddedViewRef<unknown>;
    readonly wrapper: HTMLElement;
}

/** Opt-in shell host. Application views outlive replaceable shell/panel instances. */
@Component({
    selector: 'aur-theme-shell',
    template: `<ng-container #owned /><ng-container #target />
        @if (menus() !== undefined && fallbackCount()) {
            <button
                type="button"
                #overflowToggle
                [attr.aria-expanded]="overflowOpen()"
                (click)="overflowOpen.set(!overflowOpen())"
            >
                More menus
            </button>
        }
        <section
            aria-label="More menus"
            [hidden]="!overflowOpen() || !fallbackCount()"
            (keydown.escape)="closeOverflow($event)"
        >
            @if (menus() !== undefined && fallbackCount()) {
                <button type="button" (click)="closeOverflow()">Close menus</button>
            }
            <div #overflow></div>
        </section>`,
    styles: [
        ':host{display:block;min-width:0;overflow-wrap:anywhere}button{font:inherit;min-height:2.75rem;max-width:100%;white-space:normal;padding:.5rem}button:focus-visible{outline:3px solid currentColor;outline-offset:2px}[hidden]{display:none!important}section{min-width:0;max-width:100%}',
    ],
    host: { '[class]': 'theme.current().cssClass' },
})
export class ThemeShellOutlet {
    readonly heading = input<TemplateRef<unknown>>();
    readonly content = input.required<TemplateRef<unknown>>();
    readonly footer = input<TemplateRef<unknown>>();
    readonly regions = input<ThemeRegions>({});
    readonly navigation = input<readonly ThemeNavigationItem[]>([]);
    readonly linkActivation = input<ThemeLinkActivationHandler>();
    readonly navigationSelected = output<ThemeNavigationSelection>();
    /** undefined selects legacy mode; even [] explicitly selects typed-menu mode. */
    readonly menus = input<readonly MenuDefinition[]>();
    readonly menuPlacements = input<readonly MenuPlacement[]>([]);
    readonly menuSelected = output<MenuSelection>();
    readonly menuLinkActivation = input<MenuLinkActivationHandler>();
    readonly menuDiagnostics = output<readonly MenuDiagnostic[]>();
    protected readonly overflowOpen = signal(false);
    protected readonly fallbackCount = signal(0);
    private readonly overflow = viewChild<ElementRef<HTMLElement>>('overflow');
    private readonly overflowToggle = viewChild<ElementRef<HTMLButtonElement>>('overflowToggle');
    private readonly menuViews = new Map<string, ComponentRef<MenuView>>();
    private readonly legacyNavigation = computed(() =>
        this.menus() === undefined ? this.navigation() : [],
    );
    protected closeOverflow(event?: Event): void {
        event?.preventDefault();
        this.overflowOpen.set(false);
        this.overflowToggle()?.nativeElement.focus();
    }

    protected readonly theme = inject(ThemeService);
    private readonly resolver = inject(ThemeResolver);
    private readonly renderer = inject(Renderer2);
    private readonly injector = inject(Injector);
    private readonly owned = viewChild('owned', { read: ViewContainerRef });
    private readonly target = viewChild('target', { read: ViewContainerRef });
    private readonly views = new Map<string, OwnedProjection>();
    private sourceOrder: readonly string[] = [];
    private rendered?: Type<unknown>;
    private menuLayout = '';

    constructor() {
        effect(() => {
            const owned = this.owned(),
                target = this.target();
            if (!owned || !target || !this.overflow()) return;
            const component = this.resolver.resolve(ThemeArtifact.Shell);
            const selectors = structureSelectors(
                component,
                ThemeArtifact.Shell,
                this.menus() === undefined && !!this.linkActivation(),
            );
            const suppliedMenus = this.menus();
            const menuLink = this.menuLinkActivation();
            const available = selectors.flatMap((selector) => {
                const name = REGION_SELECTOR.exec(selector)?.slice(1).find(Boolean);
                return name && !Object.hasOwn(this.regions(), name) ? [name] : [];
            });
            // Admit the entire tree before changing any mounted views.
            const composition = composeMenus(suppliedMenus ?? [], this.menuPlacements(), available);
            const diagnostics: readonly MenuDiagnostic[] =
                suppliedMenus !== undefined && this.navigation().length
                    ? [
                          ...composition.diagnostics,
                          Object.freeze({ code: 'mixed-navigation' as const }),
                      ]
                    : composition.diagnostics;
            this.menuDiagnostics.emit(Object.freeze(diagnostics));
            const sources = new Map<string, TemplateRef<unknown>>();
            for (const [name, template] of [
                ['heading', this.heading()],
                ['content', this.content()],
                ['footer', this.footer()],
            ] as const)
                if (template) sources.set(THEME_SHELL_PROJECTION[name], template);
            for (const [id, template] of Object.entries(this.regions())) {
                if (!REGION_ID.test(id)) throw new Error('Invalid theme region identity');
                sources.set(`[${THEME_REGION_ATTRIBUTE}="${id}"]`, template);
            }
            const keys = [...sources.keys()];
            const changed =
                keys.length !== this.sourceOrder.length ||
                keys.some((key, index) => key !== this.sourceOrder[index]) ||
                [...sources].some(([key, template]) => this.views.get(key)?.template !== template);
            const layout = JSON.stringify([
                suppliedMenus !== undefined,
                composition.menus.map((entry) => [entry.menu.id, entry.region]),
            ]);
            if (!changed && component === this.rendered && layout === this.menuLayout) {
                for (const entry of composition.menus) {
                    this.menuViews.get(entry.menu.id)?.setInput('menu', entry.menu);
                    this.menuViews.get(entry.menu.id)?.setInput('linkActivation', menuLink);
                }
                return;
            }
            const focused = this.overflow()!.nativeElement.ownerDocument.activeElement;
            if (
                composition.menus.some(
                    (entry) =>
                        entry.region === null &&
                        this.menuViews.get(entry.menu.id)?.location.nativeElement.contains(focused),
                )
            )
                this.overflowOpen.set(true);

            const retainedRoots = [...this.views]
                .filter(([key, entry]) => sources.get(key) === entry.template)
                .map(([, entry]) => entry.wrapper);
            retainedRoots.push(
                ...[...this.menuViews.values()].map((ref) => ref.location.nativeElement),
            );
            const restoreFocus = captureRetainedFocus(target, retainedRoots, this.injector);
            target.clear();
            for (const [key, entry] of this.views) {
                if (sources.get(key) === entry.template) continue;
                const index = owned.indexOf(entry.view);
                if (index >= 0) owned.remove(index);
                this.views.delete(key);
            }
            for (const [key, template] of sources) {
                if (this.views.has(key)) continue;
                const view = owned.createEmbeddedView(template);
                const wrapper = this.renderer.createElement('div') as HTMLElement;
                const region = REGION_SELECTOR.exec(key);
                this.renderer.setAttribute(
                    wrapper,
                    region ? THEME_REGION_ATTRIBUTE : key.slice(1, -1),
                    region?.[1] ?? region?.[2] ?? region?.[3] ?? '',
                );
                for (const node of view.rootNodes) this.renderer.appendChild(wrapper, node);
                this.views.set(key, { template, view, wrapper });
            }
            const projection: Node[][] = selectors.map(() => []);
            for (const [key] of sources) {
                const index = selectors.indexOf(key);
                projection[index >= 0 ? index : selectors.indexOf('*')].push(
                    this.views.get(key)!.wrapper,
                );
            }
            const active = new Set(composition.menus.map((entry) => entry.menu.id));
            for (const [id, ref] of this.menuViews) {
                if (active.has(id)) continue;
                const index = owned.indexOf(ref.hostView);
                if (index >= 0) owned.remove(index);
                this.menuViews.delete(id);
            }
            let fallbacks = 0;
            for (const entry of composition.menus) {
                let ref = this.menuViews.get(entry.menu.id);
                if (!ref) {
                    ref = owned.createComponent(MenuView, {
                        bindings: [
                            outputBinding<MenuSelection>('selected', (value) =>
                                this.menuSelected.emit(value),
                            ),
                        ],
                    });
                    this.menuViews.set(entry.menu.id, ref);
                }
                ref.setInput('menu', entry.menu);
                ref.setInput('linkActivation', menuLink);
                const node = ref.location.nativeElement;
                if (entry.region === null) {
                    this.renderer.appendChild(this.overflow()!.nativeElement, node);
                    fallbacks++;
                } else {
                    projection[
                        selectors.indexOf(`[${THEME_REGION_ATTRIBUTE}="${entry.region}"]`)
                    ].push(node);
                }
            }
            this.fallbackCount.set(fallbacks);
            target.createComponent(component, {
                projectableNodes: projection,
                bindings: [
                    inputBinding(THEME_SHELL_BINDINGS.navigation, this.legacyNavigation),
                    ...linkActivationBindings(component, () =>
                        this.menus() === undefined ? this.linkActivation() : undefined,
                    ),
                    outputBinding<ThemeNavigationSelection>(
                        THEME_SHELL_BINDINGS.navigationSelected,
                        (value) => {
                            if (this.menus() === undefined) this.navigationSelected.emit(value);
                        },
                    ),
                ],
            });
            this.rendered = component;
            this.sourceOrder = keys;
            this.menuLayout = layout;
            restoreFocus();
        });
    }
}

/** Navigation presentation only: routing, authorization and intent execution stay outside. */
@Component({ selector: 'aur-theme-navigation', template: '<ng-container #target />' })
export class ThemeNavigationOutlet {
    readonly items = input<readonly ThemeNavigationItem[]>([]);
    readonly linkActivation = input<ThemeLinkActivationHandler>();
    readonly selected = output<ThemeNavigationSelection>();
    private readonly target = viewChild('target', { read: ViewContainerRef });
    private readonly resolver = inject(ThemeResolver);
    private rendered?: Type<unknown>;
    constructor() {
        effect(() => {
            const target = this.target();
            if (!target) return;
            const component = this.resolver.resolve(ThemeArtifact.Navigation);
            structureSelectors(component, ThemeArtifact.Navigation, !!this.linkActivation());
            if (component === this.rendered) return;
            target.clear();
            target.createComponent(component, {
                bindings: [
                    inputBinding(THEME_NAVIGATION_BINDINGS.items, this.items),
                    ...linkActivationBindings(component, this.linkActivation),
                    outputBinding<ThemeNavigationSelection>(
                        THEME_NAVIGATION_BINDINGS.selected,
                        (value) => this.selected.emit(value),
                    ),
                ],
            });
            this.rendered = component;
        });
    }
}

/** Projected views belong to this host, never to the resolved panel component. */
@Component({
    selector: 'aur-theme-panel',
    template:
        '<ng-template #projected><ng-content /></ng-template><ng-container #owned /><ng-container #target />',
})
export class ThemePanelOutlet {
    private readonly projected = viewChild<TemplateRef<unknown>>('projected');
    private readonly owned = viewChild('owned', { read: ViewContainerRef });
    private readonly target = viewChild('target', { read: ViewContainerRef });
    private readonly resolver = inject(ThemeResolver);
    private readonly injector = inject(Injector);
    private view?: EmbeddedViewRef<unknown>;
    private rendered?: Type<unknown>;
    constructor() {
        effect(() => {
            const source = this.projected(),
                owned = this.owned(),
                target = this.target();
            if (!source || !owned || !target) return;
            const component = this.resolver.resolve(ThemeArtifact.Panel);
            if (component === this.rendered) return;
            structureSelectors(component, ThemeArtifact.Panel);
            this.view ??= owned.createEmbeddedView(source);
            const restoreFocus = captureRetainedFocus(target, this.view.rootNodes, this.injector);
            target.clear();
            target.createComponent(component, { projectableNodes: [this.view.rootNodes] });
            this.rendered = component;
            restoreFocus();
        });
    }
}
