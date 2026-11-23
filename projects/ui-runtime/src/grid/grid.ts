/** SPDX-License-Identifier: Apache-2.0 */
import { Component, computed, inject, input, output } from '@angular/core';
import { ThemeService } from '../theme/theme-runtime.js';
import { FormFrame, FormFieldOutlet } from '../form/form-outlets.js';
import type { FieldRendererContext, FieldValue } from '../field-types/renderer-context.js';
import type { FormFieldDefinition, ValuePath } from '../form/form-definition.js';
import {
    exactGridValue,
    snapshotGridPath,
    validateGrid,
    type DetailGridChange,
    type DetailGridColumn,
    type DetailGridContext,
    type DetailGridRow,
    type ListGridContext,
} from './grid-definition.js';

const styles = `:host, aur-form-frame { display:block; min-width:0; max-width:100%; } .scroll { overflow-x:auto; max-width:100%; padding:.25rem; } table { border-collapse:collapse; width:100%; } th,td { padding:.5rem; border:1px solid currentColor; text-align:start; } caption { text-align:start; font-weight:bold; padding:.5rem; } button { font:inherit; padding:.5rem; margin:.25rem; } :focus-visible { outline:3px solid currentColor; outline-offset:2px; } aur-form-field { display:block; min-width:12rem; }`;
@Component({
    selector: 'aur-list-grid',
    imports: [FormFrame],
    styles: [styles],
    host: { '[class]': 'theme.current().cssClass' },
    template: `<aur-form-frame
        presentation="listGrid"
        [context]="{ id: grid().id, label: grid().label }"
        ><div class="scroll" role="region" [attr.aria-label]="grid().label" tabindex="0">
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
                            @if (grid().selectable) {
                                <td>
                                    <button
                                        type="button"
                                        (click)="select(row.key)"
                                        [attr.aria-label]="'Select ' + row.label"
                                    >
                                        Select
                                    </button>
                                </td>
                            }
                        </tr>
                    } @empty {
                        <tr>
                            <td
                                [attr.colspan]="grid().columns.length + (grid().selectable ? 1 : 0)"
                            >
                                {{ grid().emptyLabel || 'No rows.' }}
                            </td>
                        </tr>
                    }
                </tbody>
            </table>
        </div></aur-form-frame
    >`,
})
export class ListGrid {
    readonly context = input.required<ListGridContext>();
    readonly rowSelected = output<string>();
    protected readonly theme = inject(ThemeService);
    readonly grid = computed(() => {
        validateGrid(this.context());
        return this.context();
    });
    select(key: string): void {
        if (this.grid().selectable && this.grid().rows.some((row) => row.key === key))
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
        ><div class="scroll" role="region" [attr.aria-label]="grid().label" tabindex="0">
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
        const rows = this.grid().rows;
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
    });
    protected rowLabel(row: DetailGridRow): string {
        return this.rowLabels().get(row.key)!;
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
