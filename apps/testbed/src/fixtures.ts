/** Synthetic QA components only; these are not production themes or 1.0 widgets. */
import { Component, Directive, input, output } from '@angular/core';
import {
  ThemeArtifact, THEME_ARTIFACTS,
  type FieldRenderer, type FieldRendererContext, type FieldValue,
  type ThemeArtifacts, type ThemeDefinition,
} from '@alxarafe/ui-runtime';

@Component({ selector: 'qa-shell', template: '<div class="qa-shell" data-testid="shell-default"><ng-content /></div>' })
export class QaShell {}
@Component({
  selector: 'qa-navigation',
  template: '<nav aria-label="QA fixture navigation"><strong>Fixture navigation</strong><a href="#probes">Field probes</a><span>Default navigation fallback</span></nav>',
})
export class QaNavigation {}
@Component({ selector: 'qa-panel', template: '<section class="qa-panel" data-testid="panel-default"><ng-content /></section>' })
export class QaPanel {}
@Component({ selector: 'qa-alternative-panel', template: '<section class="qa-panel" data-testid="panel-alternative"><p class="fixture-note">Synthetic alternative panel</p><ng-content /></section>' })
export class QaAlternativePanel {}

@Directive()
abstract class QaFieldBase implements FieldRenderer {
  readonly context = input.required<FieldRendererContext>();
  readonly valueChange = output<FieldValue>();
  readonly isBoolean = () => typeof this.context().value === 'boolean';
  readonly text = () => typeof this.context().value === 'string' ? this.context().value : '';
  update(value: FieldValue): void {
    if (!this.context().disabled && !this.context().readOnly) this.valueChange.emit(value);
  }
}
const FIELD_TEMPLATE = `
  <label [for]="context().id">{{ context().label }}</label>
  @if (isBoolean()) {
    <input [id]="context().id" type="checkbox" [checked]="context().value === true"
      [disabled]="context().disabled || context().readOnly"
      (change)="update($any($event.target).checked)" />
  } @else {
    <input [id]="context().id" type="text" [value]="text()"
      [disabled]="context().disabled" [readOnly]="context().readOnly"
      (input)="update($any($event.target).value)" />
  }
`;
@Component({ selector: 'qa-field', template: FIELD_TEMPLATE, host: { class: 'qa-field', 'data-renderer': 'default' } })
export class QaField extends QaFieldBase {}
@Component({ selector: 'qa-alternative-field', template: FIELD_TEMPLATE, host: { class: 'qa-field', 'data-renderer': 'alternative' } })
export class QaAlternativeField extends QaFieldBase {}

// All keys are registered, but the generic probes do not implement 17 semantic widgets.
const defaults = {
  ...Object.fromEntries(THEME_ARTIFACTS.filter(key => key.startsWith('field.')).map(key => [key, QaField])),
  [ThemeArtifact.Shell]: QaShell,
  [ThemeArtifact.Navigation]: QaNavigation,
  [ThemeArtifact.Panel]: QaPanel,
} as ThemeArtifacts;
export const QA_THEMES: readonly ThemeDefinition[] = [
  { id: 'default', cssClass: 'qa-default', overrides: defaults },
  { id: 'qa-alternative', cssClass: 'qa-alternative', overrides: {
    [ThemeArtifact.Panel]: QaAlternativePanel,
    [ThemeArtifact.FieldDecimal]: QaAlternativeField,
  } },
];
