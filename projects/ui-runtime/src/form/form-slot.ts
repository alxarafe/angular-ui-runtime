/** SPDX-License-Identifier: Apache-2.0 */
import {
    Component,
    Directive,
    EmbeddedViewRef,
    TemplateRef,
    ViewContainerRef,
    effect,
    inject,
    input,
    signal,
    untracked,
    viewChild,
} from '@angular/core';

/** Visual restriction supplied to application templates; application code enforces it. */
export interface FormSlotContext {
    readonly readOnly: boolean;
}

/** Only locally compiled Angular templates are supported. Inputs/outputs remain application-owned. */
@Directive({ selector: 'ng-template[aurFormSlot]' })
export class FormSlot {
    readonly aurFormSlot = input.required<string>();
    readonly template = inject<TemplateRef<FormSlotContext>>(TemplateRef);
    static ngTemplateContextGuard(
        _directive: FormSlot,
        context: unknown,
    ): context is FormSlotContext {
        return true;
    }
}

/** Internal outlet: keep the embedded view while only its visual context changes. */
@Component({
    selector: 'aur-form-slot',
    template: '<ng-container #target />',
    host: { style: 'display:block;min-width:0;overflow-wrap:anywhere' },
})
export class FormSlotOutlet {
    readonly template = input.required<TemplateRef<FormSlotContext>>();
    readonly readOnly = input(false);
    private readonly target = viewChild('target', { read: ViewContainerRef });
    private readonly view = signal<EmbeddedViewRef<FormSlotContext> | undefined>(undefined);
    constructor() {
        effect((cleanup) => {
            const target = this.target();
            const template = this.template();
            if (!target) return;
            const view = target.createEmbeddedView(template, {
                readOnly: untracked(this.readOnly),
            });
            this.view.set(view);
            cleanup(() => view.destroy());
        });
        // Context changes never invalidate the effect that owns the embedded view.
        effect(() => {
            const view = this.view();
            const readOnly = this.readOnly();
            if (!view || view.destroyed) return;
            view.context = { readOnly };
            view.markForCheck();
        });
    }
}
