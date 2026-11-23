/** SPDX-License-Identifier: Apache-2.0
 * Neutral parent-document probe; application updates intentionally live only here.
 */
import { Component, computed, inject, input, signal, viewChild } from '@angular/core';
import {
    FormComposition,
    ListGrid,
    ThemeService,
    type DetailGridChange,
    type DetailGridContext,
    type DetailGridRow,
    type FormDefinition,
    type FormLayout,
    type FormPresentationContext,
} from '@alxarafe/ui-runtime';
import { FORM_THEMES } from './form';
import { ratingRequest } from './rating-configuration';
@Component({
    template: '<aside class="grid-frame"><ng-content /></aside>',
    styles: ['.grid-frame {border:3px dashed currentColor;padding:.5rem;min-width:0;}'],
})
class GridFrame {
    readonly context = input.required<FormPresentationContext>();
}
export const GRID_THEMES = [
    ...FORM_THEMES,
    {
        id: 'grid-frame',
        cssClass: 'theme-default',
        overrides: {},
        components: { listGrid: GridFrame, detailGrid: GridFrame },
    },
];
const path = (name: string) => [{ kind: 'property' as const, name }];
const row = (key: string): DetailGridRow => ({
    key,
    label: 'Row ' + key,
    values: {
        quantity: '18446744073709551615',
        amount: '9223372036854775807.123456789',
        score: '3',
        locked: 'Protected',
    },
    contexts: {
        score: {
            control: ratingRequest({
                minimum: '0',
                maximum: '5',
                step: '1',
                stars: 5,
                nullable: true,
            }),
        },
        locked: { disabled: true },
    },
});
@Component({
    selector: 'qa-testbed',
    imports: [FormComposition, ListGrid],
    host: { '(document:keydown.alt.t)': 'nextTheme($event)' },
    template: `<main>
        <h1>Neutral grid QA</h1>
        <div class="controls">
            @for (id of themes; track id) {
                <button
                    [attr.aria-pressed]="theme.current().id === id"
                    (click)="theme.activate(id)"
                >
                    {{ id }}
                </button>
            }
            <button (click)="readOnly.set(!readOnly())">Toggle read-only</button
            ><button (click)="disabled.set(!disabled())">Toggle disabled</button
            ><button (click)="explicit.set(!explicit())">Toggle placement</button
            ><button (click)="listCount.set(0)">Empty list</button
            ><button (click)="listCount.set(1)">Single list</button
            ><button (click)="listCount.set(2)">Multiple list</button>
            <button (click)="form().revealField(headerPath)">Reveal document title</button>
            <button (click)="repeatLabels()">Use repeated row labels</button>
        </div>
        <aur-list-grid [context]="list()" (rowSelected)="selection.set($event)" /><output
            data-testid="selection"
            >{{ selection() }}</output
        ><aur-form
            [definition]="definition"
            [contexts]="{ title: { id: 'grid-title', label: 'Document title', value: title() } }"
            [collectionContexts]="collections()"
            [layout]="explicit() ? layout : undefined"
            [readOnly]="readOnly()"
            (fieldChange)="title.set($event.value)"
            (collectionChange)="apply($event)"
        /><output data-testid="grid-event">{{ event() }}</output
        ><output data-testid="grid-data">{{ encode(data()) }}</output>
    </main>`,
    styles: [
        ':host{display:block;padding:1rem;min-width:0;}main{max-width:1000px;margin:auto;min-width:0}.controls{display:flex;flex-wrap:wrap;gap:.5rem}button{font:inherit;padding:.5rem}output{display:block;overflow-wrap:anywhere}',
    ],
})
export class GridTestbed {
    readonly form = viewChild.required(FormComposition);
    readonly headerPath = path('title');
    readonly theme = inject(ThemeService);
    readonly themes = [
        'default',
        'alternative',
        'cyberpunk',
        'vintage',
        'high-contrast',
        'grid-frame',
    ];
    readonly title = signal<import('@alxarafe/ui-runtime').FieldValue>('Parent header');
    readonly readOnly = signal(false);
    readonly disabled = signal(false);
    readonly explicit = signal(true);
    readonly listCount = signal(2);
    readonly selection = signal('');
    readonly event = signal('');
    readonly encode = JSON.stringify;
    readonly data = signal<Record<string, readonly DetailGridRow[]>>({
        first: [row('a'), row('b')],
        second: [row('x')],
    });
    private counter = 0;
    readonly definition: FormDefinition = {
        id: 'parent',
        label: 'Parent document',
        fields: [{ id: 'title', path: path('title'), artifact: 'field.STRING' }],
        collections: [
            { id: 'first', path: path('first') },
            { id: 'second', path: path('second') },
            { id: 'private-collection', path: path('private-path'), excluded: true },
        ],
    };
    readonly layout: FormLayout = {
        actions: [],
        tabs: ['first', 'second'].map((id) => ({
            id,
            label: id === 'first' ? 'First collection' : 'Second collection',
            actions: [],
            sections: [
                {
                    id: 'section',
                    label: 'Collection section',
                    collapsible: false,
                    initiallyCollapsed: false,
                    actions: [],
                    groups: [
                        {
                            id: 'only',
                            label: 'Collection group',
                            fields: [],
                            collections: [
                                path(id),
                                path(id),
                                path('private-path'),
                                path('unknown-private'),
                            ],
                        },
                    ],
                },
            ],
        })),
    };
    readonly collections = computed(() =>
        Object.fromEntries(
            ['first', 'second'].map((id) => [
                id,
                {
                    id,
                    label: id === 'first' ? 'First rows' : 'Second rows',
                    path: path(id),
                    ordered: id === 'first',
                    readOnly: false,
                    disabled: this.disabled(),
                    allowAdd: true,
                    allowRemove: true,
                    allowReorder: true,
                    columns: [
                        {
                            id: 'title',
                            label: 'Quantity',
                            field: 'quantity',
                            artifact: 'field.INTEGER',
                        },
                        {
                            id: 'amount',
                            label: 'Amount',
                            field: 'amount',
                            artifact: 'field.DECIMAL',
                        },
                        {
                            id: 'score',
                            label: 'Score',
                            field: 'score',
                            kind: 'control',
                            controlId: 'rating',
                        },
                        {
                            id: 'locked',
                            label: 'Locked',
                            field: 'locked',
                            artifact: 'field.STRING',
                        },
                    ],
                    rows: this.data()[id]!,
                } satisfies DetailGridContext,
            ]),
        ),
    );
    readonly list = computed(() => ({
        id: 'list',
        label: 'Read-only list',
        selectable: true,
        columns: [
            { id: 'quantity', label: 'Quantity', field: 'quantity' },
            { id: 'amount', label: 'Amount', field: 'amount' },
        ],
        rows: this.data()['first']!.slice(0, this.listCount()),
    }));
    apply(intent: DetailGridChange): void {
        this.event.set(this.encode(intent));
        this.data.update((data) => {
            const rows = data[intent.collectionId]!;
            let next = rows;
            if (intent.kind === 'cell')
                next = rows.map((row) =>
                    row.key === intent.key
                        ? { ...row, values: { ...row.values, [intent.field]: intent.value } }
                        : row,
                );
            if (intent.kind === 'add-row') next = [...rows, row('new-' + ++this.counter)];
            if (intent.kind === 'remove-row') next = rows.filter((row) => row.key !== intent.key);
            if (intent.kind === 'move-row') {
                const moving = rows.find((row) => row.key === intent.key)!;
                const rest = rows.filter((row) => row.key !== intent.key);
                const index =
                    intent.before === null
                        ? rest.length
                        : rest.findIndex((row) => row.key === intent.before);
                next = [...rest.slice(0, index), moving, ...rest.slice(index)];
            }
            return { ...data, [intent.collectionId]: next };
        });
    }
    repeatLabels(): void {
        this.data.update((data) => ({
            ...data,
            first: data['first']!.map((row) => ({ ...row, label: 'Repeated row' })),
        }));
    }
    nextTheme(event: Event): void {
        event.preventDefault();
        const index = this.themes.indexOf(this.theme.current().id);
        this.theme.activate(this.themes[(index + 1) % this.themes.length]!);
    }
}
