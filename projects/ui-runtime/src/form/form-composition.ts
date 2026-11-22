/** SPDX-License-Identifier: Apache-2.0 */
import {
  Component, ElementRef, EmbeddedViewRef, Injector, TemplateRef, Type, ViewContainerRef,
  afterNextRender, computed, effect, inject, input, inputBinding, output, outputBinding, signal, viewChild,
} from '@angular/core';
import type { FieldValue, FieldRenderer, FieldRendererContext } from '../field-types/renderer-context.js';
import { ThemeResolver, ThemeService } from '../theme/theme-runtime.js';
import { captureRetainedFocus } from '../structure/retained-focus.js';
import { validateFormContexts } from './form-contexts.js';
import { composeForm, formPathKey, type ComposedSection, type ComposedTab } from './compose-form.js';
import type { ContextAction, FormDefinition, FormFieldContexts, FormField, FormFieldChange, FormLayout, FormPresentationContext, FormViewState, ValuePath } from './form-definition.js';

@Component({ selector: 'aur-form-frame', template: '<ng-template #projected><ng-content /></ng-template><ng-container #owned /><ng-container #target />' })
class FormFrame {
  readonly context = input.required<FormPresentationContext>();
  private readonly source = viewChild<TemplateRef<unknown>>('projected');
  private readonly owned = viewChild('owned', { read: ViewContainerRef });
  private readonly target = viewChild('target', { read: ViewContainerRef });
  private readonly resolver = inject(ThemeResolver);
  private readonly injector = inject(Injector);
  private view?: EmbeddedViewRef<unknown>;
  private rendered?: Type<unknown>;
  private generation = 0;
  constructor() {
    effect(() => {
      const source = this.source(), owned = this.owned(), target = this.target();
      if (!source || !owned || !target) return;
      const component = this.resolver.resolveComponent('form');
      if (component === this.rendered) return;
      this.view ??= owned.createEmbeddedView(source);
      const roots = this.view.rootNodes as Node[];
      const document = target.element.nativeElement.ownerDocument as Document;
      const active = document.activeElement as HTMLElement | null;
      const focused = active && roots.some(root => root.contains(active)) ? active : null;
      const generation = ++this.generation;
      const restore = captureRetainedFocus(target, roots, this.injector);
      target.clear();
      target.createComponent(component, { projectableNodes: [this.view.rootNodes], bindings: [inputBinding('context', this.context)] });
      this.rendered = component;
      restore();
      // A nested field renderer may also be replaced in this render. Retained-node
      // restoration handles surviving controls; map only a destroyed focused node.
      if (focused?.id) afterNextRender(() => {
        if (generation !== this.generation || this.view?.destroyed || focused.isConnected || document.activeElement !== document.body) return;
        for (const root of roots) {
          if (root.nodeType !== 1 || !root.isConnected) continue;
          const replacement = [...(root as HTMLElement).querySelectorAll<HTMLElement>('[id]')].find(node => node.id === focused.id);
          if (replacement) { replacement.focus({ preventScroll: true }); break; }
        }
      }, { injector: this.injector });
    });
  }
}
@Component({ selector: 'aur-form-field', template: '<ng-container #target />', host: { '[attr.data-aur-field]': 'field().id' } })
class FormFieldOutlet {
  readonly field = input.required<FormField>();
  readonly context = input.required<FieldRendererContext>();
  readonly readOnly = input(false);
  readonly fieldChange = output<FormFieldChange>();
  private readonly boundContext = computed(() => ({ ...this.context(), readOnly: this.readOnly() || this.context().readOnly }));
  private readonly target = viewChild('target', { read: ViewContainerRef });
  private readonly root = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly resolver = inject(ThemeResolver);
  private readonly injector = inject(Injector);
  private rendered?: Type<FieldRenderer>;
  private generation = 0;
  constructor() {
    effect(() => {
      const target = this.target();
      if (!target) return;
      const component = this.resolver.resolve(this.field().artifact);
      if (component === this.rendered) return;
      const root = this.root.nativeElement, document = root.ownerDocument;
      const active = document.activeElement;
      const focused = !!active && root.contains(active);
      const logicalId = active?.id;
      const generation = ++this.generation;
      target.clear();
      target.createComponent(component, { bindings: [inputBinding('context', this.boundContext), outputBinding<FieldValue>('valueChange', value => {
        const field = this.field();
        if (!this.boundContext().disabled && !this.boundContext().readOnly)
          this.fieldChange.emit({ id: field.id, path: field.path, value });
      })] });
      this.rendered = component;
      if (focused) afterNextRender(() => {
        if (generation !== this.generation || !root.isConnected || document.activeElement !== document.body) return;
        const elements = [...root.querySelectorAll<HTMLElement>('[id]')];
        const replacement = elements.find(element => element.id === logicalId) ?? root.querySelector<HTMLElement>('input,select,textarea,button');
        replacement?.focus({ preventScroll: true });
      }, { injector: this.injector });
    });
  }
}

/** Application data is input/output only; the host owns solely visual navigation state. */
@Component({
  selector: 'aur-form', imports: [FormFrame, FormFieldOutlet],
  host: { '[class]': 'theme.current().cssClass' },
  template: `
    <aur-form-frame [context]="definition()">
      <form [attr.aria-labelledby]="domId('heading')" (submit)="$event.preventDefault()">
        <h2 [id]="domId('heading')">{{ definition().label }}</h2>
        @if (composition().diagnostics.length) {
          <div role="status" aria-label="Form layout diagnostics">
            <p>Some layout references could not be placed. Eligible omitted fields remain available below.</p>
            <ul>@for (diagnostic of composition().diagnostics; track $index) { <li>{{ diagnostic.code }}: {{ diagnostic.id ?? encode(diagnostic.path) }}</li> }</ul>
          </div>
        }
        <div role="group" aria-label="Form actions">
          @for (action of composition().actions; track action.id) {
            <button type="button" [disabled]="!action.enabled" (click)="dispatch(action)">{{ action.label }}</button>
          }
        </div>
        @if (composition().tabs.length) {
          <div role="tablist" [attr.aria-label]="definition().label + ' tabs'">
            @for (tab of composition().tabs; track tab.id; let index = $index) {
              <button type="button" role="tab" [id]="domId('tab', tab.id)" [attr.data-aur-tab]="tab.id"
                [attr.aria-controls]="domId('panel', tab.id)" [attr.aria-selected]="selectedTab() === tab.id"
                [tabIndex]="selectedTab() === tab.id ? 0 : -1" (click)="selectTab(tab.id)" (keydown)="tabKey($event, index)">{{ tab.label || tab.id }}</button>
            }
          </div>
          @for (tab of composition().tabs; track tab.id) {
            <div role="tabpanel" [id]="domId('panel', tab.id)" [attr.aria-labelledby]="domId('tab', tab.id)"
              [hidden]="selectedTab() !== tab.id" tabindex="0">
              <div role="group" [attr.aria-label]="(tab.label || tab.id) + ' actions'">
                @for (action of tab.actions; track action.id) {
                  <button type="button" [disabled]="!action.enabled" (click)="dispatch(action)">{{ action.label }}</button>
                }
              </div>
              @if (!tab.sections.length && !tab.actions.length) { <p>No fields in this tab.</p> }
              @for (section of tab.sections; track section.id) {
                <section [attr.aria-labelledby]="domId('section', tab.id, section.id)">
                  <h3 [id]="domId('section', tab.id, section.id)">
                    @if (section.collapsible) {
                      <button type="button" [attr.aria-expanded]="!collapsed(tab.id, section)" [attr.aria-controls]="domId('section-content', tab.id, section.id)"
                        (click)="toggleSection(tab.id, section)">{{ section.label || section.id }}</button>
                    } @else { {{ section.label || section.id }} }
                  </h3>
                  <div [id]="domId('section-content', tab.id, section.id)" [hidden]="collapsed(tab.id, section)">
                    <div role="group" [attr.aria-label]="(section.label || section.id) + ' actions'">
                      @for (action of section.actions; track action.id) {
                        <button type="button" [disabled]="!action.enabled" (click)="dispatch(action)">{{ action.label }}</button>
                      }
                    </div>
                    @if (!section.groups.length && !section.actions.length) { <p>No fields in this section.</p> }
                    @for (group of section.groups; track group.id) {
                      <fieldset><legend>{{ group.label || group.id }}</legend>
                        @for (field of group.fields; track field.id) { <aur-form-field [field]="field" [context]="boundContexts()[field.id]!" [readOnly]="readOnly()" (fieldChange)="fieldChange.emit($event)" /> }
                        @if (!group.fields.length) { <p>No fields in this group.</p> }
                      </fieldset>
                    }
                  </div>
                </section>
              }
            </div>
          }
        }
        @if (composition().unplaced.length) {
          <fieldset><legend>{{ layout() ? 'Additional fields' : 'Fields' }}</legend>
            @for (field of composition().unplaced; track field.id) { <aur-form-field [field]="field" [context]="boundContexts()[field.id]!" [readOnly]="readOnly()" (fieldChange)="fieldChange.emit($event)" /> }
          </fieldset>
        }
        @if (!composition().tabs.length && !composition().unplaced.length) { <p>No fields in this form.</p> }
      </form>
    </aur-form-frame>
  `,
  styles: [`
    :host, aur-form-frame, form { display: block; min-width: 0; }
    [hidden] { display: none !important; }
    [role=tablist] { display: flex; flex-wrap: wrap; gap: .5rem; margin: 1rem 0; }
    button { max-width: 100%; white-space: normal; overflow-wrap: anywhere; padding: .5rem; margin: .25rem; font: inherit; cursor: pointer; }
    [role=tab][aria-selected=true] { font-weight: bold; border-bottom: .25rem solid currentColor; }
    :focus-visible { outline: 3px solid currentColor; outline-offset: 2px; }
    fieldset { min-width: 0; margin: .75rem 0; }
    aur-form-field { display: block; min-width: 0; margin: .75rem 0; }
    li, legend, h2, h3 { overflow-wrap: anywhere; }
  `],
})
export class FormComposition {
  readonly definition = input.required<FormDefinition>();
  readonly contexts = input.required<FormFieldContexts>();
  readonly layout = input<FormLayout>();
  readonly readOnly = input(false);
  /** When supplied, the application updates this value in response to viewStateChange. */
  readonly viewState = input<FormViewState>();
  readonly viewStateChange = output<FormViewState>();
  readonly fieldChange = output<FormFieldChange>();
  readonly actionSelected = output<string>();
  readonly composition = computed(() => composeForm(this.definition(), this.layout()));
  protected readonly boundContexts = computed(() => {
    validateFormContexts(this.definition(), this.contexts());
    return this.contexts();
  });
  protected readonly theme = inject(ThemeService);
  private readonly localState = signal<FormViewState>({});
  private readonly state = computed(() => this.viewState() ?? this.localState());
  private readonly root = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  readonly selectedTab = computed(() => this.composition().tabs.find(tab => tab.id === this.state().selectedTab)?.id ?? this.composition().tabs[0]?.id);
  protected readonly encode = (path: ValuePath | undefined) => JSON.stringify(path);
  protected domId(...parts: string[]): string { return 'aur-form-' + encodeURIComponent(JSON.stringify([this.definition().id, ...parts])); }
  private update(state: FormViewState): void { this.localState.set(state); this.viewStateChange.emit(state); }
  selectTab(id: string): void {
    if (this.composition().tabs.some(tab => tab.id === id)) this.update({ ...this.state(), selectedTab: id });
  }
  collapsed(tabId: string, section: ComposedSection): boolean {
    return section.collapsible && (this.state().sections?.find(item => item.tabId === tabId && item.sectionId === section.id)?.collapsed ?? section.initiallyCollapsed);
  }
  private expand(tab: ComposedTab, section: ComposedSection, collapsed: boolean): void {
    this.update({ ...this.state(), selectedTab: tab.id, sections: [
      ...(this.state().sections ?? []).filter(item => item.tabId !== tab.id || item.sectionId !== section.id),
      { tabId: tab.id, sectionId: section.id, collapsed },
    ] });
  }
  toggleSection(tabId: string, section: ComposedSection): void {
    const tab = this.composition().tabs.find(tab => tab.id === tabId);
    if (tab && section.collapsible) this.expand(tab, section, !this.collapsed(tabId, section));
  }
  protected tabKey(event: KeyboardEvent, index: number): void {
    const tabs = this.composition().tabs;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 :
      event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : undefined;
    if (next === undefined) return;
    event.preventDefault();
    this.selectTab(tabs[next]!.id);
    this.root.nativeElement.querySelectorAll<HTMLButtonElement>('[role=tab]')[next]?.focus();
  }
  protected dispatch(action: ContextAction): void { if (action.enabled) this.actionSelected.emit(action.id); }
  /** External validation/error hosts may reveal a path without importing a document engine. */
  revealField(path: ValuePath): boolean {
    const key = formPathKey(path), composition = this.composition();
    let match = composition.unplaced.find(field => formPathKey(field.path) === key);
    for (const tab of composition.tabs) for (const section of tab.sections) for (const group of section.groups) {
      const field = group.fields.find(field => formPathKey(field.path) === key);
      if (field) { match = field; this.expand(tab, section, false); }
    }
    if (!match) return false;
    const fieldId = match.id;
    afterNextRender(() => {
      const wrapper = [...this.root.nativeElement.querySelectorAll<HTMLElement>('[data-aur-field]')].find(node => node.dataset['aurField'] === fieldId);
      wrapper?.querySelector<HTMLElement>('input:not(:disabled),select:not(:disabled),textarea:not(:disabled),button:not(:disabled)')?.focus();
    }, { injector: this.injector });
    return true;
  }
}
