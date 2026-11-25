/** Installed-APF selector QA: application-supplied pages, no network or metadata. */
import { Component, computed, inject, signal } from '@angular/core';
import {
    ChoiceSelector,
    FormComposition,
    ThemePanelOutlet,
    ThemeService,
    DocumentSession,
    createDocumentState,
    bindDocumentEditor,
    applyDocumentFieldIntent,
    applyDocumentCollectionIntent,
    type ChoiceSelectorOptions,
    type EditingInput,
    type FieldValue,
    type FormFieldEdit,
    type DetailGridEdit,
    type FormFieldPage,
    type DetailGridPage,
    type DocumentField,
    type FormDefinition,
} from '@alxarafe/ui-runtime';
const p = (name: string) => ({ kind: 'property' as const, name });
const outside = 'outside /?#';
const opaque = 'opaque /?#" e\u0301';
const rowKey = 'a /?#';
const pageA: ChoiceSelectorOptions = {
    options: [
        { value: '', label: 'Empty choice' },
        { value: opaque, label: 'Repeated' },
        { value: '9007199254740993', label: 'Repeated' },
    ],
    previous: false,
    next: true,
    pageLabel: 'Page A',
};
const pageB: ChoiceSelectorOptions = {
    options: [{ value: 'second', label: 'Second page' }],
    previous: true,
    next: false,
    pageLabel: 'Page B',
};
const field = () => ({
    kind: 'field' as const,
    equality: { type: 'exact' as const },
    input: { kind: 'value' as const, value: outside },
});
const definition: FormDefinition = {
    id: 'selector-editor',
    label: 'Selector editor',
    fields: [{ id: 'choice', path: [p('choice')], artifact: 'field.STRING' }],
    collections: [{ id: 'rows', path: [p('rows')] }],
};
const scalar = {
    kind: 'field' as const,
    definition: {
        type: 'STRING' as const,
        required: false,
        nullable: true,
        constraints: { minimumLength: 1 },
    },
};
@Component({
    selector: 'qa-testbed',
    imports: [ChoiceSelector, FormComposition, ThemePanelOutlet],
    template: `<h1>Paged selector</h1>
        <div class="toolbar">
            @for (id of themes; track id) {
                <button (click)="theme.activate(id)">{{ id }}</button>
            }
            <button (click)="page.set(pageA)">Apply page A</button
            ><button (click)="page.set(pageB)">Apply page B</button>
            <button (click)="busy()">Busy page</button><button (click)="fail()">Fail page</button>
            <button (click)="flags.set({ readOnly: true })">Read only selectors</button
            ><button (click)="flags.set({ disabled: true })">Disable selectors</button
            ><button (click)="flags.set({})">Enable selectors</button>
            <button (click)="input({ kind: 'value', value: 'UNKNOWN' })">Unknown selection</button>
            <button (click)="input({ kind: 'raw', text: 'invalid draft' })">Raw selection</button>
        </div>
        <aur-theme-panel>
            <form aria-label="Ordinary form">
                <aur-choice-selector
                    [context]="legacyContext()"
                    (valueChange)="legacy($event)"
                    (editChange)="unexpected()"
                    (pageChange)="lastPage.set($event)"
                />
            </form>
            <aur-form
                [definition]="definition"
                [contexts]="binding().contexts"
                [collectionContexts]="binding().collectionContexts"
                (fieldEdit)="edit($event)"
                (fieldChange)="unexpected()"
                (collectionEdit)="cell($event)"
                (collectionChange)="structure($event)"
                (fieldPage)="lastPage.set($event)"
                (collectionPage)="lastPage.set($event)"
            />
        </aur-theme-panel>
        <output data-testid="selector-state">{{ encode(session.state.current) }}</output>
        <output data-testid="selector-events">{{
            encode({
                edits: edits(),
                legacy: legacyValues(),
                unexpected: duplicates(),
                last: lastEdit(),
                page: lastPage(),
            })
        }}</output>`,
    styles: [
        ':host{display:block;min-width:0;padding:.5rem}.toolbar{display:flex;flex-wrap:wrap;gap:.25rem}button{font:inherit}output{display:block;overflow-wrap:anywhere}',
    ],
})
export class SelectorTestbed {
    readonly themes = ['default', 'alternative', 'cyberpunk', 'vintage', 'high-contrast'];
    readonly theme = inject(ThemeService);
    readonly pageA = pageA;
    readonly pageB = pageB;
    readonly definition = definition;
    readonly page = signal(pageA);
    readonly flags = signal<{ readOnly?: boolean; disabled?: boolean }>({});
    readonly tick = signal(0);
    readonly edits = signal(0);
    readonly duplicates = signal(0);
    readonly lastEdit = signal<FormFieldEdit | DetailGridEdit | null>(null);
    readonly lastPage = signal<FormFieldPage | DetailGridPage | string | null>(null);
    readonly legacyValue = signal<FieldValue>(null);
    readonly legacyValues = signal<readonly FieldValue[]>([]);
    readonly session = new DocumentSession(
        createDocumentState({
            kind: 'object',
            properties: {
                choice: field(),
                rows: {
                    kind: 'collection',
                    ordered: true,
                    allowAdd: false,
                    allowRemove: false,
                    allowReorder: true,
                    rows: [rowKey, 'b'].map((key) => ({
                        key,
                        value: { kind: 'object', properties: { choice: field() } },
                    })),
                },
            },
        }),
    );
    private readonly unsubscribe = this.session.subscribe(() => this.tick.update((n) => n + 1));
    ngOnDestroy(): void {
        this.unsubscribe();
    }
    selector(input: EditingInput): ChoiceSelectorOptions {
        const current =
            input.kind === 'value'
                ? [
                      ...pageA.options,
                      ...pageB.options,
                      { value: outside, label: 'Current outside' },
                  ].find((option) => option.value === input.value)
                : undefined;
        return { ...this.page(), ...(current ? { current } : {}) };
    }
    readonly legacyContext = computed(() => ({
        id: 'ordinary-choice',
        label: 'Ordinary choice',
        value: this.legacyValue(),
        selector: this.selector({ kind: 'value', value: this.legacyValue() }),
        ...this.flags(),
    }));
    readonly binding = computed(() => {
        this.tick();
        const input = (this.session.state.current.properties['choice'] as DocumentField).input;
        const result = bindDocumentEditor(this.session, {
            definition,
            plan: {
                kind: 'object',
                properties: {
                    choice: scalar,
                    rows: {
                        kind: 'collection',
                        row: { kind: 'object', properties: { choice: scalar } },
                    },
                },
            },
            fields: {
                choice: {
                    id: 'header-choice',
                    label: 'Header choice',
                    selector: this.selector(input),
                    ...this.flags(),
                },
            },
            collections: {
                rows: {
                    label: 'Choices',
                    columns: [
                        {
                            id: 'choice',
                            field: 'choice',
                            label: 'Row choice',
                            artifact: 'field.STRING',
                        },
                    ],
                    fields: { choice: { selector: this.page(), ...this.flags() } },
                },
            },
        });
        // Per-row current labels are application-owned immutable projections.
        return {
            ...result,
            collectionContexts: {
                ...result.collectionContexts,
                rows: {
                    ...result.collectionContexts['rows']!,
                    rows: result.collectionContexts['rows']!.rows.map((row) => ({
                        ...row,
                        contexts: {
                            ...row.contexts,
                            choice: {
                                ...row.contexts!['choice'],
                                selector: this.selector(row.contexts!['choice']!.documentInput!),
                            },
                        },
                    })),
                },
            },
        };
    });
    busy(): void {
        this.page.update((page) => ({ ...page, busy: true }));
    }
    fail(): void {
        this.page.update((page) => ({ ...page, busy: false, error: 'Choices unavailable' }));
    }
    input(input: EditingInput): void {
        this.session.change({ kind: 'field', path: [p('choice')], input });
        this.session.change({
            kind: 'field',
            path: [p('rows'), { kind: 'row', key: rowKey }, p('choice')],
            input,
        });
    }
    legacy(value: FieldValue): void {
        this.legacyValue.set(value);
        this.legacyValues.update((values) => [...values, value]);
    }
    unexpected(): void {
        this.duplicates.update((n) => n + 1);
    }
    edit(intent: FormFieldEdit): void {
        this.edits.update((n) => n + 1);
        this.lastEdit.set(intent);
        applyDocumentFieldIntent(this.session, intent);
    }
    cell(intent: DetailGridEdit): void {
        this.edits.update((n) => n + 1);
        this.lastEdit.set(intent);
        applyDocumentCollectionIntent(this.session, intent);
    }
    structure(intent: import('@alxarafe/ui-runtime').DetailGridChange): void {
        if (intent.kind === 'cell') this.unexpected();
        else applyDocumentCollectionIntent(this.session, intent);
    }
    readonly encode = JSON.stringify;
}
