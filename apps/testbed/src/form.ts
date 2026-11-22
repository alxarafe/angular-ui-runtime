/** SPDX-License-Identifier: Apache-2.0
 * Technical public-package consumer only; no local placement or form state engine.
 */
import { Component, computed, inject, input, signal, viewChild } from '@angular/core';
import { FormComposition, ThemeService, ThemeArtifact, type FormViewState, type FormDefinition, type FormFieldContexts, type FormLayout, type FormFieldChange, type FormPresentationContext, type ThemeDefinition, type ValuePath, type FieldValue } from '@alxarafe/ui-runtime';
import { DEFAULT_PACKAGE_THEMES } from './default-theme';
import { QaAlternativeField } from './fixtures';
@Component({ template: '<aside class="qa-form-frame"><p>Optional form frame</p><ng-content /></aside>', styles: ['.qa-form-frame { padding: 12px; border: 3px dashed #633795; }'] })
class QaFormFrame { readonly context = input.required<FormPresentationContext>(); }
export const FORM_THEMES: readonly ThemeDefinition[] = [...DEFAULT_PACKAGE_THEMES,
  { id: 'form-frame', cssClass: 'theme-default', components: { form: QaFormFrame }, overrides: { [ThemeArtifact.FieldString]: QaAlternativeField } },
];
const namePath: ValuePath = [{ kind: 'property', name: 'header' }, { kind: 'property', name: 'name' }];
const exactPath: ValuePath = [{ kind: 'property', name: 'lines' }, { kind: 'row', key: 'temporary-a' }, { kind: 'property', name: 'amount' }];
const property = (name: string): ValuePath => [{ kind: 'property', name }];
const layout: FormLayout = { actions: [{ id: 'root-action' }], tabs: [
  { id: 'general', label: 'General', actions: [{ id: 'tab-action' }], sections: [
    { id: 'identity', label: 'Identity', collapsible: false, initiallyCollapsed: false, actions: [], groups: [
      { id: 'name', label: 'Name group', fields: [namePath, property('unknown'), property('excluded')] },
      { id: 'empty', label: 'Empty group', fields: [] },
    ] },
  ] },
  { id: 'details', label: 'Details', actions: [], sections: [
    { id: 'exact', label: 'Exact section', collapsible: true, initiallyCollapsed: true, actions: [{ id: 'section-action' }, { id: 'disabled-action' }], groups: [
      { id: 'exact', label: 'Exact group', fields: [exactPath, namePath] },
    ] },
    { id: 'action-only', label: 'Action-only section', collapsible: false, initiallyCollapsed: false, groups: [], actions: [{ id: 'only-action' }, { id: 'unauthorized' }] },
    { id: 'empty-section', label: 'Empty section', collapsible: false, initiallyCollapsed: false, groups: [], actions: [] },
  ] },
  { id: 'actions', label: 'Actions only', actions: [{ id: 'only-tab-action' }], sections: [] },
  { id: 'empty-tab', label: 'Empty tab', actions: [], sections: [] },
] };
@Component({ selector: 'qa-testbed', imports: [FormComposition], host: { '(document:keydown.alt.t)': 'toggleTheme()' }, template: `
  <main>
    <h1>Form composition QA</h1>
    <p>Public library composition with application-owned exact values. Alt+T replaces the frame and field renderers.</p>
    <div class="controls">
      <button (click)="ordered.set(false)">Use simple layout</button><button (click)="ordered.set(true)">Use ordered layout</button>
      <button (click)="controlled.set(true)">Use external visual state</button>
      <button (click)="readOnly.set(!readOnly())">Toggle read-only</button>
      <button (click)="revealResult.set(form().revealField(exactPath))">Reveal exact field</button>
      <button (click)="revealResult.set(form().revealField(excludedPath))">Reveal excluded field</button>
      @for (id of themeIds; track id) { <button (click)="theme.activate(id)">{{ id }}</button> }
    </div>
    <p>Theme: <output data-testid="form-theme">{{ theme.current().id }}</output> · Read-only: {{ readOnly() }}</p>
    <aur-form [definition]="definition()" [contexts]="contexts()" [viewState]="controlled() ? externalViewState() : undefined" [layout]="ordered() ? orderedLayout : undefined" [readOnly]="readOnly()"
      (fieldChange)="edit($event)" (actionSelected)="action.set($event)" (viewStateChange)="captureState($event)" />
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
  readonly values = signal<Record<string, FieldValue>>({ name: 'Initial name', exact: '9223372036854775807.123456789', omitted: 'Accessible fallback', excluded: 'Never render', disabled: 'No edits' });
  readonly ordered = signal(false);
  readonly orderedLayout = layout;
  readonly exactPath = exactPath;
  readonly excludedPath = property('excluded');
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
  }));
  readonly definition = computed<FormDefinition>(() => ({ id: 'composition-example', label: 'Composition example', fields: [
    { id: 'name', path: namePath, artifact: ThemeArtifact.FieldString },
    { id: 'exact', path: exactPath, artifact: ThemeArtifact.FieldString },
    { id: 'omitted', path: property('omitted'), artifact: ThemeArtifact.FieldString },
    { id: 'excluded', path: property('excluded'), artifact: ThemeArtifact.FieldString, excluded: true },
    { id: 'disabled', path: property('disabled'), artifact: ThemeArtifact.FieldString },
  ], actions: [
    { id: 'root-action', label: 'Root action', enabled: true }, { id: 'tab-action', label: 'Tab action', enabled: true },
    { id: 'section-action', label: 'Section action', enabled: true }, { id: 'disabled-action', label: 'Disabled action', enabled: false },
    { id: 'only-action', label: 'Action-only command', enabled: true }, { id: 'only-tab-action', label: 'Tab-only command', enabled: true },
    { id: 'unplaced-action', label: 'Unplaced command', enabled: true },
  ] }));
  captureState(state: FormViewState): void { this.externalViewState.set(state); this.viewState.set(this.encode(state)); }
  edit(event: FormFieldChange): void { this.lastEvent.set(this.encode(event)); this.values.update(values => ({ ...values, [event.id]: event.value })); }
  toggleTheme(): void { this.theme.activate(this.theme.current().id === 'form-frame' ? 'default' : 'form-frame'); }
}
