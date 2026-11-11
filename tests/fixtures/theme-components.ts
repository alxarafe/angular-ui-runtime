import { Component, input, output } from '@angular/core';
import {
  type FieldRenderer, type FieldRendererContext, type FieldValue,
  type ThemeArtifacts, type ThemeDefinition, THEME_ARTIFACTS, ThemeId,
} from '../../projects/ui-runtime/src/public-api.js';

// Empty test components only: no application shells, CSS or field widgets.
@Component({ selector: 'aur-test-structure-probe', standalone: true, template: '' })
export class StructureProbe {}
@Component({ selector: 'aur-test-override-probe', standalone: true, template: '' })
export class OverrideProbe {}
@Component({ selector: 'aur-test-non-standalone-probe', standalone: false, template: '' })
export class NonStandaloneProbe {}
@Component({ selector: 'aur-test-field-probe', standalone: true, template: '' })
export class FieldProbe implements FieldRenderer {
  readonly context = input<FieldRendererContext>(EXACT_CONTEXT);
  readonly valueChange = output<FieldValue>();
}
@Component({ selector: 'aur-test-missing-output-probe', standalone: true, template: '' })
export class MissingOutputProbe {
  readonly context = input.required<FieldRendererContext>();
}
@Component({ selector: 'aur-test-missing-input-probe', standalone: true, template: '' })
export class MissingInputProbe {
  readonly valueChange = output<FieldValue>();
}
@Component({ selector: 'aur-test-aliased-field-probe', standalone: true, template: '' })
export class AliasedFieldProbe implements FieldRenderer {
  readonly context = input.required<FieldRendererContext>({ alias: 'wrongContext' });
  readonly valueChange = output<FieldValue>({ alias: 'wrongChange' });
}
export const DEFAULT_ARTIFACTS = Object.fromEntries(
  THEME_ARTIFACTS.map((artifact) => [artifact, artifact.startsWith('field.') ? FieldProbe : StructureProbe]),
) as ThemeArtifacts;
export const DEFAULT_THEME: ThemeDefinition = {
  id: ThemeId.Default, cssClass: 'theme-default', overrides: DEFAULT_ARTIFACTS,
};
// Compile-time contract checks preserve exact-value semantics.
const exact: FieldValue = '123456789012345678901234567890.123456789';
export const EXACT_CONTEXT: FieldRendererContext = {
  id: 'probe', label: 'Amount', value: exact, disabled: true, readOnly: true, choices: [exact],
};
// @ts-expect-error Numeric values must remain exact strings at this boundary.
const invalidNumber: FieldValue = 123;
// @ts-expect-error Dates must remain strings, without implicit conversion.
const invalidDate: FieldValue = new Date();
// @ts-expect-error Binary values must remain strings.
const invalidBinary: FieldValue = new Uint8Array();
void [invalidNumber, invalidDate, invalidBinary];
