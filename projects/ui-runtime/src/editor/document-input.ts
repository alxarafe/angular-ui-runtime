/** SPDX-License-Identifier: Apache-2.0 */
import { Component, input, output } from '@angular/core';
import type { FieldRendererContext } from '../field-types/renderer-context.js';
import type { EditingInput } from '../state/document-state.js';

/** Lossless opt-in bridge; legacy renderers and valueChange remain unchanged. */
@Component({
    selector: 'aur-document-input',
    template: `<label [for]="context().id">{{ context().label }}</label>
        @if (checkbox()) {
            <input
                type="checkbox"
                [id]="context().id"
                [checked]="checked()"
                [disabled]="context().disabled || context().readOnly"
                [attr.aria-describedby]="context().describedBy?.join(' ') || null"
                [attr.aria-invalid]="context().invalid || null"
                (change)="toggle($event)"
            />
        } @else {
            <input
                type="text"
                [id]="context().id"
                [value]="text()"
                [disabled]="context().disabled"
                [readOnly]="!!context().readOnly"
                [attr.aria-describedby]="context().describedBy?.join(' ') || null"
                [attr.aria-invalid]="context().invalid || null"
                (input)="type($event)"
            />
        }
        <span>{{ status() }}</span>
        <button
            type="button"
            [disabled]="blocked()"
            (click)="emit({ kind: 'absent' })"
            [attr.aria-label]="'Unset ' + context().label"
        >
            Unset
        </button>
        <button
            type="button"
            [disabled]="blocked()"
            (click)="emit({ kind: 'value', value: null })"
            [attr.aria-label]="'Set null ' + context().label"
        >
            Set null
        </button>
        <button
            type="button"
            [disabled]="blocked()"
            (click)="emit({ kind: 'value', value: '' })"
            [attr.aria-label]="'Set empty text ' + context().label"
        >
            Empty text
        </button>`,
    styles: [
        ':host{display:block;min-width:0}label{display:block}input,button{font:inherit;max-width:100%;box-sizing:border-box}button{margin:.2rem;padding:.35rem}span{margin:.3rem}input:focus-visible,button:focus-visible{outline:3px solid currentColor;outline-offset:2px}',
    ],
})
export class DocumentInput {
    readonly context = input.required<FieldRendererContext>();
    readonly boolean = input(false);
    readonly editChange = output<EditingInput>();
    checked(): boolean {
        const input = this.context().documentInput;
        return input?.kind === 'value' && input.value === true;
    }
    status(): string {
        const input = this.context().documentInput;
        return input?.kind === 'absent'
            ? 'Absent'
            : input?.kind === 'raw'
              ? 'Draft'
              : input?.kind === 'value' && input.value === null
                ? 'Null'
                : 'Value';
    }
    checkbox(): boolean {
        const input = this.context().documentInput;
        return (
            this.boolean() &&
            (input?.kind === 'absent' ||
                (input?.kind === 'value' &&
                    (input.value === null || typeof input.value === 'boolean')))
        );
    }
    blocked(): boolean {
        return !!this.context().disabled || !!this.context().readOnly;
    }
    text(): string {
        const slot = this.context().documentInput;
        return slot?.kind === 'raw'
            ? slot.text
            : slot?.kind === 'value' && slot.value !== null
              ? String(slot.value)
              : '';
    }
    emit(input: EditingInput): void {
        if (!this.blocked()) this.editChange.emit(input);
    }
    type(event: Event): void {
        this.emit({ kind: 'raw', text: (event.target as HTMLInputElement).value });
    }
    toggle(event: Event): void {
        this.emit({ kind: 'value', value: (event.target as HTMLInputElement).checked });
    }
}
