import { documentNodeProblem } from '../state/document-state.js';
import { DocumentInput } from '../editor/document-input.js';
import type { EditingInput } from '../state/document-state.js';
/** SPDX-License-Identifier: Apache-2.0 */
import {
    Component,
    ElementRef,
    EmbeddedViewRef,
    Injector,
    TemplateRef,
    Type,
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
} from '@angular/core';
import type { FieldValue, FieldRendererContext } from '../field-types/renderer-context.js';
import { ThemeRegistry, ThemeResolver } from '../theme/theme-runtime.js';
import { captureRetainedFocus } from '../structure/retained-focus.js';
import { resolveFormFieldRenderer } from './form-field-renderer.js';
import type {
    FormFieldDefinition,
    FormFieldChange,
    FormFieldEdit,
    FormPresentationContext,
} from './form-definition.js';

@Component({
    selector: 'aur-form-frame',
    template:
        '<ng-template #projected><ng-content /></ng-template><ng-container #owned /><ng-container #target />',
})
export class FormFrame {
    readonly context = input.required<FormPresentationContext>();
    readonly presentation = input<'form' | 'listGrid' | 'detailGrid'>('form');
    private readonly source = viewChild<TemplateRef<unknown>>('projected');
    private readonly owned = viewChild('owned', { read: ViewContainerRef });
    private readonly target = viewChild('target', { read: ViewContainerRef });
    private readonly resolver = inject(ThemeResolver);
    private readonly injector = inject(Injector);
    private view?: EmbeddedViewRef<unknown>;
    private rendered?: Type<unknown>;
    private generation = 0;
    constructor() {
        effect(() => {
            const source = this.source(),
                owned = this.owned(),
                target = this.target();
            if (!source || !owned || !target) return;
            const component = this.resolver.resolveComponent(this.presentation());
            if (component === this.rendered) return;
            this.view ??= owned.createEmbeddedView(source);
            const roots = this.view.rootNodes as Node[];
            const document = target.element.nativeElement.ownerDocument as Document;
            const active = document.activeElement as HTMLElement | null;
            const focused = active && roots.some((root) => root.contains(active)) ? active : null;
            const generation = ++this.generation;
            const restore = captureRetainedFocus(target, roots, this.injector);
            target.clear();
            target.createComponent(component, {
                projectableNodes: [this.view.rootNodes],
                bindings: [inputBinding('context', this.context)],
            });
            this.rendered = component;
            restore();
            // A nested field renderer may also be replaced in this render. Retained-node
            // restoration handles surviving controls; map only a destroyed focused node.
            if (focused?.id)
                afterNextRender(
                    () => {
                        if (
                            generation !== this.generation ||
                            this.view?.destroyed ||
                            focused.isConnected ||
                            document.activeElement !== document.body
                        )
                            return;
                        for (const root of roots) {
                            if (root.nodeType !== 1 || !root.isConnected) continue;
                            const replacement = [
                                ...(root as HTMLElement).querySelectorAll<HTMLElement>('[id]'),
                            ].find((node) => node.id === focused.id);
                            if (replacement) {
                                replacement.focus({ preventScroll: true });
                                break;
                            }
                        }
                    },
                    { injector: this.injector },
                );
        });
    }
}
@Component({
    selector: 'aur-form-field',
    template: `<ng-container #target />
        @if (context().feedback?.length) {
            <div [id]="context().id + '-feedback'" aria-live="polite">
                @for (message of context().feedback; track $index) {
                    <p>{{ message }}</p>
                }
            </div>
        }`,
    host: {
        '[attr.data-aur-field]': 'field().id',
        role: 'group',
        '[attr.aria-describedby]': 'context().describedBy?.join(" ") || null',
    },
})
export class FormFieldOutlet {
    readonly field = input.required<FormFieldDefinition>();
    readonly context = input.required<FieldRendererContext>();
    readonly readOnly = input(false);
    readonly fieldChange = output<FormFieldChange>();
    readonly fieldEdit = output<FormFieldEdit>();
    private readonly registry = inject(ThemeRegistry);
    private readonly binding = computed(() => {
        const context = {
            ...this.context(),
            readOnly: this.readOnly() || this.context().readOnly,
            describedBy: [
                ...(this.context().describedBy ?? []),
                ...(this.context().feedback?.length ? [this.context().id + '-feedback'] : []),
            ],
        };
        if (
            context.documentInput !== undefined &&
            (this.field().kind === 'control' ||
                documentNodeProblem({
                    kind: 'field',
                    equality: { type: 'exact' },
                    input: context.documentInput,
                }))
        )
            throw new Error('Unsupported document editing context');
        return context.documentInput === undefined
            ? resolveFormFieldRenderer(this.field(), context, this.registry, this.resolver)
            : { component: DocumentInput, context };
    });
    private readonly boundContext = computed(() => this.binding().context);
    private readonly target = viewChild('target', { read: ViewContainerRef });
    private readonly root = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly resolver = inject(ThemeResolver);
    private readonly injector = inject(Injector);
    private rendered?: Type<unknown>;
    private generation = 0;
    constructor() {
        effect(() => {
            const target = this.target();
            if (!target) return;
            const component = this.binding().component;
            if (component === this.rendered) return;
            const root = this.root.nativeElement,
                document = root.ownerDocument;
            const active = document.activeElement;
            const focused = !!active && root.contains(active);
            const logicalId = active?.id;
            const generation = ++this.generation;
            target.clear();
            target.createComponent(component as Type<unknown>, {
                bindings: [
                    inputBinding('context', this.boundContext),
                    ...(component === DocumentInput
                        ? [
                              inputBinding(
                                  'boolean',
                                  () => this.field().artifact === 'field.BOOLEAN',
                              ),
                              inputBinding(
                                  'enumeration',
                                  () => this.field().artifact === 'field.ENUM',
                              ),
                              outputBinding<EditingInput>('editChange', (input) => {
                                  if (
                                      !this.boundContext().disabled &&
                                      !this.boundContext().readOnly
                                  )
                                      this.fieldEdit.emit({
                                          id: this.field().id,
                                          path: this.field().path,
                                          input,
                                      });
                              }),
                          ]
                        : [
                              outputBinding<FieldValue>('valueChange', (value) => {
                                  const field = this.field();
                                  if (
                                      !this.boundContext().disabled &&
                                      !this.boundContext().readOnly
                                  )
                                      this.fieldChange.emit({
                                          id: field.id,
                                          path: field.path,
                                          value,
                                      });
                              }),
                          ]),
                ],
            });
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
                        const elements = [...root.querySelectorAll<HTMLElement>('[id]')];
                        const replacement =
                            elements.find((element) => element.id === logicalId) ??
                            root.querySelector<HTMLElement>('input,select,textarea,button');
                        replacement?.focus({ preventScroll: true });
                    },
                    { injector: this.injector },
                );
        });
    }
}
