/** SPDX-License-Identifier: Apache-2.0
 * Technical public-package consumer only; no local placement or form state engine.
 */
import { Component, DestroyRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { FormComposition, ThemeService, ThemeArtifact, type FormDiagnostic, type ControlRequest, type FormViewState, type FormDefinition, type FormFieldContexts, type FormLayout, type FormFieldChange, type FormPresentationContext, type ThemeDefinition, type ValuePath, type FieldValue } from '@alxarafe/ui-runtime';
import { DEFAULT_PACKAGE_THEMES } from './default-theme';
import { RATING_THEMES, RATING_CONTROLS } from './rating';
import { ratingRequest } from './rating-configuration';
import { QaAlternativeField } from './fixtures';
@Component({ host: { '[attr.data-frame-context]': 'encode(context())' }, template: '<aside class="qa-form-frame"><p>Optional form frame</p><ng-content /></aside>', styles: ['.qa-form-frame { padding: 12px; border: 3px dashed #633795; }'] })
class QaFormFrame { readonly context = input.required<FormPresentationContext>(); readonly encode = JSON.stringify; }
const flagDomain = { semantic: 'qa-form-boolean', values: [true, false] };
export const FORM_CONTROLS = [...RATING_CONTROLS, { id: 'form-flag', domain: flagDomain }];
const controls = (defaultTheme: boolean) => ({ ...RATING_THEMES[defaultTheme ? 0 : 1]!.controls,
  'form-flag': { component: DEFAULT_PACKAGE_THEMES[0]!.overrides[ThemeArtifact.FieldBoolean]!, domain: flagDomain },
});
export const FORM_THEMES: readonly ThemeDefinition[] = [
  ...DEFAULT_PACKAGE_THEMES.map(theme => ({ ...theme, controls: controls(theme.id === 'default') })),
  { id: 'form-frame', cssClass: 'theme-default', controls: controls(false), components: { form: QaFormFrame }, overrides: { [ThemeArtifact.FieldString]: QaAlternativeField } },
];
const namePath: ValuePath = [{ kind: 'property', name: 'header' }, { kind: 'property', name: 'name' }];
const exactPath: ValuePath = [{ kind: 'property', name: 'lines' }, { kind: 'row', key: 'temporary-a' }, { kind: 'property', name: 'amount' }];
const property = (name: string): ValuePath => [{ kind: 'property', name }];
const layout: FormLayout = { actions: [{ id: 'root-action' }], tabs: [
  { id: 'general', label: 'General', actions: [{ id: 'tab-action' }], sections: [
    { id: 'identity', label: 'Identity', collapsible: false, initiallyCollapsed: false, actions: [], groups: [
      { id: 'name', label: 'Name group', fields: [namePath, property('unknown'), property('aur-private-path-token')] },
      { id: 'empty', label: 'Empty group', fields: [] },
    ] },
  ] },
  { id: 'details', label: 'Details', actions: [], sections: [
    { id: 'exact', label: 'Exact section', collapsible: true, initiallyCollapsed: true, actions: [{ id: 'section-action' }, { id: 'disabled-action' }], groups: [
      { id: 'exact', label: 'Exact group', fields: [exactPath, namePath] },
    ] },
    { id: 'action-only', label: 'Action-only section', collapsible: false, initiallyCollapsed: false, groups: [], actions: [{ id: 'only-action' }, { id: 'aur-private-action-token' }] },
    { id: 'empty-section', label: 'Empty section', collapsible: false, initiallyCollapsed: false, groups: [], actions: [] },
  ] },
  { id: 'actions', label: 'Actions only', actions: [{ id: 'only-tab-action' }], sections: [] },
  { id: 'empty-tab', label: 'Empty tab', actions: [], sections: [] },
] };
@Component({ selector: 'qa-testbed', imports: [FormComposition], host: { '(document:keydown.alt.t)': 'toggleTheme()', '(document:keydown.alt.r)': 'toggleQualityPresentation($event)', '(document:keydown.alt.d)': 'toggleQualityDomain($event)' }, template: `
  <main>
    <h1>Form composition QA</h1>
    <p>Public library composition with application-owned exact values. Alt+T replaces the frame and field renderers.</p>
    <div class="controls">
      <button (click)="ordered.set(false)">Use simple layout</button><button (click)="ordered.set(true)">Use ordered layout</button>
      <button (click)="optional.set(true)">Show optional fields</button>
      <button (click)="toggleQualityDomain()">Toggle quality domain</button>
      <button (click)="toggleQualityPresentation()">Toggle quality presentation</button>
      <button (click)="optionalBlocked.set(!optionalBlocked())">Toggle optional disabled</button>
      <button (click)="controlled.set(true)">Use external visual state</button>
      <button (click)="readOnly.set(!readOnly())">Toggle read-only</button>
      <button (click)="revealResult.set(form().revealField(exactPath))">Reveal exact field</button>
      <button (click)="revealResult.set(form().revealField(excludedPath))">Reveal excluded field</button>
      @for (id of themeIds; track id) { <button (click)="theme.activate(id)">{{ id }}</button> }
    </div>
    <p>Theme: <output data-testid="form-theme">{{ theme.current().id }}</output> · Read-only: {{ readOnly() }}</p>
    <aur-form [definition]="definition()" [contexts]="contexts()" [viewState]="controlled() ? externalViewState() : undefined" [layout]="ordered() ? orderedLayout : undefined" [readOnly]="readOnly()"
      (fieldChange)="edit($event)" (actionSelected)="action.set($event)" (viewStateChange)="captureState($event)" />
    @if (optional()) {
      <p>Optional scores share one control ID. Alt+R changes Quality presentation; Alt+D changes its domain.</p>
      @for (id of ['quality', 'satisfaction', 'service', 'large']; track id) {
        <p [id]="'form-' + id + '-state'">QA {{ id }} value: {{ encode(values()[id]) }}</p>
      }
    }
    <p>Last field event: <output data-testid="form-event">{{ lastEvent() }}</output></p>
    <p>Application values: <output data-testid="form-values">{{ encode(values()) }}</output></p>
    <p>Action intent: <output data-testid="form-action">{{ action() }}</output></p>
    <p>Visual state: <output data-testid="form-state">{{ viewState() }}</output></p>
    <p>Reveal result: <output data-testid="form-reveal">{{ revealResult() }}</output></p>
    <aur-form [definition]="emptyDefinition" [contexts]="{}" />
  </main>
`, styles: [`
  :host { display: block; padding: 16px; color: #172538; background: #eef2f6; font-family: Arial,sans-serif; }
  main { max-width: 1000px; margin: auto; }
  .controls { display: flex; flex-wrap: wrap; gap: 8px; }
  button { padding: 8px; font: inherit; }
  output { overflow-wrap: anywhere; }
`] })
export class FormTestbed {
  readonly form = viewChild.required(FormComposition);
  readonly theme = inject(ThemeService);
  readonly themeIds = ['default', 'alternative', 'cyberpunk', 'vintage', 'high-contrast', 'css-only', 'form-frame'];
  readonly values = signal<Record<string, FieldValue>>({ name: 'Initial name', exact: '9223372036854775807.123456789', omitted: 'Accessible fallback', disabled: 'No edits', quality: '3', satisfaction: '7', service: '9', large: '9223372036854775808', flag: false });
  readonly ordered = signal(false);
  readonly optional = signal(false);
  readonly optionalBlocked = signal(false);
  readonly qualityStars = signal(5);
  readonly qualityMaximum = signal('5');
  private request(maximum: string, stars: number, nullable: boolean, minimum = '0'): ControlRequest {
    return ratingRequest({ minimum, maximum, step: '1', stars, nullable });
  }
  constructor() {
    // QA-only memory access to public diagnostics. No diagnostic metadata enters DOM.
    const target = globalThis as typeof globalThis & { __aurFormQa?: { diagnostics: () => readonly FormDiagnostic[] } };
    const api = { diagnostics: () => this.form().composition().diagnostics };
    target.__aurFormQa = api;
    inject(DestroyRef).onDestroy(() => { if (target.__aurFormQa === api) delete target.__aurFormQa; });
  }
  readonly orderedLayout = layout;
  readonly exactPath = exactPath;
  readonly excludedPath = property('aur-private-path-token');
  readonly controlled = signal(false);
  readonly externalViewState = signal<FormViewState>({});
  readonly readOnly = signal(false);
  readonly lastEvent = signal(''); readonly action = signal(''); readonly viewState = signal(''); readonly revealResult = signal(false);
  readonly encode = (value: unknown) => JSON.stringify(value);
  readonly emptyDefinition: FormDefinition = { id: 'empty-form', label: 'Empty form', fields: [] };
  readonly contexts = computed<FormFieldContexts>(() => ({
    name: { id: 'form-name', label: 'Name', value: this.values()['name']! },
    exact: { id: 'form-exact', label: 'Exact text', value: this.values()['exact']! },
    omitted: { id: 'form-omitted', label: 'Omitted field', value: this.values()['omitted']! },
    disabled: { id: 'form-disabled', label: 'Disabled field', value: this.values()['disabled']!, disabled: true },
    quality: { id: 'form-quality', label: 'Quality score', value: this.values()['quality']!, disabled: this.optionalBlocked(), control: this.request(this.qualityMaximum(), this.qualityStars(), true) },
    satisfaction: { id: 'form-satisfaction', label: 'Satisfaction score', value: this.values()['satisfaction']!, control: this.request('10', 5, false) },
    service: { id: 'form-service', label: 'Service score', value: this.values()['service']!, control: this.request('10', 10, true) },
    large: { id: 'form-large', label: 'Large exact score', value: this.values()['large']!, control: this.request('9223372036854775817', 5, true, '9223372036854775807') },
    flag: { id: 'form-flag', label: 'Optional flag', value: this.values()['flag']!, control: { domain: flagDomain } },
  }));
  readonly definition = computed<FormDefinition>(() => ({ id: 'composition-example', label: 'Composition example', fields: [
    { id: 'name', path: namePath, artifact: ThemeArtifact.FieldString },
    { id: 'exact', path: exactPath, artifact: ThemeArtifact.FieldString },
    { id: 'omitted', path: property('omitted'), artifact: ThemeArtifact.FieldString },
    { id: 'aur-private-field-token', path: property('aur-private-path-token'), artifact: ThemeArtifact.FieldString, excluded: true },
    { id: 'disabled', path: property('disabled'), artifact: ThemeArtifact.FieldString },
    ...(this.optional() ? ['quality', 'satisfaction', 'service', 'large', 'flag'].map(id => ({
      id, path: property(id), kind: 'control' as const, controlId: id === 'flag' ? 'form-flag' : 'rating',
    })) : []),
  ], actions: [
    { id: 'root-action', label: 'Root action', enabled: true }, { id: 'tab-action', label: 'Tab action', enabled: true },
    { id: 'section-action', label: 'Section action', enabled: true }, { id: 'disabled-action', label: 'Disabled action', enabled: false },
    { id: 'only-action', label: 'Action-only command', enabled: true }, { id: 'only-tab-action', label: 'Tab-only command', enabled: true },
    { id: 'unplaced-action', label: 'Unplaced command', enabled: true },
  ] }));
  captureState(state: FormViewState): void { this.externalViewState.set(state); this.viewState.set(this.encode(state)); }
  edit(event: FormFieldChange): void { this.lastEvent.set(this.encode(event)); this.values.update(values => ({ ...values, [event.id]: event.value })); }
  toggleQualityDomain(event?: Event): void { event?.preventDefault(); this.qualityMaximum.update(maximum => maximum === '5' ? '10' : '5'); }
  toggleQualityPresentation(event?: Event): void { event?.preventDefault(); this.qualityStars.update(stars => stars === 5 ? 3 : 5); }
  toggleTheme(): void { this.theme.activate(this.theme.current().id === 'form-frame' ? 'default' : 'form-frame'); }
}
