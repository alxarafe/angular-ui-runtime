/** Repository-only optional-control QA. No widget is shipped in the APF package. */
import { Component, effect, inject, input, output, signal, viewChild, ViewContainerRef, inputBinding, outputBinding } from '@angular/core';
import { FieldRendererContext, FieldValue, ThemeResolver, ThemeService, OptionalControlDefinition, ThemeDefinition } from '@alxarafe/ui-runtime';
import { QA_THEMES } from './fixtures';

interface RatingConfiguration { minimum: string; maximum: string; step: string; stars: number }
function ratingDomain(config: RatingConfiguration): readonly string[] {
  if (![config.minimum, config.maximum, config.step].every(value => /^-?\d+$/.test(value))) throw new Error('QA rating requires exact integer configuration');
  const min = BigInt(config.minimum), max = BigInt(config.maximum), step = BigInt(config.step);
  if (step <= 0n || max <= min || (max - min) % step || (max - min) / step > 100n)
    throw new Error('Unsupported QA rating domain');
  const values: string[] = [];
  for (let value = min; value <= max; value += step) values.push(value.toString());
  return values;
}
const parameters = new URLSearchParams(location.search);
const configuration: RatingConfiguration = { minimum: parameters.get('minimum') ?? '0', maximum: parameters.get('maximum') ?? '10', step: parameters.get('step') ?? '1', stars: Number(parameters.get('stars') ?? '5') };
const values = ratingDomain(configuration);
const domain = { semantic: 'qa-discrete-rating', values: [null, ...values] };
// A representation can express only whole or half stars; never round a score.
function starDomain(config: RatingConfiguration): readonly string[] {
  const values = ratingDomain(config), min = BigInt(config.minimum), span = BigInt(config.maximum) - min;
  if (!Number.isInteger(config.stars) || config.stars < 1 || config.stars > 10) throw new Error('Unsupported star count');
  // Native range interaction is restricted to small exact integer positions.
  // Larger exact scores use string-valued options instead of browser number coercion.
  if (values.some(value => BigInt(value) < -1000000n || BigInt(value) > 1000000n)) return [];
  return values.filter(value => ((BigInt(value) - min) * BigInt(config.stars) * 2n) % span === 0n);
}
export const RATING_CONTROLS: readonly OptionalControlDefinition[] = [
  { id: 'rating', domain, alternatives: ['numeric'] }, { id: 'numeric', domain },
];
@Component({ selector: 'qa-rating-stars', template: `
  <label [for]="context().id">{{ context().label }}</label>
  <input type="range" aria-describedby="rating-state" [id]="context().id" [min]="configuration.minimum" [max]="configuration.maximum" [step]="configuration.step"
    [value]="context().value ?? '0'" [attr.aria-valuetext]="valueText()"
    [disabled]="context().disabled || context().readOnly" (input)="update($any($event.target).value)" />
  <span aria-hidden="true">@for (width of starWidths(); track $index) {
    <span class="star">☆<span class="fill" [style.width]="width">★</span></span>
  }</span><span>{{ valueText() }}</span>
`, styles: [':host { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; } .star { position: relative; display: inline-block; font-size: 1.6rem; } .fill { position: absolute; left: 0; top: 0; overflow: hidden; white-space: nowrap; }'] })
class RatingStars {
  readonly configuration = configuration;
  readonly context = input.required<FieldRendererContext>();
  readonly valueChange = output<FieldValue>();
  valueText(): string { return this.context().value === null ? 'No rating' : `${this.context().value} out of ${configuration.maximum}`; }
  starWidths(): string[] {
    const value = this.context().value;
    if (typeof value !== 'string' || !values.includes(value)) return Array<string>(configuration.stars).fill('0%');
    const halves = (BigInt(value) - BigInt(configuration.minimum)) * BigInt(configuration.stars) * 2n / (BigInt(configuration.maximum) - BigInt(configuration.minimum));
    return Array.from({ length: configuration.stars }, (_, index) => halves >= BigInt(index * 2 + 2) ? '100%' : halves === BigInt(index * 2 + 1) ? '50%' : '0%');
  }
  update(value: string): void {
    if (!this.context().disabled && !this.context().readOnly && values.includes(value)) this.valueChange.emit(value);
  }
}
@Component({ selector: 'qa-rating-number', template: `
  <label [for]="context().id">{{ context().label }}</label>
  <select aria-describedby="rating-state" [id]="context().id" [value]="context().value ?? ''" [disabled]="context().disabled || context().readOnly"
    (change)="update($any($event.target).value)">
    <option value="">No rating</option>
    @for (value of values; track value) { <option [value]="value">{{ value }}</option> }
  </select>
`, styles: [':host { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }'] })
class RatingNumber {
  readonly values = values;
  readonly context = input.required<FieldRendererContext>();
  readonly valueChange = output<FieldValue>();
  update(value: string): void {
    if (!this.context().disabled && !this.context().readOnly && (value === '' || values.includes(value)))
      this.valueChange.emit(value === '' ? null : value);
  }
}
export const RATING_THEMES = QA_THEMES.map((theme): ThemeDefinition => ({ ...theme, controls: theme.id === 'default'
  ? { rating: { component: RatingStars, domain: { ...domain, values: [null, ...starDomain(configuration)] } }, numeric: { component: RatingNumber, domain } }
  : { numeric: { component: RatingNumber, domain } } }));

@Component({ selector: 'qa-rating-outlet', template: '<ng-container #target />' })
class RatingOutlet {
  readonly context = input.required<FieldRendererContext>();
  readonly valueChange = output<FieldValue>();
  private readonly target = viewChild('target', { read: ViewContainerRef });
  private readonly resolver = inject(ThemeResolver);
  private rendered?: unknown;
  constructor() {
    effect(() => {
      const target = this.target();
      if (!target) return;
      const result = this.resolver.resolveControl('rating');
      if (result.component === this.rendered) return;
      const focused = document.activeElement?.id === 'rating';
      target.clear();
      target.createComponent(result.component, { bindings: [
        inputBinding('context', this.context), outputBinding<FieldValue>('valueChange', value => this.valueChange.emit(value)),
      ] });
      this.rendered = result.component;
      if (focused) queueMicrotask(() => document.getElementById('rating')?.focus());
    });
  }
}
@Component({ selector: 'qa-testbed', imports: [RatingOutlet], template: `
  <main>
    <h1>Optional rating control QA</h1>
    <p>Change representation while retaining the exact score and fixture-owned state.</p>
    <button (click)="theme.activate('default')">Stars</button>
    <button (click)="theme.activate('qa-alternative')">Numeric fallback</button>
    <button (click)="switchFocused()">Switch with logical focus</button>
    <button (click)="value.set(null)">Clear rating</button>
    <label><input type="checkbox" (change)="disabled.set($any($event.target).checked)" /> Disabled</label>
    <label><input type="checkbox" (change)="readOnly.set($any($event.target).checked)" /> Read only</label>
    <qa-rating-outlet [context]="{ id: 'rating', label: 'Rating', value: value(), disabled: disabled(), readOnly: readOnly() }" (valueChange)="edit($event)" />
    <p>Exact value: <output data-testid="rating-value">{{ value() === null ? 'null' : value() }}</output></p>
    <p id="rating-state" data-testid="rating-state">Dirty: {{ dirty() }} · Error: Synthetic error retained</p>
  </main>
`, styles: [`
  :host { display: block; padding: 16px; --accent: #1759a6; }
  main { max-width: 64rem; margin: auto; }
  button { margin: 0 8px 8px 0; }
  label { display: flex; align-items: center; gap: 8px; margin: 8px 0; }
  qa-rating-outlet { display: block; margin-top: 16px; padding: 12px; border: 1px solid #6b7c90; border-radius: 4px; }
`] })
export class RatingTestbed {
  readonly theme = inject(ThemeService);
  readonly value = signal<FieldValue>(values.includes('7') ? '7' : values[0]!);
  readonly dirty = signal(false);
  readonly disabled = signal(false);
  readonly readOnly = signal(false);
  edit(value: FieldValue): void { this.value.set(value); this.dirty.set(true); }
  switchFocused(): void {
    document.getElementById('rating')?.focus();
    this.theme.activate(this.theme.current().id === 'default' ? 'qa-alternative' : 'default');
  }
}
