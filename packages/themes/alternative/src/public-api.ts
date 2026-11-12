/** SPDX-License-Identifier: Apache-2.0; adapted from ERBAS; see NOTICE. */
import { Component, input, output } from '@angular/core';
import { ThemeArtifact, type ThemeDefinition, type FieldRenderer, type FieldRendererContext, type FieldValue } from '@alxarafe/ui-runtime';

export const BOOLEAN_CHOICES = Object.freeze({ yes: 'yes', no: 'no', unset: '' } as const);

@Component({ selector: 'aur-alternative-boolean', templateUrl: './boolean.html', host: { class: 'aur-alternative-boolean' } })
export class AlternativeBooleanRenderer implements FieldRenderer {
  readonly context = input.required<FieldRendererContext>();
  readonly valueChange = output<FieldValue>();
  readonly choices = BOOLEAN_CHOICES;
  select(value: string): void {
    if (this.context().disabled || this.context().readOnly) return;
    if (value === this.choices.yes) this.valueChange.emit(true);
    else if (value === this.choices.no) this.valueChange.emit(false);
    else if (value === this.choices.unset) this.valueChange.emit(null);
  }
}

export const ALTERNATIVE_THEME: ThemeDefinition = Object.freeze({
  id: 'alternative', cssClass: 'theme-alternative',
  overrides: Object.freeze({ [ThemeArtifact.FieldBoolean]: AlternativeBooleanRenderer }),
});
