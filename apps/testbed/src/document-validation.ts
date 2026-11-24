/** SPDX-License-Identifier: Apache-2.0
 * Repository-local document validation probe. No persistence or submission.
 */
import { Component, computed, inject, signal } from '@angular/core';
import {
    FormComposition,
    ThemeService,
    applyDocumentChange,
    createDocumentState,
    validateDocument,
    type DetailGridChange,
    type DetailGridContext,
    type DocumentCollection,
    type DocumentField,
    type DocumentObject,
    type DocumentRow,
    type FieldValue,
    type FormDefinition,
    type FormFieldChange,
    type ObjectValidationPlan,
    type ValidationFieldDefinition,
} from '@alxarafe/ui-runtime';

const property = (name: string) => ({ kind: 'property' as const, name });
const path = (name: string) => [property(name)];
const field = (value: FieldValue, equality: DocumentField['equality'] = { type: 'exact' }) =>
    ({
        kind: 'field',
        equality,
        input: { kind: 'value', value },
    }) satisfies DocumentField;
const object = (properties: DocumentObject['properties']): DocumentObject => ({
    kind: 'object',
    properties,
});
const row = (key: string, value: string): DocumentRow => ({
    key,
    value: object({ quantity: field(value, { type: 'INTEGER' }) }),
});
const collection = (rows: readonly DocumentRow[]): DocumentCollection => ({
    kind: 'collection',
    ordered: true,
    allowAdd: true,
    allowRemove: true,
    allowReorder: true,
    rows,
});
const definitions = {
    title: { type: 'STRING', required: true, nullable: false },
    external: {
        type: 'INTEGER',
        required: true,
        nullable: false,
        capacity: { bits: 32, signed: true },
    },
    customerCode: { type: 'STRING', required: true, nullable: false },
    serverCode: {
        type: 'STRING',
        required: true,
        nullable: false,
        constraints: { pattern: { dialect: 'server', source: '^SERVER_[A-Z]+$' } },
    },
    quantity: {
        type: 'INTEGER',
        required: true,
        nullable: false,
        capacity: { bits: 32, signed: true },
    },
} satisfies Record<string, ValidationFieldDefinition>;

const document: DocumentObject = object({
    title: field('Accepted title'),
    external: field('1', { type: 'INTEGER' }),
    serverCode: field('SERVER_ONE'),
    customer: object({ code: field('C-1') }),
    first: collection([row('a', '1'), row('b', '2')]),
    second: collection([row('x', '3')]),
});

const plan: ObjectValidationPlan = {
    kind: 'object',
    properties: {
        title: { kind: 'field', definition: definitions.title },
        external: { kind: 'field', definition: definitions.external },
        serverCode: { kind: 'field', definition: definitions.serverCode },
        customer: {
            kind: 'object',
            properties: { code: { kind: 'field', definition: definitions.customerCode } },
        },
        first: {
            kind: 'collection',
            row: {
                kind: 'object',
                properties: { quantity: { kind: 'field', definition: definitions.quantity } },
            },
        },
        second: {
            kind: 'collection',
            row: {
                kind: 'object',
                properties: { quantity: { kind: 'field', definition: definitions.quantity } },
            },
        },
    },
};

@Component({
    selector: 'qa-testbed',
    imports: [FormComposition],
    template: `<main>
        <h1>Document validation aggregation QA</h1>
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
        <section aria-labelledby="document-validation-heading">
            <h2 id="document-validation-heading">Application-owned document summary</h2>
            <p>
                Document status:
                <output data-testid="document-state">{{ result().state }}</output>
                · Editing:
                <output data-testid="document-dirty">{{
                    state().dirty ? 'dirty' : 'clean'
                }}</output>
                · Revision:
                <output data-testid="document-revision">{{ state().revision }}</output>
            </p>
            <p>Local issues</p>
            <ul data-testid="document-issues">
                @for (issue of result().issues; track $index) {
                    <li data-testid="document-issue">
                        {{ issue.code }}: {{ issue.message }}
                        <code data-testid="document-issue-path">{{ formatPath(issue.path) }}</code>
                    </li>
                }
            </ul>
            <p>Deferred server checks</p>
            <ul data-testid="document-checks">
                @for (check of result().checks; track $index) {
                    <li data-testid="document-check">
                        {{ check.reason }}
                        <code data-testid="document-check-path">{{ formatPath(check.path) }}</code>
                    </li>
                }
            </ul>
            <output data-testid="document-diagnostics"
                >{{ result().diagnostics.length }} definition diagnostics</output
            >
            <output data-testid="document-paths">{{ encode(fieldPaths()) }}</output>
        </section>
        <aur-form
            [definition]="definition"
            [contexts]="contexts()"
            [collectionContexts]="collections()"
            (fieldChange)="edit($event)"
            (collectionChange)="apply($event)"
        />
    </main>`,
    styles: [
        ':host{display:block;padding:1rem;min-width:0;}main{max-width:1000px;margin:auto;min-width:0}.controls{display:flex;flex-wrap:wrap;gap:.5rem}button{font:inherit;padding:.5rem}output{display:inline;overflow-wrap:anywhere}ul{min-height:1.5rem}code{overflow-wrap:anywhere}',
    ],
})
export class DocumentValidationTestbed {
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
        id: 'document-validation-parent',
        label: 'Document validation parent',
        fields: [
            { id: 'title', path: path('title'), artifact: 'field.STRING' },
            { id: 'external', path: path('external'), artifact: 'field.INTEGER' },
            { id: 'serverCode', path: path('serverCode'), artifact: 'field.STRING' },
            {
                id: 'customerCode',
                path: [property('customer'), property('code')],
                artifact: 'field.STRING',
            },
        ],
        collections: [
            { id: 'first', path: path('first') },
            { id: 'second', path: path('second') },
        ],
    };
    readonly result = computed(() => validateDocument({ document: this.state().current, plan }));
    readonly fieldPaths = computed(() => this.result().fields.map((entry) => entry.path));
    formatPath(value: readonly { kind: string; name?: string; key?: string }[]): string {
        return value
            .map((segment) => (segment.kind === 'row' ? `row:${segment.key}` : segment.name))
            .join(' / ');
    }
    private value(field: DocumentField): FieldValue {
        if (field.input.kind !== 'value') throw new Error('QA projection requires a value slot');
        return field.input.value;
    }
    readonly contexts = computed(() => {
        const current = this.state().current;
        return {
            title: {
                id: 'document-title',
                label: 'Document title',
                value: this.value(current.properties['title'] as DocumentField),
            },
            external: {
                id: 'document-external',
                label: 'External quantity',
                value: this.value(current.properties['external'] as DocumentField),
            },
            serverCode: {
                id: 'document-server-code',
                label: 'Server pattern code',
                value: this.value(current.properties['serverCode'] as DocumentField),
            },
            customerCode: {
                id: 'document-customer-code',
                label: 'Customer code',
                value: this.value(
                    (current.properties['customer'] as DocumentObject).properties[
                        'code'
                    ] as DocumentField,
                ),
            },
        };
    });
    readonly collections = computed(() =>
        Object.fromEntries(
            ['first', 'second'].map((id) => {
                const node = this.state().current.properties[id] as DocumentCollection;
                return [
                    id,
                    {
                        id,
                        path: path(id),
                        label: id === 'first' ? 'First detail rows' : 'Second detail rows',
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
