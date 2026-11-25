/** SPDX-License-Identifier: Apache-2.0 */
import { Component, computed, input, output } from '@angular/core';
import type { FieldRendererContext, FieldValue } from '../field-types/renderer-context.js';
import type { EditingInput } from '../state/document-state.js';
import { documentNodeProblem } from '../state/document-state.js';
import { DocumentInput } from '../editor/document-input.js';
import {
    snapshotChoiceOptions,
    type ChoicePageDirection,
    type ChoiceSelectorOptions,
} from './choice-options.js';

export interface ChoiceSelectorContext extends FieldRendererContext {
    readonly selector: ChoiceSelectorOptions;
}
/** Controlled selector: all input state is application/session-owned. */
@Component({
    selector: 'aur-choice-selector',
    imports: [DocumentInput],
    template: `<aur-document-input
            [context]="binding()"
            [enumeration]="true"
            [legacy]="context().documentInput === undefined"
            (editChange)="edit($event)"
            (pageChange)="pageChange.emit($event)"
        />
        @if (context().feedback?.length) {
            <div [id]="context().id + '-feedback'" aria-live="polite">
                @for (message of context().feedback; track $index) {
                    <p>{{ message }}</p>
                }
            </div>
        }`,
    styles: [':host{display:block;min-width:0}'],
})
export class ChoiceSelector {
    readonly context = input.required<ChoiceSelectorContext>();
    readonly editChange = output<EditingInput>();
    readonly valueChange = output<FieldValue>();
    readonly pageChange = output<ChoicePageDirection>();
    protected readonly binding = computed(() => {
        const context = this.context();
        if (context.control !== undefined)
            throw new Error('Choice selectors do not support optional-control requests');
        const documentInput =
            context.documentInput === undefined
                ? {
                      kind: 'value' as const,
                      value: context.value,
                  }
                : context.documentInput;
        if (
            documentNodeProblem({
                kind: 'field',
                equality: { type: 'exact' },
                input: documentInput,
            })
        )
            throw new Error('Invalid selector editing input');
        return {
            ...this.context(),
            selector: snapshotChoiceOptions(this.context().selector),
            describedBy: [
                ...new Set([
                    ...(this.context().describedBy ?? []),
                    ...(this.context().feedback?.length ? [this.context().id + '-feedback'] : []),
                    ...(this.context().selector.error
                        ? [this.context().id + '-choices-error']
                        : []),
                ]),
            ],
            documentInput,
        };
    });
    edit(input: EditingInput): void {
        const context = this.context();
        if (context.disabled || context.readOnly || context.selector.busy) return;
        if (context.documentInput !== undefined) this.editChange.emit(input);
        else if (input.kind !== 'absent')
            this.valueChange.emit(input.kind === 'raw' ? input.text : input.value);
    }
}
