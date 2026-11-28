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
import { dateInputBounds, parseTemporal } from '../validation/temporal-values.js';
import type { ChoicePageDirection } from '../selector/choice-options.js';
import { selectedTime, timeInputBounds } from './native-time.js';

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
            } @else if (multiline()) {
                <textarea
                    [id]="textId()"
                    [value]="text()"
                    [disabled]="context().disabled"
                    [readOnly]="!!context().readOnly || !!context().selector?.busy"
                    [attr.aria-describedby]="context().describedBy?.join(' ') || null"
                    [attr.aria-invalid]="context().invalid || null"
                    (input)="type($event)"
                ></textarea>
            } @else {
                <input
                    type="text"
                    [id]="textId()"
                    [value]="text()"
                    [disabled]="context().disabled"
                    [readOnly]="!!context().readOnly || !!context().selector?.busy"
                    [attr.aria-describedby]="context().describedBy?.join(' ') || null"
                    [attr.aria-invalid]="context().invalid || null"
                    (input)="type($event)"
                />
            }
        }
        @if (date()) {
            <label [for]="context().id + '-date'">{{ context().label + ' date selection' }}</label>
            <input
                type="date"
                [id]="context().id + '-date'"
                [value]="dateText()"
                [min]="dateBounds().min"
                [max]="dateBounds().max"
                [disabled]="context().disabled"
                [readOnly]="!!context().readOnly || !!context().selector?.busy"
                [attr.aria-describedby]="context().describedBy?.join(' ') || null"
                [attr.aria-invalid]="context().invalid || null"
                (input)="selectDate($event)"
            />
        }
        @if (time() && timeBounds(); as bounds) {
            <label [for]="context().id + '-time'">{{ context().label + ' time selection' }}</label>
            <input
                type="time"
                [id]="context().id + '-time'"
                [value]="timeText()"
                [min]="bounds.min"
                [max]="bounds.max"
                step="1"
                [disabled]="context().disabled"
                [readOnly]="!!context().readOnly || !!context().selector?.busy"
                [attr.aria-describedby]="context().describedBy?.join(' ') || null"
                [attr.aria-invalid]="context().invalid || null"
                (input)="selectTime($event)"
            />
        }
        <span>{{ status() }}</span>
        @if (context().selector; as page) {
            <div
                role="group"
                [attr.aria-label]="context().label + ' pages'"
                [attr.aria-busy]="page.busy || null"
            >
                <button
                    type="button"
                    [disabled]="blocked() || !page.previous"
                    (click)="pageRequest('previous')"
                >
                    Previous choices
                </button>
                <button
                    type="button"
                    [disabled]="blocked() || !page.next"
                    (click)="pageRequest('next')"
                >
                    Next choices
                </button>
                @if (page.pageLabel) {
                    <span>{{ page.pageLabel }}</span>
                }
                @if (page.busy) {
                    <span role="status">Loading choices</span>
                }
                @if (page.error) {
                    <p role="alert" [id]="context().id + '-choices-error'">{{ page.error }}</p>
                }
            </div>
        }
        @if (!legacy()) {
            <button
                type="button"
                [disabled]="blocked()"
                (click)="emit({ kind: 'absent' })"
                [attr.aria-label]="'Unset ' + context().label"
            >
                Unset
            </button>
        }
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
        ':host{display:block;min-width:0}label{display:block}input,textarea,button{font:inherit;max-width:100%;box-sizing:border-box}button{margin:.2rem;padding:.35rem}span{margin:.3rem}input:focus-visible,textarea:focus-visible,button:focus-visible{outline:3px solid currentColor;outline-offset:2px}',
    ],
})
export class DocumentInput {
    readonly context = input.required<FieldRendererContext>();
    readonly date = input(false);
    readonly dateBounds = computed(() => dateInputBounds(this.context().dateConstraints));
    readonly time = input(false);
    readonly timeBounds = computed(() => timeInputBounds(this.context().timeDefinition));
    readonly multiline = input(false);
    readonly boolean = input(false);
    readonly enumeration = input(false);
    readonly legacy = input(false);
    readonly editChange = output<EditingInput>();
    readonly pageChange = output<ChoicePageDirection>();
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
                this.known(documentInput.value)
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
                (typeof input.value !== 'string' || !this.known(input.value)))
        );
    }
    private known(value: string): boolean {
        const context = this.context();
        return context.selector !== undefined
            ? context.selector.options.some((option) => option.value === value) ||
                  context.selector.current?.value === value
            : !!context.choices?.includes(value);
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
        return (
            !!this.context().disabled ||
            !!this.context().readOnly ||
            !!this.context().selector?.busy
        );
    }
    pageRequest(direction: ChoicePageDirection): void {
        if (!this.blocked() && this.context().selector?.[direction])
            this.pageChange.emit(direction);
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
        this.emit({
            kind: 'raw',
            text: (event.target as HTMLInputElement | HTMLTextAreaElement).value,
        });
    }
    dateText(): string {
        const text = this.text();
        return parseTemporal(text, 'DATE', 0) === undefined ? '' : text;
    }
    selectDate(event: Event): void {
        const control = event.target as HTMLInputElement;
        const text = control.value;

        if (parseTemporal(text, 'DATE', 0) === undefined) {
            // Ignored native edits still change the DOM; restore it from the document.
            control.value = this.dateText();
            return;
        }

        this.emit({ kind: 'raw', text });
    }
    toggle(event: Event): void {
        this.emit({ kind: 'value', value: (event.target as HTMLInputElement).checked });
    }
    timeText(): string {
        const text = this.text();
        return parseTemporal(text, 'TIME', 0) === undefined ? '' : text;
    }
    selectTime(event: Event): void {
        const control = event.target as HTMLInputElement;
        const text = selectedTime(control.value);
        if (this.blocked() || !this.timeBounds() || text === undefined) {
            control.value = this.timeText();
            return;
        }
        this.emit({ kind: 'raw', text });
    }
}
