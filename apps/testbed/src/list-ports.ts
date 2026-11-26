/** Installed-APF list interaction probes; local application state, no data source or transport. */
import { Component, computed, inject, input, signal } from '@angular/core';
import {
    ListGrid,
    ThemePanelOutlet,
    ThemeService,
    type ListGridContext,
    type ListPaging,
    type ListQuery,
    type ListSelectionChange,
    type ListPageChange,
    type ListQueryChange,
} from '@alxarafe/ui-runtime';
const row = (key: string) => ({
    key,
    label: 'Repeated',
    values: {
        name: 'A long row label and exact text ' + key + ' 18446744073709551615 ' + 'W'.repeat(160),
    },
});
const choices = [
    { value: '', label: 'Default order' },
    { value: 'opaque /?#', label: 'Repeated label' },
    { value: 'other', label: 'Repeated label' },
];
@Component({
    selector: 'qa-testbed',
    imports: [ListGrid, ThemePanelOutlet],
    template: `<h1>Neutral list ports</h1>
        <div class="toolbar">
            @if (!embedded()) {
                @for (id of themes; track id) {
                    <button (click)="theme.activate(id)">{{ id }}</button>
                }
            }
            <button (click)="mode.set('a')">Supply page A</button
            ><button (click)="mode.set('b')">Supply page B</button>
            <button (click)="mode.set('empty')">Empty zero total</button
            ><button (click)="mode.set('unknown')">Empty unknown total</button>
            <button (click)="acceptSelection.set(!acceptSelection())">
                Toggle selection acceptance
            </button>
            <button (click)="busy.set(!busy())">Toggle busy</button
            ><button (click)="disabled.set(!disabled())">Toggle disabled</button
            ><button (click)="readOnly.set(!readOnly())">Toggle read-only</button>
            <button (click)="refresh.update(increment)">Refresh list context</button
            ><button (click)="available.set(!available())">Toggle next availability</button>
        </div>
        <aur-theme-panel
            ><aur-list-grid
                [context]="context()"
                [selectedKeys]="selected()"
                [paging]="paging()"
                [query]="query()"
                [busy]="busy()"
                [disabled]="disabled()"
                [readOnly]="readOnly()"
                (rowSelected)="single.update(append($event))"
                (selectionChange)="select($event)"
                (pageChange)="pages.update(append($event))"
                (queryChange)="edit($event)"
                (queryApply)="applies.update(append($event))"
        /></aur-theme-panel>
        <h2>Unchanged legacy list</h2>
        <aur-list-grid [context]="legacy" (rowSelected)="legacySelected.set($event)" />
        <output data-testid="list-state">{{
            encode({ mode: mode(), selected: selected(), query: query(), legacy: legacySelected() })
        }}</output>
        <output data-testid="list-events">{{
            encode({
                single: single(),
                selection: selection(),
                pages: pages(),
                edits: edits(),
                applies: applies(),
            })
        }}</output>`,
    styles: [
        ':host{display:block;min-width:0;padding:.5rem}.toolbar{display:flex;flex-wrap:wrap;gap:.25rem}button{font:inherit}output{display:block;overflow-wrap:anywhere}',
    ],
})
export class ListPortsTestbed {
    readonly embedded = input(false);
    readonly theme = inject(ThemeService);
    readonly themes = [
        'default',
        'alternative',
        'cyberpunk',
        'vintage',
        'high-contrast',
        'grid-frame',
    ];
    readonly mode = signal('a');
    readonly selected = signal<readonly string[]>(['outside', 'a /?#']);
    readonly acceptSelection = signal(false);
    readonly busy = signal(false);
    readonly disabled = signal(false);
    readonly readOnly = signal(false);
    readonly refresh = signal(0);
    readonly available = signal(true);
    readonly single = signal<readonly string[]>([]);
    readonly selection = signal<readonly ListSelectionChange[]>([]);
    readonly pages = signal<readonly ListPageChange[]>([]);
    readonly edits = signal<readonly ListQueryChange[]>([]);
    readonly applies = signal<readonly (readonly ListQueryChange[])[]>([]);
    readonly legacySelected = signal('');
    readonly increment = (n: number) => n + 1;
    readonly encode = JSON.stringify;
    append<T>(value: T): (items: readonly T[]) => readonly T[] {
        return (items) => [...items, value];
    }
    readonly context = computed<ListGridContext>(() => {
        this.refresh();
        return {
            id: 'ports',
            label: 'Controlled list',
            columns: [
                {
                    id: 'name',
                    field: 'name',
                    label: 'Very long column heading for horizontal scrolling and narrow viewports',
                },
            ],
            rows:
                this.mode() === 'a'
                    ? [row('a /?#'), row('b')]
                    : this.mode() === 'b'
                      ? [row('b'), row('c')]
                      : [],
            selectable: true,
        };
    });
    readonly paging = computed<ListPaging>(() => ({
        offset: this.mode() === 'b' ? 2 : this.mode() === 'unknown' ? 4 : 0,
        pageSize: 2,
        ...(this.mode() === 'unknown' ? {} : { total: this.mode() === 'empty' ? 0 : 4 }),
        previous: true,
        next: this.available(),
    }));
    readonly query = signal<ListQuery>({
        inputs: [
            { id: 'search', label: 'Search term', value: '' },
            { id: 'sort', label: 'Primary sort', value: '', choices },
            {
                id: 'filter',
                label: 'Filter text with a long application supplied label that must wrap at narrow viewport widths',
                value: '1e-',
                message: 'Application supplied filter guidance.',
            },
            {
                id: 'predicate',
                label: 'Application predicate',
                value: 'opaque-predicate',
                choices: [
                    { value: 'opaque-predicate', label: 'Application predicate one' },
                    { value: 'second', label: 'Application predicate two' },
                ],
            },
            { id: 'locked', label: 'Readonly query input', value: 'fixed', readOnly: true },
            { id: 'disabled', label: 'Disabled query input', value: 'fixed', disabled: true },
        ],
    });
    readonly legacy: ListGridContext = {
        id: 'legacy-list',
        label: 'Legacy list',
        columns: [{ id: 'name', field: 'name', label: 'Name' }],
        rows: [{ key: 'legacy-key', label: 'Legacy row', values: { name: 'Legacy value' } }],
        selectable: true,
    };
    select(intent: ListSelectionChange): void {
        this.selection.update(this.append(intent));
        if (this.acceptSelection())
            this.selected.update((keys) =>
                intent.selected ? [...keys, intent.key] : keys.filter((key) => key !== intent.key),
            );
    }
    edit(intent: ListQueryChange): void {
        this.edits.update(this.append(intent));
        this.query.update((query) => ({
            ...query,
            inputs: query.inputs.map((input) =>
                input.id === intent.id ? { ...input, value: intent.value } : input,
            ),
        }));
    }
}
