/** SPDX-License-Identifier: Apache-2.0 */
import {
    Component,
    ElementRef,
    Injector,
    ViewContainerRef,
    afterNextRender,
    computed,
    effect,
    inject,
    input,
    inputBinding,
    output,
    outputBinding,
    viewChild,
    type Type,
} from '@angular/core';
import type {
    FieldRenderer,
    FieldRendererContext,
    FieldValue,
} from '../field-types/renderer-context.js';
import type { OptionalControlFormField } from '../form/form-definition.js';
import type { EditingInput } from '../state/document-state.js';
import { ThemeRegistry, ThemeResolver } from '../theme/theme-runtime.js';
import { DocumentInput } from './document-input.js';
import { bindDocumentControl } from './document-control-binding.js';
import { retainedFocusWithin } from '../structure/retained-focus.js';

/** Scalar optional controls stay unchanged; this adapter owns lossless states and outward events. */
@Component({
    selector: 'aur-document-control',
    imports: [DocumentInput],
    host: {
        role: 'group',
        '[attr.aria-describedby]': "context().describedBy?.join(' ') || null",
        '[attr.aria-invalid]': 'context().invalid || null',
    },
    template: `<ng-container #target />
        @if (!binding().component) {
            <p role="status">This document input needs the lossless fallback.</p>
            <label [for]="context().id">{{ context().label + ' exact value' }}</label>
            <select
                [id]="context().id"
                [value]="binding().index < 0 ? '' : '' + binding().index"
                [disabled]="context().disabled || context().readOnly"
                [attr.aria-describedby]="context().describedBy?.join(' ') || null"
                [attr.aria-invalid]="context().invalid || null"
                (change)="choose($event)"
            >
                <option value="" disabled [selected]="binding().index < 0">
                    Select an exact value
                </option>
                @for (value of binding().request.domain.values; track $index) {
                    <option [value]="'' + $index" [selected]="binding().index === $index">
                        {{ label(value) }}
                    </option>
                }
            </select>
        }
        <aur-document-input
            [context]="context()"
            [draftLabel]="true"
            [multiline]="true"
            (editChange)="edit($event)"
        />`,
    styles: [
        ':host{display:block;min-width:0}label{display:block}select{font:inherit;max-width:100%;box-sizing:border-box}select:focus-visible{outline:3px solid currentColor;outline-offset:2px}',
    ],
})
export class DocumentControl {
    readonly field = input.required<OptionalControlFormField>();
    readonly context = input.required<FieldRendererContext>();
    readonly editChange = output<EditingInput>();
    private readonly registry = inject(ThemeRegistry);
    private readonly resolver = inject(ThemeResolver);
    protected readonly binding = computed(() =>
        bindDocumentControl(this.field(), this.context(), this.registry, this.resolver),
    );
    private readonly target = viewChild('target', { read: ViewContainerRef });
    private readonly root = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly injector = inject(Injector);
    private rendered?: Type<FieldRenderer>;
    private generation = 0;
    constructor() {
        effect(() => {
            const target = this.target();
            if (!target) return;
            const binding = this.binding(),
                component = binding.component;
            if (component === this.rendered) return;
            const root = this.root.nativeElement,
                document = root.ownerDocument;
            const active = document.activeElement;
            const focused =
                active && root.contains(active)
                    ? active
                    : active === document.body
                      ? retainedFocusWithin(root)
                      : undefined;
            const id = focused?.id;
            const generation = ++this.generation;
            target.clear();
            if (component) {
                // Keep an admitted scalar context until destruction, without disabling and
                // blurring the retiring control. Current binding/generation guards reject its outputs.
                const retiringContext = binding.scalarContext!;
                target.createComponent(component, {
                    bindings: [
                        inputBinding('context', () =>
                            this.binding().component === component
                                ? this.binding().scalarContext!
                                : retiringContext,
                        ),
                        outputBinding<FieldValue>('valueChange', (value) => {
                            if (generation === this.generation) this.select(value, component);
                        }),
                    ],
                });
            }
            this.rendered = component;
            if (focused)
                afterNextRender(
                    () => {
                        if (
                            generation !== this.generation ||
                            !root.isConnected ||
                            document.activeElement !== document.body
                        )
                            return;
                        const replacement =
                            [...root.querySelectorAll<HTMLElement>('[id]')].find(
                                (el) => el.id === id,
                            ) ?? root.querySelector<HTMLElement>('input,select,textarea,button');
                        replacement?.focus({ preventScroll: true });
                    },
                    { injector: this.injector },
                );
        });
    }
    label(value: FieldValue): string {
        return value === null
            ? 'Null'
            : typeof value === 'boolean'
              ? `Boolean ${value}`
              : `Text ${JSON.stringify(value)}`;
    }
    edit(input: EditingInput): void {
        if (!this.context().readOnly && !this.context().disabled) this.editChange.emit(input);
    }
    select(value: FieldValue, source: Type<FieldRenderer>): void {
        const binding = this.binding();
        if (
            source === binding.component &&
            binding.scalarContext &&
            binding.request.domain.values.includes(value)
        )
            this.edit({ kind: 'value', value });
    }
    choose(event: Event): void {
        const control = event.target as HTMLSelectElement;
        const text = control.value,
            index = Number(text);
        const values = this.binding().request.domain.values;
        if (
            !this.context().readOnly &&
            !this.context().disabled &&
            !this.binding().component &&
            String(index) === text &&
            index >= 0 &&
            index < values.length
        )
            this.edit({ kind: 'value', value: values[index]! });
        else control.value = this.binding().index < 0 ? '' : String(this.binding().index);
    }
}
