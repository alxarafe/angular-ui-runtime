/** SPDX-License-Identifier: Apache-2.0; adapted from ERBAS; see NOTICE. */
import { Component, Directive, computed, input, output } from '@angular/core';
import { FieldRenderer, FieldRendererContext, FieldValue } from '@alxarafe/ui-runtime';

@Directive()
export abstract class FieldRendererBase implements FieldRenderer {
  readonly context = input.required<FieldRendererContext>();
  readonly valueChange = output<FieldValue>();
  readonly text = computed(() => {
    const value = this.context().value;
    return typeof value === 'string' ? value : '';
  });
  update(value: FieldValue): void {
    if (!this.context().disabled && !this.context().readOnly) this.valueChange.emit(value);
  }
}
@Component({ selector: 'aur-default-boolean', host: { class: 'aur-default-field' }, templateUrl: './boolean.html' })
export class DefaultBooleanRenderer extends FieldRendererBase {}
@Component({ selector: 'aur-default-string', host: { class: 'aur-default-field' }, templateUrl: './string.html' })
export class DefaultStringRenderer extends FieldRendererBase {}
@Component({ selector: 'aur-default-text', host: { class: 'aur-default-field' }, templateUrl: './text.html' })
export class DefaultTextRenderer extends FieldRendererBase {}
@Component({ selector: 'aur-default-number', host: { class: 'aur-default-field' }, templateUrl: './number.html' })
export class DefaultNumberRenderer extends FieldRendererBase {}
@Component({ selector: 'aur-default-date', host: { class: 'aur-default-field' }, templateUrl: './date.html' })
export class DefaultDateRenderer extends FieldRendererBase {}
@Component({ selector: 'aur-default-time', host: { class: 'aur-default-field' }, templateUrl: './time.html' })
export class DefaultTimeRenderer extends FieldRendererBase {
  // Native Chromium time inputs cannot represent more than millisecond precision.
  readonly inputType = computed(() => (this.text().split('.')[1]?.length ?? 0) > 3 ? 'text' : 'time');
}
@Component({ selector: 'aur-default-enum', host: { class: 'aur-default-field' }, templateUrl: './enum.html' })
export class DefaultEnumRenderer extends FieldRendererBase {
  selectIndex(index: number): void {
    if (index === 0) this.update(null);
    else {
      const value = this.context().choices?.[index - 1];
      if (value !== undefined) this.update(value);
    }
  }
}
@Component({ selector: 'aur-default-binary', host: { class: 'aur-default-field' }, templateUrl: './binary.html' })
export class DefaultBinaryRenderer extends FieldRendererBase {}
