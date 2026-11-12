import {
  Component, EmbeddedViewRef, Injector, Renderer2, TemplateRef, Type, ViewContainerRef,
  effect, inject, input, inputBinding, output, outputBinding,
  reflectComponentType, viewChild,
} from '@angular/core';
import type { ThemeLinkActivationHandler } from './link-activation.js';
import { captureRetainedFocus } from './retained-focus.js';
import { ThemeArtifact } from '../theme/theme-definition.js';
import { ThemeResolver, ThemeService } from '../theme/theme-runtime.js';
import {
  THEME_NAVIGATION_BINDINGS, THEME_REGION_ATTRIBUTE, THEME_SHELL_BINDINGS,
  THEME_SHELL_PROJECTION, ThemeNavigationItem, ThemeNavigationSelection, ThemeRegions,
} from './theme-ports.js';

const REGION_ID = /^[a-z][a-z0-9-]*$/;
const REGION_SELECTOR = /^\[aur-theme-region=(?:"([a-z][a-z0-9-]*)"|'([a-z][a-z0-9-]*)'|([a-z][a-z0-9-]*))\]$/;

/** Internal validation for opt-in hosts; legacy registry admission is unchanged. */
export function structureSelectors(component: Type<unknown>, artifact: 'shell' | 'navigation' | 'panel', requireLinkActivation = false): readonly string[] {
  const mirror = reflectComponentType(component);
  if (!mirror?.isStandalone) throw new Error('Structural ports require a compiled standalone component');
  const bindings = artifact === ThemeArtifact.Shell ? THEME_SHELL_BINDINGS : THEME_NAVIGATION_BINDINGS;
  if (artifact !== ThemeArtifact.Panel) {
    const [name, event] = Object.values(bindings);
    if (!mirror.inputs.some(input => input.templateName === name) ||
        !mirror.outputs.some(output => output.templateName === event))
      throw new Error(`Missing ${artifact} presentation bindings`);
  }
  if (requireLinkActivation && !mirror.inputs.some(input => input.templateName === 'linkActivation'))
    throw new Error(`Missing ${artifact} linkActivation capability`);
  const selectors = mirror.ngContentSelectors.map(selector => {
    const region = REGION_SELECTOR.exec(selector)?.slice(1).find(Boolean);
    return region ? `[${THEME_REGION_ATTRIBUTE}="${region}"]` : selector;
  });
  const shellSelectors: readonly string[] = Object.values(THEME_SHELL_PROJECTION);
  if (artifact === ThemeArtifact.Shell) {
    if (!selectors.includes(THEME_SHELL_PROJECTION.content) || !selectors.includes('*') ||
        new Set(selectors).size !== selectors.length ||
        selectors.some(selector => selector !== '*' &&
          !shellSelectors.includes(selector) &&
          !REGION_SELECTOR.test(selector)))
      throw new Error('Shell requires content and catch-all projection with distinct supported selectors');
  } else if (artifact === ThemeArtifact.Panel && (selectors.length !== 1 || selectors[0] !== '*')) {
    throw new Error('Panel requires exactly one catch-all projection');
  }
  return selectors;
}

// Do not bind an unknown input on legacy structural components when the port is unused.
function linkActivationBindings(component: Type<unknown>, handler: () => ThemeLinkActivationHandler | undefined) {
  return reflectComponentType(component)!.inputs.some(input => input.templateName === 'linkActivation')
    ? [inputBinding('linkActivation', handler)] : [];
}

interface OwnedProjection {
  readonly template: TemplateRef<unknown>;
  readonly view: EmbeddedViewRef<unknown>;
  readonly wrapper: HTMLElement;
}

/** Opt-in shell host. Application views outlive replaceable shell/panel instances. */
@Component({
  selector: 'aur-theme-shell',
  template: '<ng-container #owned /><ng-container #target />',
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
  protected readonly theme = inject(ThemeService);
  private readonly resolver = inject(ThemeResolver);
  private readonly renderer = inject(Renderer2);
  private readonly injector = inject(Injector);
  private readonly owned = viewChild('owned', { read: ViewContainerRef });
  private readonly target = viewChild('target', { read: ViewContainerRef });
  private readonly views = new Map<string, OwnedProjection>();
  private sourceOrder: readonly string[] = [];
  private rendered?: Type<unknown>;

  constructor() {
    effect(() => {
      const owned = this.owned(), target = this.target();
      if (!owned || !target) return;
      const component = this.resolver.resolve(ThemeArtifact.Shell);
      const selectors = structureSelectors(component, ThemeArtifact.Shell, !!this.linkActivation());
      const sources = new Map<string, TemplateRef<unknown>>();
      for (const [name, template] of [['heading', this.heading()], ['content', this.content()], ['footer', this.footer()]] as const)
        if (template) sources.set(THEME_SHELL_PROJECTION[name], template);
      for (const [id, template] of Object.entries(this.regions())) {
        if (!REGION_ID.test(id)) throw new Error('Invalid theme region identity');
        sources.set(`[${THEME_REGION_ATTRIBUTE}="${id}"]`, template);
      }
      const keys = [...sources.keys()];
      const changed = keys.length !== this.sourceOrder.length || keys.some((key, index) => key !== this.sourceOrder[index]) ||
        [...sources].some(([key, template]) => this.views.get(key)?.template !== template);
      if (!changed && component === this.rendered) return;

      const retainedRoots = [...this.views]
        .filter(([key, entry]) => sources.get(key) === entry.template)
        .map(([, entry]) => entry.wrapper);
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
        this.renderer.setAttribute(wrapper, region ? THEME_REGION_ATTRIBUTE : key.slice(1, -1), region?.[1] ?? region?.[2] ?? region?.[3] ?? '');
        for (const node of view.rootNodes) this.renderer.appendChild(wrapper, node);
        this.views.set(key, { template, view, wrapper });
      }
      const projection: Node[][] = selectors.map(() => []);
      for (const [key] of sources) {
        const index = selectors.indexOf(key);
        projection[index >= 0 ? index : selectors.indexOf('*')].push(this.views.get(key)!.wrapper);
      }
      target.createComponent(component, { projectableNodes: projection, bindings: [
        inputBinding(THEME_SHELL_BINDINGS.navigation, this.navigation),
        ...linkActivationBindings(component, this.linkActivation),
        outputBinding<ThemeNavigationSelection>(THEME_SHELL_BINDINGS.navigationSelected, value => this.navigationSelected.emit(value)),
      ] });
      this.rendered = component;
      this.sourceOrder = keys;
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
      target.createComponent(component, { bindings: [
        inputBinding(THEME_NAVIGATION_BINDINGS.items, this.items),
        ...linkActivationBindings(component, this.linkActivation),
        outputBinding<ThemeNavigationSelection>(THEME_NAVIGATION_BINDINGS.selected, value => this.selected.emit(value)),
      ] });
      this.rendered = component;
    });
  }
}

/** Projected views belong to this host, never to the resolved panel component. */
@Component({
  selector: 'aur-theme-panel',
  template: '<ng-template #projected><ng-content /></ng-template><ng-container #owned /><ng-container #target />',
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
      const source = this.projected(), owned = this.owned(), target = this.target();
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
