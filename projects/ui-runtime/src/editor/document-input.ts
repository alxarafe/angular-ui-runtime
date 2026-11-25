/** SPDX-License-Identifier: Apache-2.0 */
import {
    Component,
    ViewContainerRef,
    computed,
    effect,
    inject,
    input,
    inputBinding,
    output,
    outputBinding,
    viewChild,
} from '@angular/core';
import type { FieldRendererContext, FieldValue } from '../field-types/renderer-context.js';
import { ThemeResolver } from '../theme/theme-runtime.js';
import type { EditingInput } from '../state/document-state.js';

/** Lossless opt-in bridge; legacy renderers and valueChange remain unchanged. */
@Component({
    selector: 'aur-document-input',
    template: `<ng-container #selection />
        @if (!enumeration() || draft()) {
            <label [for]="textId()">{{
                enumeration() ? context().label + ' draft' : context().label
            }}</label>
            @if (checkbox()) {
                <input
                    type="checkbox"
                    [id]="textId()"
                    [checked]="checked()"
                    [disabled]="context().disabled || context().readOnly"
                    [attr.aria-describedby]="context().describedBy?.join(' ') || null"
                    [attr.aria-invalid]="context().invalid || null"
                    (change)="toggle($event)"
                />
            } @else {
                <input
                    type="text"
                    [id]="textId()"
                    [value]="text()"
                    [disabled]="context().disabled"
                    [readOnly]="!!context().readOnly"
                    [attr.aria-describedby]="context().describedBy?.join(' ') || null"
                    [attr.aria-invalid]="context().invalid || null"
                    (input)="type($event)"
                />
            }
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
    readonly enumeration = input(false);
    readonly editChange = output<EditingInput>();
    private readonly selection = viewChild('selection', { read: ViewContainerRef });
    private readonly resolver = inject(ThemeResolver);
    private rendered?: unknown;
    /** Scalar projection for the themed chooser only; never a second draft. */
    private readonly selectionContext = computed<FieldRendererContext>(() => {
        const context = this.context(),
            documentInput = context.documentInput;
        return {
            ...context,
            value:
                documentInput?.kind === 'value' &&
                typeof documentInput.value === 'string' &&
                context.choices?.includes(documentInput.value)
                    ? documentInput.value
                    : null,
        };
    });
    constructor() {
        effect(() => {
            const target = this.selection();
            if (!target) return;
            if (!this.enumeration()) {
                target.clear();
                this.rendered = undefined;
                return;
            }
            const component = this.resolver.resolve('field.ENUM');
            if (component === this.rendered) return;
            target.clear();
            target.createComponent(component, {
                bindings: [
                    inputBinding('context', this.selectionContext),
                    outputBinding<FieldValue>('valueChange', (value) =>
                        this.emit({ kind: 'value', value }),
                    ),
                ],
            });
            this.rendered = component;
        });
    }
    draft(): boolean {
        const input = this.context().documentInput;
        return (
            input?.kind === 'raw' ||
            (input?.kind === 'value' &&
                input.value !== null &&
                (typeof input.value !== 'string' || !this.context().choices?.includes(input.value)))
        );
    }
    textId(): string {
        return this.context().id + (this.enumeration() ? '-draft' : '');
    }
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
                : this.enumeration() && this.draft()
                  ? 'Unknown value'
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
