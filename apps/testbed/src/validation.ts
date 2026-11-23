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
    type DecimalFieldDefinition,
    type FieldValidationRequest,
    type FieldValidationResult,
    type FieldValue,
} from '@alxarafe/ui-runtime';
const path = [{ kind: 'property' as const, name: 'quantity' }];
const integer: IntegerFieldDefinition = {
    type: 'INTEGER',
    required: true,
    nullable: false,
    capacity: { bits: 64, signed: false },
};
const amountPath = [{ kind: 'property' as const, name: 'amount' }];
const decimal: DecimalFieldDefinition = {
    type: 'DECIMAL',
    required: true,
    nullable: false,
    allowExponent: true,
    constraints: { precision: 20, scale: 2, multipleOf: '0.05' },
};
const scalarDefinitions = {
    title: {
        type: 'STRING',
        required: true,
        nullable: false,
        constraints: { minimumLength: 1, maximumLength: 4 },
    },
    notes: { type: 'TEXT', required: true, nullable: false, constraints: { maximumLength: 8 } },
    flag: { type: 'BOOLEAN', required: true, nullable: false },
    choice: { type: 'ENUM', required: true, nullable: false, choices: ['', 'OPEN', 'CLOSED'] },
    binary: { type: 'BINARY', required: true, nullable: false, format: 'base64' },
    uuid: { type: 'UUID', required: true, nullable: false, casing: 'either' },
    date: { type: 'DATE', required: true, nullable: false, format: 'gregorian-date' },
    clock: {
        type: 'TIME',
        required: true,
        nullable: false,
        format: 'local-time',
        fractionalDigits: 7,
    },
    instant: {
        type: 'DATETIME',
        required: true,
        nullable: false,
        format: 'offset-instant',
        fractionalDigits: 7,
        constraints: {
            minimum: { value: '2026-11-23T17:00:00.1234567Z' },
            maximum: { value: '2026-11-23T17:00:00.1234567Z' },
        },
    },
} satisfies Record<string, FieldValidationRequest['definition']>;
type ScalarId = keyof typeof scalarDefinitions;
@Component({
    selector: 'qa-testbed',
    imports: [FormComposition],
    template: `<main>
        <h1>Local field validation QA</h1>
        @for (id of themes; track id) {
            <button (click)="theme.activate(id)" [attr.aria-pressed]="theme.current().id === id">
                {{ id }}
            </button>
        }
        <p>
            BINARY uses the public TEXT renderer for editing. Raw BOOLEAN uses an explicit STRING
            adapter; typed boolean actions do not parse text. DATE, TIME and DATETIME use public
            STRING adapters to retain incomplete input, seven fractional digits and explicit
            offsets.
        </p>
        <button (click)="rawBooleanDraft()">Edit raw BOOLEAN</button>
        <button (click)="typedBoolean()">Use boolean true</button>
        <aur-form [definition]="form()" [contexts]="contexts()" (fieldChange)="edit($event)" />
        <p id="integer-feedback" role="status">{{ feedback() }}</p>
        <p id="decimal-feedback" role="status">{{ decimalFeedback() }}</p>
        <output data-testid="decimal-validation-state">{{ decimalResult().state }}</output>
        <output data-testid="validation-state">{{ result().state }}</output>
        <output data-testid="validation-dirty">{{ state().dirty ? 'dirty' : 'clean' }}</output>
        @for (id of scalarIds; track id) {
            <p [id]="id + '-feedback'" role="status">{{ scalarFeedback(id) }}</p>
            <output [attr.data-testid]="'scalar-result-' + id">{{
                scalarResults()[id].state
            }}</output>
            <output [attr.data-testid]="'scalar-input-' + id">{{ encode(fieldInput(id)) }}</output>
        }
    </main>`,
    styles: [
        ':host{display:block;padding:1rem}button{padding:.5rem;margin:.25rem}main{max-width:60rem;margin:auto}',
    ],
})
export class ValidationTestbed {
    readonly scalarIds = Object.keys(scalarDefinitions) as ScalarId[];
    readonly encode = JSON.stringify;
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
                ...Object.fromEntries(
                    Object.entries({
                        title: ' A😀 ',
                        notes: 'e\u0301\n😀',
                        flag: false,
                        choice: '',
                        binary: 'Zg==',
                        uuid: '123e4567-e89b-12d3-a456-426614174000',
                        date: '2024-02-29',
                        clock: '12:30:00.1234567',
                        instant: '2026-11-23T18:00:00.1234567+01:00',
                    }).map(([id, value]) => [
                        id,
                        {
                            kind: 'field' as const,
                            equality: { type: 'exact' as const },
                            input: { kind: 'value' as const, value },
                        },
                    ]),
                ),
                amount: {
                    kind: 'field',
                    equality: { type: 'DECIMAL', allowExponent: true },
                    input: { kind: 'value', value: '9007199254740993.25' },
                },
                quantity: {
                    kind: 'field',
                    equality: { type: 'INTEGER' },
                    input: { kind: 'value', value: '1' },
                },
            },
        }),
    );
    readonly rawBoolean = computed(() => this.fieldInput('flag').kind === 'raw');
    readonly form = computed<FormDefinition>(() => ({
        id: 'integer-validation',
        label: 'Local validation',
        fields: [
            { id: 'quantity', path, artifact: 'field.INTEGER' },
            { id: 'amount', path: amountPath, artifact: 'field.DECIMAL' },
            { id: 'title', path: [{ kind: 'property', name: 'title' }], artifact: 'field.STRING' },
            { id: 'notes', path: [{ kind: 'property', name: 'notes' }], artifact: 'field.TEXT' },
            {
                id: 'flag',
                path: [{ kind: 'property', name: 'flag' }],
                artifact: this.rawBoolean() ? 'field.STRING' : 'field.BOOLEAN',
            },
            { id: 'choice', path: [{ kind: 'property', name: 'choice' }], artifact: 'field.ENUM' },
            { id: 'binary', path: [{ kind: 'property', name: 'binary' }], artifact: 'field.TEXT' },
            { id: 'uuid', path: [{ kind: 'property', name: 'uuid' }], artifact: 'field.UUID' },
            { id: 'date', path: [{ kind: 'property', name: 'date' }], artifact: 'field.STRING' },
            { id: 'clock', path: [{ kind: 'property', name: 'clock' }], artifact: 'field.STRING' },
            {
                id: 'instant',
                path: [{ kind: 'property', name: 'instant' }],
                artifact: 'field.STRING',
            },
        ],
    }));
    fieldInput(id: ScalarId) {
        return (this.state().current.properties[id] as DocumentField).input;
    }
    readonly scalarResults = computed(
        () =>
            Object.fromEntries(
                this.scalarIds.map((id) => [
                    id,
                    validateField({
                        definition: scalarDefinitions[id],
                        input: this.fieldInput(id),
                        path: [{ kind: 'property', name: id }],
                    }),
                ]),
            ) as Record<ScalarId, FieldValidationResult>,
    );
    scalarFeedback(id: ScalarId): string {
        const result = this.scalarResults()[id];
        return result.state === 'invalid'
            ? result.issues.map((issue) => issue.message).join(' ')
            : result.state === 'definition-error'
              ? 'QA definition error'
              : 'Locally valid.';
    }
    rawBooleanDraft(): void {
        this.state.update((state) =>
            applyDocumentChange(state, {
                kind: 'field',
                path: [{ kind: 'property', name: 'flag' }],
                input: { kind: 'raw', text: 'true' },
            }),
        );
    }
    typedBoolean(): void {
        this.state.update((state) =>
            applyDocumentChange(state, {
                kind: 'field',
                path: [{ kind: 'property', name: 'flag' }],
                input: { kind: 'value', value: true },
            }),
        );
    }
    readonly input = computed(
        () => (this.state().current.properties['quantity'] as DocumentField).input,
    );
    readonly result = computed(() =>
        validateField({ definition: integer, input: this.input(), path }),
    );
    readonly decimalInput = computed(
        () => (this.state().current.properties['amount'] as DocumentField).input,
    );
    readonly decimalResult = computed(() =>
        validateField({ definition: decimal, input: this.decimalInput(), path: amountPath }),
    );
    readonly decimalFeedback = computed(() => {
        const result = this.decimalResult();
        return result.state === 'invalid'
            ? result.issues.map((issue) => issue.message).join(' ')
            : result.state === 'definition-error'
              ? 'QA definition error'
              : 'Decimal is locally valid.';
    });
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
        const amount = this.decimalInput();
        return {
            ...Object.fromEntries(
                this.scalarIds.map((id) => {
                    const input = this.fieldInput(id);
                    if (input.kind === 'absent')
                        throw new Error('QA scalar projection requires a present input');
                    const value: FieldValue = input.kind === 'raw' ? input.text : input.value;
                    const label = {
                        title: 'Unicode title',
                        notes: 'Unicode notes',
                        flag: 'Boolean flag',
                        choice: 'Exact choice',
                        binary: 'Base64 draft (text adapter)',
                        uuid: 'UUID value',
                        date: 'Gregorian date (text adapter)',
                        clock: 'Local time (text adapter)',
                        instant: 'Offset instant (text adapter)',
                    }[id];
                    return [
                        id,
                        {
                            id: 'validated-' + id,
                            label,
                            value,
                            describedBy: [id + '-feedback'],
                            ...(id === 'choice'
                                ? { choices: scalarDefinitions.choice.choices }
                                : {}),
                        },
                    ];
                }),
            ),
            amount: {
                id: 'validated-amount',
                label: 'Exact amount',
                value:
                    amount.kind === 'raw'
                        ? amount.text
                        : amount.kind === 'value'
                          ? amount.value
                          : null,
                describedBy: ['decimal-feedback'],
            },
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
        if (intent.id === 'flag' && this.rawBoolean()) {
            if (typeof intent.value !== 'string')
                throw new Error('QA raw BOOLEAN adapter requires text');
            const text = intent.value;
            this.state.update((state) =>
                applyDocumentChange(state, {
                    kind: 'field',
                    path: intent.path,
                    input: { kind: 'raw', text },
                }),
            );
            return;
        }
        this.state.update((state) =>
            applyDocumentChange(state, {
                kind: 'field',
                path: intent.path,
                input: { kind: 'value', value: intent.value },
            }),
        );
    }
}
