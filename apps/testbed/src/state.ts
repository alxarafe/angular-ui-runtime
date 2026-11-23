/** SPDX-License-Identifier: Apache-2.0
 * Repository-local parent-state probe. No persistence or validation workflow.
 */
import { Component, computed, inject, signal } from '@angular/core';
import {
    FormComposition,
    ThemeService,
    createDocumentState,
    applyDocumentChange,
    type DocumentObject,
    type DocumentField,
    type DocumentCollection,
    type DocumentRow,
    type FieldValue,
    type FormDefinition,
    type FormFieldChange,
    type DetailGridContext,
    type DetailGridChange,
} from '@alxarafe/ui-runtime';
const property = (name: string) => ({ kind: 'property' as const, name });
const field = (value: FieldValue, numeric = false): DocumentField => ({
    kind: 'field',
    equality: { type: numeric ? 'INTEGER' : 'exact' },
    input: { kind: 'value', value },
});
const row = (key: string, value: string): DocumentRow => ({
    key,
    value: { kind: 'object', properties: { quantity: field(value, true) } },
});
const collection = (rows: readonly DocumentRow[]): DocumentCollection => ({
    kind: 'collection',
    ordered: true,
    allowAdd: true,
    allowRemove: true,
    allowReorder: true,
    rows,
});
const document: DocumentObject = {
    kind: 'object',
    properties: {
        title: field('Accepted title'),
        first: collection([row('a', '18446744073709551615'), row('b', '2')]),
        second: collection([row('x', '3'), row('y', '4')]),
    },
};
@Component({
    selector: 'qa-testbed',
    imports: [FormComposition],
    template: `<main>
        <h1>Immutable document state QA</h1>
        <div class="controls">
            @for (id of themes; track id) {
                <button
                    (click)="theme.activate(id)"
                    [attr.aria-pressed]="theme.current().id === id"
                >
                    {{ id }}
                </button>
            }
        </div>
        <aur-form
            [definition]="definition"
            [contexts]="contexts()"
            [collectionContexts]="collections()"
            (fieldChange)="edit($event)"
            (collectionChange)="apply($event)"
        />
        <output data-testid="state-dirty">{{ state().dirty ? 'dirty' : 'clean' }}</output>
        <output data-testid="state-revision">{{ state().revision }}</output>
        <output data-testid="state-current">{{ encode(state().current) }}</output>
        <output data-testid="state-original">{{ encode(state().original) }}</output>
    </main>`,
    styles: [
        ':host{display:block;padding:1rem;min-width:0;}main{max-width:1000px;margin:auto;min-width:0}.controls{display:flex;flex-wrap:wrap;gap:.5rem}button{font:inherit;padding:.5rem}output{display:block;overflow-wrap:anywhere}',
    ],
})
export class StateTestbed {
    readonly theme = inject(ThemeService);
    readonly themes = [
        'default',
        'alternative',
        'cyberpunk',
        'vintage',
        'high-contrast',
        'grid-frame',
    ];
    readonly state = signal(createDocumentState(document));
    readonly encode = JSON.stringify;
    private counter = 0;
    readonly definition: FormDefinition = {
        id: 'state-parent',
        label: 'State parent',
        fields: [{ id: 'title', path: [property('title')], artifact: 'field.STRING' }],
        collections: ['first', 'second'].map((id) => ({ id, path: [property(id)] })),
    };
    private value(field: DocumentField): FieldValue {
        if (field.input.kind !== 'value') throw new Error('QA projection requires a value slot');
        return field.input.value;
    }
    readonly contexts = computed(() => ({
        title: {
            id: 'state-title',
            label: 'Document title',
            value: this.value(this.state().current.properties['title'] as DocumentField),
        },
    }));
    readonly collections = computed(() =>
        Object.fromEntries(
            ['first', 'second'].map((id) => {
                const node = this.state().current.properties[id] as DocumentCollection;
                return [
                    id,
                    {
                        id,
                        path: [property(id)],
                        label: id === 'first' ? 'First state rows' : 'Second state rows',
                        ordered: node.ordered,
                        readOnly: false,
                        allowAdd: node.allowAdd,
                        allowRemove: node.allowRemove,
                        allowReorder: node.allowReorder,
                        columns: [
                            {
                                id: 'quantity',
                                label: 'Quantity',
                                field: 'quantity',
                                artifact: 'field.INTEGER',
                            },
                        ],
                        rows: node.rows.map((row) => ({
                            key: row.key,
                            label: 'Row ' + row.key,
                            values: {
                                quantity: this.value(
                                    row.value.properties['quantity'] as DocumentField,
                                ),
                            },
                        })),
                    } satisfies DetailGridContext,
                ];
            }),
        ),
    );
    edit(intent: FormFieldChange): void {
        this.state.update((state) =>
            applyDocumentChange(state, {
                kind: 'field',
                path: intent.path,
                input: { kind: 'value', value: intent.value },
            }),
        );
    }
    apply(intent: DetailGridChange): void {
        this.state.update((state) => {
            if (intent.kind === 'cell')
                return applyDocumentChange(state, {
                    kind: 'field',
                    path: intent.path,
                    input: { kind: 'value', value: intent.value },
                });
            if (intent.kind === 'add-row')
                return applyDocumentChange(state, {
                    kind: 'add-row',
                    path: intent.collectionPath,
                    row: row('new-' + ++this.counter, '0'),
                });
            if (intent.kind === 'remove-row')
                return applyDocumentChange(state, {
                    kind: 'remove-row',
                    path: intent.collectionPath,
                    key: intent.key,
                });
            return applyDocumentChange(state, {
                kind: 'move-row',
                path: intent.collectionPath,
                key: intent.key,
                before: intent.before,
            });
        });
    }
}
