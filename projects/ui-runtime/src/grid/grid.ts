import {
    validateSelectedKeys,
    validateListPaging,
    snapshotListQuery,
    type ListSelectionChange,
    type ListPaging,
    type ListPageChange,
    type ListQuery,
    type ListQueryInput,
    type ListQueryChange,
} from './list-ports.js';
import { formPathKey } from '../form/value-path.js';
/** SPDX-License-Identifier: Apache-2.0 */
import { Component, ElementRef, computed, inject, input, output } from '@angular/core';
import { ThemeService } from '../theme/theme-runtime.js';
import { FormFrame, FormFieldOutlet } from '../form/form-outlets.js';
import type { FieldRendererContext, FieldValue } from '../field-types/renderer-context.js';
import type { FormFieldDefinition, ValuePath } from '../form/form-definition.js';
import type { ChoicePageDirection } from '../selector/choice-options.js';
import {
    exactGridValue,
    snapshotGridPath,
    validateGrid,
    type DetailGridChange,
    type DetailGridEdit,
    type DetailGridPage,
    type DetailGridColumn,
    type DetailGridContext,
    type DetailGridRow,
    type ListGridContext,
    type GridRow,
} from './grid-definition.js';

/** Ordinals describe presentation only; stable keys remain private event targets. */
function rowLabels(rows: readonly GridRow[]): Map<string, string> {
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row.label, (counts.get(row.label) ?? 0) + 1);
    const reserved = new Set(counts.keys()),
        used = new Set<string>();
    return new Map(
        rows.map((row, index) => {
            let label = row.label;
            if (counts.get(label)! > 1) {
                const suffix = ` (row ${index + 1})`;
                label += suffix;
                while (reserved.has(label) || used.has(label)) label += suffix;
            }
            used.add(label);
            return [row.key, label] as const;
        }),
    );
}

const styles = `:host, aur-form-frame { display:block; min-width:0; max-width:100%; } .scroll { overflow-x:auto; max-width:100%; padding:.25rem; } table { border-collapse:collapse; width:100%; } th,td { padding:.5rem; border:1px solid currentColor; text-align:start; } caption { text-align:start; font-weight:bold; padding:.5rem; } button { font:inherit; padding:.5rem; margin:.25rem; } :focus-visible { outline:3px solid currentColor; outline-offset:2px; } aur-form-field { display:block; min-width:12rem; }`;
@Component({
    selector: 'aur-list-grid',
    imports: [FormFrame, FormFieldOutlet],
    styles: [
        styles,
        '.query{display:flex;flex-wrap:wrap;gap:.75rem;min-width:0}.query aur-form-field{flex:1 1 14rem;min-width:0;max-width:100%}nav{display:flex;flex-wrap:wrap;align-items:center}button{max-width:100%;white-space:normal;overflow-wrap:anywhere}',
    ],
    host: { '[class]': 'theme.current().cssClass', '[attr.aria-busy]': 'busy()' },
    template: `<aur-form-frame
        presentation="listGrid"
        [context]="{ id: grid().id, label: grid().label }"
    >
        @if (queryContext(); as query) {
            <div class="query" role="group" [attr.aria-label]="grid().label + ' query'">
                @for (control of query.inputs; track control.id) {
                    <aur-form-field
                        [presentationOnly]="true"
                        [field]="queryField(control)"
                        [context]="queryContextFor(control)"
                        (fieldChange)="editQuery(control.id, $event.value)"
                    />
                }
                <button type="button" [disabled]="blocked()" (click)="applyQuery()">
                    {{ query.applyLabel || 'Apply query' }}
                </button>
            </div>
        }
        @if (keys(); as selected) {
            <p role="status">
                {{ selected.length }} selected; {{ outsideCount() }} outside this page.
            </p>
        }
        @if (busy()) {
            <p role="status">Loading rows.</p>
        }
        <div class="scroll" role="region" [attr.aria-label]="grid().label" tabindex="0">
            <table>
                <caption>
                    {{
                        grid().label
                    }}
                </caption>
                <thead>
                    <tr>
                        @for (column of grid().columns; track column.id) {
                            <th scope="col">{{ column.label }}</th>
                        }
                        @if (keys()) {
                            <th scope="col">Multiple selection</th>
                        }
                        @if (grid().selectable) {
                            <th scope="col">Selection</th>
                        }
                    </tr>
                </thead>
                <tbody>
                    @for (row of grid().rows; track row.key) {
                        <tr>
                            @for (column of grid().columns; track column.id) {
                                <td>
                                    {{
                                        row.values[column.field] === null
                                            ? '—'
                                            : row.values[column.field]
                                    }}
                                </td>
                            }
                            @if (keys()) {
                                <td>
                                    <input
                                        type="checkbox"
                                        [attr.aria-label]="'Include ' + rowLabel(row)"
                                        [checked]="isSelected(row.key)"
                                        [disabled]="blocked()"
                                        (change)="selectionEvent(row.key, $event)"
                                    />
                                </td>
                            }
                            @if (grid().selectable) {
                                <td>
                                    <button
                                        type="button"
                                        (click)="select(row.key)"
                                        [disabled]="blocked()"
                                        [attr.aria-label]="'Select ' + rowLabel(row)"
                                    >
                                        Select
                                    </button>
                                </td>
                            }
                        </tr>
                    } @empty {
                        <tr>
                            <td
                                [attr.colspan]="
                                    grid().columns.length +
                                    (grid().selectable ? 1 : 0) +
                                    (keys() ? 1 : 0)
                                "
                            >
                                {{ grid().emptyLabel || 'No rows.' }}
                            </td>
                        </tr>
                    }
                </tbody>
            </table>
        </div>
        @if (page(); as page) {
            <nav [attr.aria-label]="grid().label + ' pagination'">
                <button
                    type="button"
                    [disabled]="blocked() || !canPage('previous')"
                    (click)="requestPage('previous')"
                >
                    Previous page
                </button>
                <span
                    >Offset {{ page.offset }} · Page size {{ page.pageSize }} · Total
                    {{ page.total === undefined ? 'not supplied' : page.total }}</span
                >
                <button
                    type="button"
                    [disabled]="blocked() || !canPage('next')"
                    (click)="requestPage('next')"
                >
                    Next page
                </button>
            </nav>
        }
    </aur-form-frame>`,
})
export class ListGrid {
    readonly context = input.required<ListGridContext>();
    readonly rowSelected = output<string>();
    readonly selectedKeys = input<readonly string[]>();
    readonly selectionChange = output<ListSelectionChange>();
    readonly paging = input<ListPaging>();
    readonly pageChange = output<ListPageChange>();
    readonly query = input<ListQuery>();
    readonly queryChange = output<ListQueryChange>();
    readonly queryApply = output<readonly ListQueryChange[]>();
    readonly disabled = input(false);
    readonly readOnly = input(false);
    readonly busy = input(false);
    protected readonly blocked = computed(() => this.disabled() || this.readOnly() || this.busy());
    protected readonly keys = computed(() => {
        const keys = this.selectedKeys();
        if (keys === undefined) return undefined;
        validateSelectedKeys(keys);
        return Object.freeze([...keys]);
    });
    protected readonly page = computed(() => {
        const page = this.paging();
        if (page === undefined) return undefined;
        validateListPaging(page);
        return Object.freeze({ ...page });
    });
    protected readonly queryContext = computed(() =>
        this.query() === undefined ? undefined : snapshotListQuery(this.query()!),
    );
    protected readonly outsideCount = computed(
        () =>
            this.keys()?.filter((key) => !this.grid().rows.some((row) => row.key === key)).length ??
            0,
    );
    protected isSelected(key: string): boolean {
        return this.keys()?.includes(key) ?? false;
    }
    protected selectionEvent(key: string, event: Event): void {
        const target = event.target as HTMLInputElement;
        this.setSelected(key, target.checked);
        target.checked = this.isSelected(key);
    }
    setSelected(key: string, selected: boolean): void {
        if (
            !this.blocked() &&
            this.keys() &&
            typeof selected === 'boolean' &&
            this.grid().rows.some((row) => row.key === key) &&
            selected !== this.isSelected(key)
        )
            this.selectionChange.emit(Object.freeze({ key, selected }));
    }
    protected canPage(direction: ChoicePageDirection): boolean {
        const page = this.page();
        if (!page) return false;
        return direction === 'previous'
            ? page.previous && page.offset > 0
            : direction === 'next' &&
                  page.next &&
                  page.offset <= Number.MAX_SAFE_INTEGER - page.pageSize &&
                  (page.total === undefined || page.offset + page.pageSize < page.total);
    }
    requestPage(direction: ChoicePageDirection): void {
        const page = this.page();
        if (this.blocked() || !page || !this.canPage(direction)) return;
        this.pageChange.emit(
            Object.freeze({
                direction,
                offset:
                    direction === 'previous'
                        ? Math.max(0, page.offset - page.pageSize)
                        : page.offset + page.pageSize,
                pageSize: page.pageSize,
            }),
        );
    }
    protected queryField(control: ListQueryInput): FormFieldDefinition {
        return {
            id: control.id,
            path: [{ kind: 'property', name: control.id }],
            artifact: control.choices ? 'field.ENUM' : 'field.STRING',
        };
    }
    protected queryContextFor(control: ListQueryInput): FieldRendererContext {
        return {
            id:
                'aur-list-query-' +
                encodeURIComponent(JSON.stringify([this.grid().id, control.id])),
            label: control.label,
            value: control.value,
            documentInput: { kind: 'value', value: control.value },
            disabled: this.disabled() || control.disabled,
            readOnly: this.readOnly() || this.busy() || control.readOnly,
            ...(control.choices
                ? { selector: { options: control.choices, previous: false, next: false } }
                : {}),
            ...(control.message ? { feedback: [control.message] } : {}),
        };
    }
    editQuery(id: string, value: FieldValue): void {
        const control = this.queryContext()?.inputs.find((control) => control.id === id);
        if (
            this.blocked() ||
            !control ||
            control.disabled ||
            control.readOnly ||
            typeof value !== 'string' ||
            value === control.value ||
            (control.choices && !control.choices.some((choice) => choice.value === value))
        )
            return;
        this.queryChange.emit(Object.freeze({ id, value }));
    }
    applyQuery(): void {
        const query = this.queryContext();
        if (this.blocked() || !query) return;
        this.queryApply.emit(
            Object.freeze(query.inputs.map(({ id, value }) => Object.freeze({ id, value }))),
        );
    }
    protected readonly theme = inject(ThemeService);
    readonly grid = computed(() => {
        validateGrid(this.context());
        return this.context();
    });
    private readonly rowLabels = computed(() => rowLabels(this.grid().rows));
    protected rowLabel(row: GridRow): string {
        return this.rowLabels().get(row.key)!;
    }
    select(key: string): void {
        if (
            !this.blocked() &&
            this.grid().selectable &&
            this.grid().rows.some((row) => row.key === key)
        )
            this.rowSelected.emit(key);
    }
}
@Component({
    selector: 'aur-detail-grid',
    imports: [FormFrame, FormFieldOutlet],
    styles: [styles],
    host: { '[class]': 'theme.current().cssClass' },
    template: `<aur-form-frame
        presentation="detailGrid"
        [context]="{ id: grid().id, label: grid().label }"
    >
        @if (grid().message) {
            <p [id]="grid().id + '-message'">{{ grid().message }}</p>
        }
        <div
            [attr.aria-describedby]="grid().message ? grid().id + '-message' : null"
            class="scroll"
            role="region"
            [attr.aria-label]="grid().label"
            tabindex="0"
        >
            <table>
                <caption>
                    {{
                        grid().label
                    }}
                </caption>
                <thead>
                    <tr>
                        @for (column of grid().columns; track column.id) {
                            <th scope="col">{{ column.label }}</th>
                        }
                        <th scope="col">Row actions</th>
                    </tr>
                </thead>
                <tbody>
                    @for (row of grid().rows; track row.key; let index = $index) {
                        <tr>
                            @for (column of grid().columns; track column.id) {
                                <td>
                                    <aur-form-field
                                        [field]="field(row, column)"
                                        [context]="cell(row, column)"
                                        (fieldChange)="edit(row.key, column.field, $event.value)"
                                        (fieldEdit)="editInput(row.key, column.field, $event.input)"
                                        (fieldPage)="page(row.key, column.field, $event.direction)"
                                    />
                                </td>
                            }
                            <td>
                                @if (row.message) {
                                    <p [id]="messageId(row.key)">{{ row.message }}</p>
                                }
                                @if (grid().allowRemove) {
                                    <button
                                        type="button"
                                        [disabled]="blocked()"
                                        [attr.aria-label]="'Remove ' + rowLabel(row)"
                                        (click)="remove(row.key)"
                                    >
                                        Remove
                                    </button>
                                }
                                @if (grid().ordered && grid().allowReorder) {
                                    <button
                                        type="button"
                                        [disabled]="blocked() || index === 0"
                                        [attr.aria-label]="'Move up ' + rowLabel(row)"
                                        (click)="step(row.key, -1)"
                                    >
                                        Move up</button
                                    ><button
                                        type="button"
                                        [disabled]="blocked() || index === grid().rows.length - 1"
                                        [attr.aria-label]="'Move down ' + rowLabel(row)"
                                        (click)="step(row.key, 1)"
                                    >
                                        Move down
                                    </button>
                                }
                            </td>
                        </tr>
                    } @empty {
                        <tr>
                            <td [attr.colspan]="grid().columns.length + 1">
                                {{ grid().emptyLabel || 'No rows.' }}
                            </td>
                        </tr>
                    }
                </tbody>
            </table>
        </div>
        @if (grid().allowAdd) {
            <button
                type="button"
                [disabled]="blocked()"
                [attr.aria-label]="'Add row to ' + grid().label"
                (click)="add()"
            >
                Add row
            </button>
        }
    </aur-form-frame>`,
})
export class DetailGrid {
    readonly context = input.required<DetailGridContext>();
    readonly readOnly = input(false);
    readonly gridChange = output<DetailGridChange>();
    readonly gridEdit = output<DetailGridEdit>();
    readonly gridPage = output<DetailGridPage>();
    protected readonly theme = inject(ThemeService);
    readonly grid = computed(() => {
        validateGrid(this.context(), true);
        return this.context();
    });
    readonly blocked = computed(
        () => this.readOnly() || this.grid().readOnly || !!this.grid().disabled,
    );
    /** Ordinals describe presentation only; stable keys remain private event targets. */
    private readonly rowLabels = computed(() => {
        return rowLabels(this.grid().rows);
    });
    protected rowLabel(row: DetailGridRow): string {
        return this.rowLabels().get(row.key)!;
    }
    private readonly root = inject<ElementRef<HTMLElement>>(ElementRef, { optional: true });
    /** Exact typed path lookup; no CSS selector interpolation or positional row identity. */
    revealPath(path: ValuePath): boolean {
        const root = this.root?.nativeElement;
        if (!root) return false;
        const prefix = this.grid().path;
        if (
            path.length < prefix.length ||
            formPathKey(path.slice(0, prefix.length)) !== formPathKey(prefix)
        )
            return false;
        const row = path[prefix.length],
            field = path[prefix.length + 1];
        if (path.length === prefix.length) {
            const target = root.querySelector<HTMLElement>('.scroll');
            target?.focus();
            return !!target && target.ownerDocument.activeElement === target;
        }
        if (row?.kind !== 'row' || !this.grid().rows.some((item) => item.key === row.key))
            return false;
        const column =
            field?.kind === 'property'
                ? this.grid().columns.find((item) => item.field === field.name)
                : undefined;
        if (field && !column) return false;
        if (path.length > prefix.length + 2) return false;
        const controls = [...root.querySelectorAll<HTMLElement>('input,select,textarea,button')];
        for (const candidate of column ? [column] : this.grid().columns) {
            const id =
                'aur-cell-' +
                encodeURIComponent(JSON.stringify([this.grid().id, row.key, candidate.id]));
            const target = controls.find((item) => item.id === id);
            target?.focus();
            if (target && target.ownerDocument.activeElement === target) return true;
        }
        return false;
    }

    private path(key: string, field: string): ValuePath {
        return Object.freeze([
            ...snapshotGridPath(this.grid().path),
            Object.freeze({ kind: 'row' as const, key }),
            Object.freeze({ kind: 'property' as const, name: field }),
        ]);
    }
    field(row: DetailGridRow, column: DetailGridColumn): FormFieldDefinition {
        return { ...column, path: this.path(row.key, column.field) };
    }
    editInput(
        key: string,
        field: string,
        input: import('../state/document-state.js').EditingInput,
    ): void {
        const row = this.grid().rows.find((row) => row.key === key);
        const column = this.grid().columns.find((column) => column.field === field);
        if (!row || !column) throw new Error('Unknown grid cell');
        const context = this.cell(row, column);
        if (!context.disabled && !context.readOnly)
            this.gridEdit.emit(
                Object.freeze({
                    collectionId: this.grid().id,
                    collectionPath: snapshotGridPath(this.grid().path),
                    key,
                    field,
                    path: this.path(key, field),
                    input: Object.freeze({ ...input }),
                }),
            );
    }
    cell(row: DetailGridRow, column: DetailGridColumn): FieldRendererContext {
        const options = row.contexts?.[column.field];
        return {
            ...options,
            id:
                'aur-cell-' +
                encodeURIComponent(JSON.stringify([this.grid().id, row.key, column.id])),
            label: column.label + ' — ' + this.rowLabel(row),
            value: row.values[column.field]!,
            readOnly: this.blocked() || options?.readOnly,
            disabled: this.grid().disabled || options?.disabled,
            describedBy: [
                ...(options?.describedBy ?? []),
                ...(row.message ? [this.messageId(row.key)] : []),
            ],
        };
    }
    page(key: string, field: string, direction: ChoicePageDirection): void {
        const row = this.grid().rows.find((row) => row.key === key);
        const column = this.grid().columns.find((column) => column.field === field);
        if (!row || !column) throw new Error('Unknown grid cell');
        const context = this.cell(row, column);
        if (
            !context.disabled &&
            !context.readOnly &&
            !context.selector?.busy &&
            context.selector?.[direction]
        )
            this.gridPage.emit({
                collectionId: this.grid().id,
                collectionPath: snapshotGridPath(this.grid().path),
                key,
                field,
                path: this.path(key, field),
                direction,
            });
    }
    private emit(
        intent:
            | Omit<Extract<DetailGridChange, { kind: 'cell' }>, 'collectionId' | 'collectionPath'>
            | { kind: 'add-row' }
            | { kind: 'remove-row'; key: string }
            | { kind: 'move-row'; key: string; before: string | null },
    ): void {
        this.gridChange.emit(
            Object.freeze({
                ...intent,
                collectionId: this.grid().id,
                collectionPath: snapshotGridPath(this.grid().path),
            }),
        );
    }
    edit(key: string, property: string, value: FieldValue): void {
        const row = this.grid().rows.find((row) => row.key === key),
            column = this.grid().columns.find((column) => column.field === property);
        if (!row || !column) throw new Error('Unknown grid cell');
        exactGridValue(value);
        const context = this.cell(row, column);
        if (!context.readOnly && !context.disabled)
            this.emit({
                kind: 'cell',
                key,
                field: property,
                path: this.path(key, property),
                value,
            });
    }
    add(): void {
        if (!this.blocked() && this.grid().allowAdd) this.emit({ kind: 'add-row' });
    }
    messageId(key: string): string {
        return 'aur-row-message-' + encodeURIComponent(JSON.stringify([this.grid().id, key]));
    }
    step(key: string, direction: -1 | 1): void {
        const rows = this.grid().rows,
            index = rows.findIndex((row) => row.key === key);
        if (index < 0) throw new Error('Unknown grid row');
        if (index + direction < 0 || index + direction >= rows.length) return;
        this.move(key, direction === -1 ? rows[index - 1]!.key : (rows[index + 2]?.key ?? null));
    }
    remove(key: string): void {
        if (!this.grid().rows.some((row) => row.key === key)) throw new Error('Unknown grid row');
        if (!this.blocked() && this.grid().allowRemove) this.emit({ kind: 'remove-row', key });
    }
    move(key: string, before: string | null): void {
        const rows = this.grid().rows;
        if (
            !rows.some((row) => row.key === key) ||
            (before !== null && !rows.some((row) => row.key === before))
        )
            throw new Error('Unknown move target');
        if (!this.blocked() && this.grid().ordered && this.grid().allowReorder && before !== key)
            this.emit({ kind: 'move-row', key, before });
    }
}
