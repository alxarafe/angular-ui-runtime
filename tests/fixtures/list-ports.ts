import { Component } from '@angular/core';
import {
    ListGrid,
    type ListGridContext,
    type ListPaging,
    type ListQuery,
    type ListSelectionChange,
    type ListPageChange,
    type ListQueryChange,
} from '../../projects/ui-runtime/src/public-api.js';
@Component({
    imports: [ListGrid],
    template: `<aur-list-grid
        [context]="context"
        [selectedKeys]="keys"
        [paging]="paging"
        [query]="query"
        [busy]="false"
        [readOnly]="false"
        (selectionChange)="selection($event)"
        (pageChange)="page($event)"
        (queryChange)="edit($event)"
        (queryApply)="apply($event)"
        (rowSelected)="legacy($event)"
    />`,
})
export class ListPortConsumer {
    readonly context: ListGridContext = {
        id: 'list',
        label: 'List',
        columns: [{ id: 'name', field: 'name', label: 'Name' }],
        rows: [],
        selectable: true,
    };
    readonly keys: readonly string[] = ['outside'];
    readonly paging: ListPaging = { offset: 0, pageSize: 10, previous: false, next: true };
    readonly query: ListQuery = {
        inputs: [
            { id: 'search', label: 'Search', value: ' 1e- ' },
            { id: 'sort', label: 'Sort', value: '', choices: [{ value: '', label: 'Default' }] },
        ],
    };
    selection(_value: ListSelectionChange): void {}
    page(_value: ListPageChange): void {}
    edit(_value: ListQueryChange): void {}
    apply(_value: readonly ListQueryChange[]): void {}
    legacy(_value: string): void {}
}
const bad: ListSelectionChange = {
    // @ts-expect-error Selection keys are opaque strings, never row objects or numeric identifiers.
    key: 42,
    selected: true,
};
const nil: ListQueryChange = {
    id: 'filter',
    // @ts-expect-error Null semantics belong to the application; query values are exact strings.
    value: null,
};
const transport: ListPageChange = {
    // @ts-expect-error The pager emits neutral directions, not URLs.
    direction: '/api/next',
    offset: 10,
    pageSize: 10,
};
void [bad, nil, transport];
