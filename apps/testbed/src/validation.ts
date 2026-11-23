/** SPDX-License-Identifier: Apache-2.0 */
import { Component, computed, inject, signal } from '@angular/core';
import {
    FormComposition,
    ThemeService,
    validateField,
    createDocumentState,
    applyDocumentChange,
    type DocumentField,
    type FormFieldChange,
    type FormDefinition,
    type IntegerFieldDefinition,
} from '@alxarafe/ui-runtime';
const path = [{ kind: 'property' as const, name: 'quantity' }];
const integer: IntegerFieldDefinition = {
    type: 'INTEGER',
    required: true,
    nullable: false,
    capacity: { bits: 64, signed: false },
};
@Component({
    selector: 'qa-testbed',
    imports: [FormComposition],
    template: `<main>
        <h1>Local INTEGER validation QA</h1>
        @for (id of themes; track id) {
            <button (click)="theme.activate(id)" [attr.aria-pressed]="theme.current().id === id">
                {{ id }}
            </button>
        }
        <aur-form [definition]="form" [contexts]="contexts()" (fieldChange)="edit($event)" />
        <p id="integer-feedback" role="status">{{ feedback() }}</p>
        <output data-testid="validation-state">{{ result().state }}</output>
        <output data-testid="validation-dirty">{{ state().dirty ? 'dirty' : 'clean' }}</output>
    </main>`,
    styles: [
        ':host{display:block;padding:1rem}button{padding:.5rem;margin:.25rem}main{max-width:60rem;margin:auto}',
    ],
})
export class ValidationTestbed {
    readonly theme = inject(ThemeService);
    readonly themes = [
        'default',
        'alternative',
        'cyberpunk',
        'vintage',
        'high-contrast',
        'grid-frame',
    ];
    readonly state = signal(
        createDocumentState({
            kind: 'object',
            properties: {
                quantity: {
                    kind: 'field',
                    equality: { type: 'INTEGER' },
                    input: { kind: 'value', value: '1' },
                },
            },
        }),
    );
    readonly form: FormDefinition = {
        id: 'integer-validation',
        label: 'Local validation',
        fields: [{ id: 'quantity', path, artifact: 'field.INTEGER' }],
    };
    readonly input = computed(
        () => (this.state().current.properties['quantity'] as DocumentField).input,
    );
    readonly result = computed(() =>
        validateField({ definition: integer, input: this.input(), path }),
    );
    readonly feedback = computed(() => {
        const result = this.result();
        return result.state === 'invalid'
            ? result.issues.map((issue) => issue.message).join(' ')
            : result.state === 'definition-error'
              ? 'QA definition error'
              : 'Integer is locally valid.';
    });
    readonly contexts = computed(() => {
        const input = this.input();
        return {
            quantity: {
                id: 'validated-quantity',
                label: 'Exact quantity',
                value:
                    input.kind === 'raw' ? input.text : input.kind === 'value' ? input.value : null,
                describedBy: ['integer-feedback'],
            },
        };
    });
    edit(intent: FormFieldChange): void {
        this.state.update((state) =>
            applyDocumentChange(state, {
                kind: 'field',
                path: intent.path,
                input: { kind: 'value', value: intent.value },
            }),
        );
    }
}
