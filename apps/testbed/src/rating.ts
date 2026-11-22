/** SPDX-License-Identifier: Apache-2.0
 * Repository-only optional-control QA. No widget is shipped in the APF package.
 */
import { Component, ElementRef, effect, inject, input, output, signal, viewChild, ViewContainerRef, inputBinding, outputBinding } from '@angular/core';
import { FieldRendererContext, FieldValue, ThemeResolver, ThemeService, OptionalControlDefinition, ThemeDefinition, ControlRequest } from '@alxarafe/ui-runtime';
import { QA_THEMES } from './fixtures';
import { ratingRequest, RatingConfiguration, matchesNativeRangePositions } from './rating-configuration';

function scale(request: ControlRequest) {
  const options = request.presentation ?? { minimum: '0', maximum: '10', step: '1', stars: 5 };
  if (Object.keys(options).some(key => !['minimum', 'maximum', 'step', 'stars'].includes(key)) ||
      typeof options['minimum'] !== 'string' || typeof options['maximum'] !== 'string' ||
      typeof options['step'] !== 'string' || typeof options['stars'] !== 'number')
    throw new Error('Invalid rating options');
  const definition = ratingRequest({ minimum: options['minimum'], maximum: options['maximum'],
    step: options['step'], stars: options['stars'], nullable: request.domain.values.includes(null) });
  return definition;
}
function numericCapability(request: ControlRequest) {
  const configured = scale(request);
  return request.domain.values.every(value => configured.domain.values.includes(value as string | null))
    ? { ...request.domain, values: [...request.domain.values] } : undefined;
}
function starCapability(request: ControlRequest) {
  const configured = scale(request);
  // Checking only that allowed values are reachable is insufficient: a native
  // range must not offer positions that this field forbids.
  if (!numericCapability(request) ||
      !matchesNativeRangePositions(request.domain.values, configured.domain.values)) return undefined;
  const min = BigInt(configured.presentation.minimum), span = BigInt(configured.presentation.maximum) - min;
  const values = request.domain.values.filter(value => value === null || typeof value === 'string' &&
    BigInt(value) >= -1000000n && BigInt(value) <= 1000000n &&
    ((BigInt(value) - min) * BigInt(configured.presentation.stars) * 2n) % span === 0n);
  return values.length ? { ...request.domain, values } : undefined;
}
// This is only the legacy default domain, never the domain of every field instance.
const legacy = ratingRequest({ minimum: '0', maximum: '10', step: '1', stars: 5, nullable: true });
export const RATING_CONTROLS: readonly OptionalControlDefinition[] = [
  { id: 'rating', domain: legacy.domain, alternatives: ['numeric'] }, { id: 'numeric', domain: legacy.domain },
];

const CONTROL_STYLES = ':host { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }';
@Component({ selector: 'qa-rating-stars', template: `
  <label [for]="context().id">{{ context().label }}</label>
  <input type="range" [id]="context().id" [attr.aria-describedby]="context().id + '-state'"
    [min]="options().minimum" [max]="options().maximum" [step]="options().step"
    [value]="context().value ?? options().minimum" [attr.aria-valuetext]="valueText()"
    [disabled]="blocked()" (input)="update($any($event.target).value)" />
  <span aria-hidden="true">@for (width of starWidths(); track $index) {
    <span class="star">☆<span class="fill" [style.width]="width">★</span></span>
  }</span><span>{{ valueText() }}</span>
  @if (nullable()) { <button type="button" [disabled]="blocked()" (click)="clear()">No rating</button> }
`, styles: [CONTROL_STYLES, '.star { position: relative; display: inline-block; font-size: 1.6rem; } .fill { position: absolute; left: 0; top: 0; overflow: hidden; white-space: nowrap; }'] })
class RatingStars {
  readonly context = input.required<FieldRendererContext>();
  readonly valueChange = output<FieldValue>();
  request() { return this.context().control ?? legacy; }
  options() { return scale(this.request()).presentation; }
  nullable() { return this.request().domain.values.includes(null); }
  blocked() { return this.context().disabled || this.context().readOnly; }
  valueText(): string { return this.context().value === null ? 'No rating' : `${this.context().value} out of ${this.options().maximum}`; }
  starWidths(): string[] {
    const value = this.context().value, config = this.options();
    if (typeof value !== 'string' || !this.request().domain.values.includes(value)) return Array<string>(config.stars).fill('0%');
    const halves = (BigInt(value) - BigInt(config.minimum)) * BigInt(config.stars) * 2n / (BigInt(config.maximum) - BigInt(config.minimum));
    return Array.from({ length: config.stars }, (_, index) => halves >= BigInt(index * 2 + 2) ? '100%' : halves === BigInt(index * 2 + 1) ? '50%' : '0%');
  }
  update(value: string): void {
    if (!this.blocked() && this.request().domain.values.includes(value)) this.valueChange.emit(value);
  }
  clear(): void { if (!this.blocked() && this.nullable()) this.valueChange.emit(null); }
}
@Component({ selector: 'qa-rating-number', template: `
  <label [for]="context().id">{{ context().label }}</label>
  <select [id]="context().id" [attr.aria-describedby]="context().id + '-state'"
    [disabled]="context().disabled || context().readOnly" (change)="update($any($event.target).value)">
    @for (value of values(); track $index) { <option [value]="'' + $index" [selected]="value === context().value">{{ value === null ? 'No rating' : value }}</option> }
  </select>
`, styles: [CONTROL_STYLES] })
class RatingNumber {
  readonly context = input.required<FieldRendererContext>();
  readonly valueChange = output<FieldValue>();
  values(): readonly FieldValue[] { return (this.context().control ?? legacy).domain.values; }
  update(index: string): void {
    const value = this.values().find((_, position) => String(position) === index);
    if (!this.context().disabled && !this.context().readOnly && value !== undefined) this.valueChange.emit(value);
  }
}
export const RATING_THEMES = QA_THEMES.map((theme): ThemeDefinition => ({ ...theme, controls: theme.id === 'default'
  ? { rating: { component: RatingStars, domain: legacy.domain, capabilities: starCapability },
      numeric: { component: RatingNumber, domain: legacy.domain, capabilities: numericCapability } }
  : { numeric: { component: RatingNumber, domain: legacy.domain, capabilities: numericCapability } } }));

@Component({ selector: 'qa-rating-outlet', template: '<ng-container #target />' })
class RatingOutlet {
  readonly context = input.required<FieldRendererContext>();
  readonly valueChange = output<FieldValue>();
  private readonly target = viewChild('target', { read: ViewContainerRef });
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly resolver = inject(ThemeResolver);
  private rendered?: unknown;
  private generation = 0;
  constructor() {
    effect(() => {
      const target = this.target();
      if (!target) return;
      const context = this.context();
      const result = this.resolver.resolveControl('rating', context.control);
      if (result.component === this.rendered) return;
      const root = this.host.nativeElement, active = root.ownerDocument.activeElement;
      const focused = !!active && root.contains(active);
      const operation = active?.tagName === 'BUTTON' ? 'button' : 'input,select';
      const generation = ++this.generation;
      target.clear();
      target.createComponent(result.component, { bindings: [
        inputBinding('context', this.context), outputBinding<FieldValue>('valueChange', value => this.valueChange.emit(value)),
      ] });
      this.rendered = result.component;
      if (focused) queueMicrotask(() => {
        if (generation !== this.generation || !root.isConnected ||
            (root.ownerDocument.activeElement !== root.ownerDocument.body && root.ownerDocument.activeElement !== active)) return;
        (root.querySelector<HTMLElement>(operation) ?? root.querySelector<HTMLElement>('input,select'))?.focus();
      });
    });
  }
}
interface RatingField { id: string; label: string; control: ControlRequest; initial: FieldValue }
function field(id: string, label: string, config: RatingConfiguration, initial: FieldValue): RatingField {
  return { id, label, control: ratingRequest(config), initial };
}
@Component({ selector: 'qa-testbed', imports: [RatingOutlet], host: { '(document:keydown.alt.t)': 'switchFocused()' }, template: `
  <main>
    <h1>Optional rating control QA</h1>
    <p>Each field resolves independently. Stars visualize a native range; use its pointer or arrow keys to edit. Alt+T switches theme with focus in place.</p>
    <button (click)="theme.activate('default')">Stars</button>
    <button (click)="theme.activate('qa-alternative')">Numeric fallback</button>
    @for (field of fields; track field.id) {
      <section [attr.data-testid]="field.id + '-section'">
        <h2>{{ field.label }}</h2>
        <label><input type="checkbox" (change)="setFlag(field.id, 'disabled', $any($event.target).checked)" /> Disabled {{ field.label }}</label>
        <label><input type="checkbox" (change)="setFlag(field.id, 'readOnly', $any($event.target).checked)" /> Read only {{ field.label }}</label>
        <qa-rating-outlet [context]="{ id: field.id, label: field.label, value: values()[field.id]!, control: field.control,
          disabled: flags()[field.id]?.disabled, readOnly: flags()[field.id]?.readOnly }" (valueChange)="edit(field, $event)" />
        <p [id]="field.id + '-state'" [attr.data-testid]="field.id + '-state'">QA dirty: {{ edits()[field.id] ?? false }} · Error: Synthetic error retained</p>
        <p>Exact value: <output [attr.data-testid]="field.id + '-value'">{{ display(values()[field.id]!) }}</output></p>
        <p>Events: <output [attr.data-testid]="field.id + '-events'">{{ events()[field.id] ?? 0 }}</output></p>
      </section>
    }
    <button (click)="switchFocused()">Toggle theme</button>
  </main>
`, styles: [`
  :host { display: block; padding: 16px; --accent: #1759a6; }
  main { max-width: 64rem; margin: auto; }
  button { margin: 0 8px 8px 0; }
  section { padding: 12px; margin: 12px 0; border: 1px solid #6b7c90; border-radius: 4px; }
  label { display: flex; align-items: center; gap: 8px; margin: 8px 0; }
  qa-rating-outlet { display: block; margin-top: 16px; }
`] })
export class RatingTestbed {
  readonly theme = inject(ThemeService);
  readonly fields = [
    field('quality', 'Quality', { minimum: '0', maximum: '5', step: '1', stars: 5, nullable: true }, '3'),
    field('satisfaction', 'Satisfaction', { minimum: '0', maximum: '10', step: '1', stars: 5, nullable: false }, '7'),
    field('service', 'Service', { minimum: '0', maximum: '10', step: '1', stars: 10, nullable: true }, '9'),
    field('incompatible', 'Three-star configuration', { minimum: '0', maximum: '10', step: '1', stars: 3, nullable: false }, '4'),
    field('large', 'Exact large score', { minimum: '9223372036854775807', maximum: '9223372036854775817', step: '1', stars: 5, nullable: true }, '9223372036854775808'),
    field('stepped', 'Exact stepped score', { minimum: '-2', maximum: '18', step: '2', stars: 5, nullable: false }, '-2'),
  ];
  readonly values = signal<Record<string, FieldValue>>(Object.fromEntries(this.fields.map(field => [field.id, field.initial])));
  readonly edits = signal<Record<string, boolean>>({});
  readonly events = signal<Record<string, number>>({});
  readonly flags = signal<Record<string, { disabled?: boolean; readOnly?: boolean }>>({});
  display(value: FieldValue): string { return value === null ? 'null' : value === '' ? 'empty string' : String(value); }
  setFlag(id: string, flag: 'disabled' | 'readOnly', value: boolean): void {
    this.flags.update(flags => ({ ...flags, [id]: { ...flags[id], [flag]: value } }));
  }
  edit(field: RatingField, value: FieldValue): void {
    // Count the renderer's raw output before host guards so QA cannot hide invalid emissions.
    this.events.update(events => ({ ...events, [field.id]: (events[field.id] ?? 0) + 1 }));
    if (this.flags()[field.id]?.disabled || this.flags()[field.id]?.readOnly || !field.control.domain.values.includes(value)) return;
    this.values.update(values => ({ ...values, [field.id]: value }));
    this.edits.update(edits => ({ ...edits, [field.id]: true }));
  }
  switchFocused(): void {
    // QA keyboard trigger: focus remains where the user put it.
    this.theme.activate(this.theme.current().id === 'default' ? 'qa-alternative' : 'default');
  }
}
