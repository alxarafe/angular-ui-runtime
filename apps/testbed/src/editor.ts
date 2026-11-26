import { AcceptanceExtension } from './acceptance-extension';
/** Integrated installed-package editor QA; synthetic adapter, no I/O or business policy. */
import {
    Component,
    ElementRef,
    computed,
    effect,
    inject,
    input,
    signal,
    viewChild,
    OnDestroy,
} from '@angular/core';
import {
    DocumentSession,
    createDocumentState,
    FormComposition,
    FormSlot,
    FeedbackSummary,
    ThemePanelOutlet,
    ThemeService,
    bindDocumentEditor,
    applyDocumentFieldIntent,
    applyDocumentCollectionIntent,
    type DocumentObject,
    type DocumentField,
    type DocumentRow,
    type DocumentCollection,
    type FieldValue,
    type ValuePath,
    type DocumentBindingOptions,
    type FormDefinition,
    type FormLayout,
    type FormFieldEdit,
    type DetailGridEdit,
    type DetailGridChange,
    type DocumentSubmission,
    type EditingInput,
} from '@alxarafe/ui-runtime';
const enumChoices = ['', 'OPEN', 'Not set', ' spaced ', 'e\u0301', 'é'] as const;
const enumDef = {
    kind: 'field' as const,
    definition: { type: 'ENUM' as const, required: false, nullable: true, choices: enumChoices },
};
const property = (name: string) => ({ kind: 'property' as const, name });
const key = (key: string) => ({ kind: 'row' as const, key });
const path = (name: string): ValuePath => [property(name)];
const first: ValuePath = [property('details'), property('first')];
const second: ValuePath = [property('details'), property('second')];
const nested: ValuePath = [...first, key('a'), property('nested')];
const field = (
    value: FieldValue,
    equality: DocumentField['equality'] = { type: 'exact' },
): DocumentField => ({ kind: 'field', equality, input: { kind: 'value', value } });
const object = (properties: DocumentObject['properties']): DocumentObject => ({
    kind: 'object',
    properties,
});
const collection = (rows: readonly DocumentRow[]): DocumentCollection => ({
    kind: 'collection',
    ordered: true,
    allowAdd: true,
    allowRemove: true,
    allowReorder: true,
    rows,
});
const row = (key: string, value = '1', children: readonly DocumentRow[] = []): DocumentRow => ({
    key,
    value: object({
        quantity: field(value, { type: 'INTEGER' }),
        choice: field('OPEN'),
        date: field('2024-02-29'),
        notes: field(' row\n notes '),
        nested: collection(children),
    }),
});
const document = object({
    date: field('2024-02-29'),
    dateFixed: { ...field('2024-02-29'), readOnly: true },
    dateDisabled: { ...field('2024-02-29'), disabled: true },
    notes: field(' Header\n e\u0301 é 😀 '),
    textFixed: { ...field('fixed\ntext'), readOnly: true },
    textDisabled: { ...field('disabled\ntext'), disabled: true },
    title: field(''),
    optional: { ...field(''), input: { kind: 'absent' } },
    nullable: field(null),
    flag: field(true),
    count: field('18446744073709551615', { type: 'INTEGER' }),
    amount: field('1e-', { type: 'DECIMAL', allowExponent: true }),
    server: field('SERVER_ONE'),
    fixed: { ...field('fixed'), readOnly: true },
    disabled: { ...field('disabled'), disabled: true },
    choice: field('OPEN'),
    enumFixed: { ...field('OPEN'), readOnly: true },
    enumDisabled: { ...field('OPEN'), disabled: true },
    details: object({
        first: collection([row('a', '1', [row('n', 'bad')]), row('b', '2')]),
        second: collection([row('x', '3')]),
    }),
});
const stringDef = {
    kind: 'field' as const,
    definition: { type: 'STRING' as const, required: true, nullable: false },
};
const textDef = {
    kind: 'field' as const,
    definition: {
        type: 'TEXT' as const,
        required: false,
        nullable: true,
        constraints: { minimumLength: 1 },
    },
};
const dateDef = {
    kind: 'field' as const,
    definition: {
        type: 'DATE' as const,
        required: false,
        nullable: true,
        format: 'gregorian-date' as const,
        constraints: { minimum: { value: '2024-01-01' }, maximum: { value: '2025-12-31' } },
    },
};
const integerDef = {
    kind: 'field' as const,
    definition: {
        type: 'INTEGER' as const,
        required: true,
        nullable: false,
        capacity: { bits: 64 as const, signed: false },
    },
};
const leafRowPlan = {
    kind: 'object' as const,
    properties: {
        date: dateDef,
        notes: textDef,
        quantity: integerDef,
        choice: enumDef,
        nested: { kind: 'collection' as const, row: { kind: 'object' as const, properties: {} } },
    },
};
const rowPlan = {
    kind: 'object' as const,
    properties: {
        date: dateDef,
        notes: textDef,
        quantity: integerDef,
        choice: enumDef,
        nested: { kind: 'collection' as const, row: leafRowPlan },
    },
};
const plan: DocumentBindingOptions['plan'] = {
    kind: 'object',
    properties: {
        date: dateDef,
        dateFixed: dateDef,
        dateDisabled: dateDef,
        notes: textDef,
        textFixed: textDef,
        textDisabled: textDef,
        title: {
            ...stringDef,
            definition: { ...stringDef.definition, constraints: { minimumLength: 1 } },
        },
        optional: { ...stringDef, definition: { ...stringDef.definition, required: false } },
        nullable: { ...stringDef, definition: { ...stringDef.definition, nullable: true } },
        flag: { kind: 'field', definition: { type: 'BOOLEAN', required: true, nullable: false } },
        count: integerDef,
        amount: {
            kind: 'field',
            definition: { type: 'DECIMAL', required: true, nullable: false, allowExponent: true },
        },
        server: {
            ...stringDef,
            definition: {
                ...stringDef.definition,
                constraints: { pattern: { dialect: 'server', source: '^SERVER' } },
            },
        },
        fixed: stringDef,
        disabled: stringDef,
        choice: enumDef,
        enumFixed: enumDef,
        enumDisabled: enumDef,
        details: {
            kind: 'object',
            properties: {
                first: { kind: 'collection', row: rowPlan },
                second: { kind: 'collection', row: rowPlan },
            },
        },
    },
};
const descriptors = [
    ['date', 'Document date', 'DATE'],
    ['dateFixed', 'Fixed date', 'DATE'],
    ['dateDisabled', 'Disabled date', 'DATE'],
    ['notes', 'Notes', 'TEXT'],
    ['textFixed', 'Fixed notes', 'TEXT'],
    ['textDisabled', 'Disabled notes', 'TEXT'],
    ['title', 'Title', 'STRING'],
    ['optional', 'Optional text', 'STRING'],
    ['nullable', 'Nullable text', 'STRING'],
    ['flag', 'Enabled', 'BOOLEAN'],
    ['count', 'Exact count', 'INTEGER'],
    ['amount', 'Exact amount', 'DECIMAL'],
    ['server', 'Server check', 'STRING'],
    ['fixed', 'Read only', 'STRING'],
    ['disabled', 'Disabled', 'STRING'],
    ['choice', 'Status', 'ENUM'],
    ['enumFixed', 'Fixed status', 'ENUM'],
    ['enumDisabled', 'Disabled status', 'ENUM'],
] as const;
@Component({
    selector: 'qa-testbed',
    imports: [FormComposition, FormSlot, ThemePanelOutlet, FeedbackSummary, AcceptanceExtension],
    template: `<h1>Integrated document editor</h1>
        <div class="toolbar">
            @if (!integrated()) {
                @for (id of themes; track id) {
                    <button (click)="theme.activate(id)">{{ id }}</button>
                }
            }
            @if (integrated()) {
                <button (click)="tick.update(increment)">Refresh editor contexts</button>
                <button (click)="editorReadOnly.set(!editorReadOnly())">
                    Toggle editor read-only
                </button>
                <button (click)="extensionDisabled.set(!extensionDisabled())">
                    Toggle extension disabled
                </button>
                <button (click)="reveal(unknownPath)">Reveal unknown path</button>
                <button (click)="reject('validation')">Reject validation</button>
            }
            <button (click)="submit()" [disabled]="session.locked">Save</button
            ><button (click)="reject()">Reject conflict</button
            ><button (click)="commit()">Committed</button
            ><button (click)="accept()">Accept authoritative</button
            ><button (click)="discard()">Discard</button>
            <button (click)="dateInput({ kind: 'value', value: '2025-02-29' })">
                Use invalid DATE
            </button>
            <button (click)="dateInput({ kind: 'value', value: false })">
                Use unsupported DATE
            </button>
            <button (click)="enumInput({ kind: 'value', value: 'UNKNOWN' })">
                Use unknown ENUM
            </button>
            <button (click)="enumInput({ kind: 'raw', text: 'invalid draft' })">
                Use raw ENUM
            </button>
            <button (click)="enumInput({ kind: 'value', value: false })">
                Use invalid ENUM type
            </button>
        </div>
        <p role="status" data-testid="editor-message">{{ message() }}</p>
        <output data-testid="editor-save">{{ session.save.kind }}</output><output
            data-testid="editor-dirty"
            >{{ session.state.dirty }}</output
        ><output data-testid="editor-validity">{{ binding().validation.state }}</output>
        <aur-feedback-summary
            [feedback]="binding().feedback"
            [labelPath]="label"
            [reveal]="reveal"
        />
        <aur-theme-panel
            ><aur-form
                [definition]="definition()"
                [layout]="layout()"
                [contexts]="binding().contexts"
                [collectionContexts]="binding().collectionContexts"
                (fieldEdit)="edit($event)"
                (fieldChange)="legacy()"
                (collectionEdit)="cell($event)"
                (collectionChange)="structure($event)"
                [readOnly]="integrated() && (editorReadOnly() || session.locked)"
                (actionSelected)="actions.update(append($event))"
            >
                <ng-template aurFormSlot="extension" let-readOnly="readOnly">
                    <qa-acceptance-extension
                        [readOnly]="readOnly"
                        [disabled]="extensionDisabled()"
                        (changed)="extensionEdits.update(increment)"
                    />
                </ng-template> </aur-form
        ></aur-theme-panel>
        @if (integrated()) {
            <output data-testid="integration-editor-events">{{
                encode({
                    fields: fieldEdits(),
                    cells: gridEdits(),
                    structures: structures(),
                    legacy: legacyEdits(),
                    actions: actions(),
                    extension: extensionEdits(),
                    lifetime: extensionLifetime(),
                    focus: focusResults(),
                })
            }}</output>
        }
        <dialog
            #discardDialog
            aria-label="Discard changes"
            (cancel)="$event.preventDefault(); answer(false)"
        >
            <button (click)="answer(false)">Cancel discard</button
            ><button (click)="answer(true)">Confirm discard</button>
        </dialog>
        <output data-testid="editor-snapshot">{{ encode(session.state.current) }}</output>
        <output data-testid="enum-events">{{
            encode({
                fields: fieldEdits(),
                cells: gridEdits(),
                legacy: legacyEdits(),
                last: lastEdit(),
            })
        }}</output>`,
    styles: [
        ':host{display:block;min-width:0;padding:.5rem;box-sizing:border-box}.toolbar{display:flex;flex-wrap:wrap;gap:.25rem}button{font:inherit;max-width:100%;white-space:normal;overflow-wrap:anywhere}output{display:block;overflow-wrap:anywhere}ul{padding-inline-start:1rem}',
    ],
})
export class EditorTestbed implements OnDestroy {
    readonly integrated = input(false);
    readonly editorReadOnly = signal(false);
    readonly extensionDisabled = signal(false);
    readonly extensionEdits = signal(0);
    readonly structures = signal(0);
    readonly actions = signal<readonly string[]>([]);
    readonly focusResults = signal<readonly boolean[]>([]);
    readonly increment = (n: number) => n + 1;
    readonly unknownPath: ValuePath = [{ kind: 'property', name: 'unknown' }];
    append(value: string): (items: readonly string[]) => readonly string[] {
        return (items) => [...items, value];
    }
    extensionLifetime(): string {
        return `${AcceptanceExtension.created}/${AcceptanceExtension.destroyed}`;
    }

    readonly session = new DocumentSession(createDocumentState(document));
    readonly theme = inject(ThemeService);
    readonly themes = [
        'default',
        'alternative',
        'cyberpunk',
        'vintage',
        'high-contrast',
        'grid-frame',
    ];
    readonly tick = signal(0);
    private readonly unsubscribe = this.session.subscribe(() => this.tick.update((n) => n + 1));
    readonly form = viewChild(FormComposition);
    readonly message = signal('');
    readonly fieldEdits = signal(0);
    readonly gridEdits = signal(0);
    readonly legacyEdits = signal(0);
    readonly lastEdit = signal<FormFieldEdit | DetailGridEdit | null>(null);
    legacy(): void {
        this.legacyEdits.update((n) => n + 1);
    }
    dateInput(input: EditingInput): void {
        this.session.change({ kind: 'field', path: path('date'), input });
        this.session.change({
            kind: 'field',
            path: [...first, key('a'), property('date')],
            input,
        });
    }
    enumInput(input: EditingInput): void {
        this.session.change({ kind: 'field', path: path('choice'), input });
        this.session.change({
            kind: 'field',
            path: [...first, key('a'), property('choice')],
            input,
        });
    }
    private readonly discardDialog = viewChild<ElementRef<HTMLDialogElement>>('discardDialog');
    readonly confirming = signal(false);
    constructor() {
        effect(() => {
            const dialog = this.discardDialog()?.nativeElement;
            if (dialog && this.confirming() && !dialog.open) dialog.showModal();
        });
    }
    private confirmation?: (confirmed: boolean) => void;
    private focus?: HTMLElement;
    private nextRow = 0;
    private attempt?: DocumentSubmission;
    readonly definition = computed<FormDefinition>(() => {
        this.tick();
        const parent = (this.session.state.current.properties['details'] as DocumentObject)
            .properties['first'] as DocumentCollection;
        return {
            id: 'integrated-editor',
            label: 'Document editor',
            ...(this.integrated()
                ? {
                      actions: [
                          { id: 'inspect-root', label: 'Inspect document', enabled: true },
                          { id: 'inspect-extension', label: 'Inspect extension', enabled: true },
                          { id: 'inspect-tab', label: 'Inspect additional tab', enabled: true },
                          { id: 'blocked', label: 'Unavailable contextual action', enabled: false },
                      ],
                  }
                : {}),
            fields: descriptors.map(([id, , type]) => ({
                id,
                path: path(id),
                artifact: `field.${type}` as const,
            })),
            collections: [
                { id: 'first', path: first },
                { id: 'second', path: second },
                ...(parent.rows.some((row) => row.key === 'a')
                    ? [{ id: 'nested', path: nested }]
                    : []),
            ],
        };
    });
    readonly binding = computed(() => {
        this.tick();
        return bindDocumentEditor(this.session, {
            definition: this.definition(),
            plan,
            fields: Object.fromEntries(
                descriptors.map(([id, label, type]) => [
                    id,
                    {
                        id: 'editor-' + id,
                        label,
                        ...(type === 'ENUM' ? { choices: enumChoices } : {}),
                    },
                ]),
            ),
            collections: {
                first: {
                    label: 'First details',
                    fields: { choice: { choices: enumChoices } },
                    columns: [
                        { id: 'date', field: 'date', label: 'Row date', artifact: 'field.DATE' },
                        { id: 'notes', field: 'notes', label: 'Row notes', artifact: 'field.TEXT' },
                        {
                            id: 'quantity',
                            field: 'quantity',
                            label: 'First quantity',
                            artifact: 'field.INTEGER',
                        },
                        {
                            id: 'choice',
                            field: 'choice',
                            label: 'Row status',
                            artifact: 'field.ENUM',
                        },
                    ],
                },
                second: {
                    label: 'Second details',
                    columns: [
                        {
                            id: 'quantity',
                            field: 'quantity',
                            label: 'Second quantity',
                            artifact: 'field.INTEGER',
                        },
                    ],
                },
                nested: {
                    label: 'Nested details',
                    columns: [
                        {
                            id: 'quantity',
                            field: 'quantity',
                            label: 'Nested quantity',
                            artifact: 'field.INTEGER',
                        },
                    ],
                },
            },
        });
    });
    private readonly baselineLayout: FormLayout = {
        actions: [],
        tabs: [
            {
                id: 'header',
                label: 'Header',
                actions: [],
                sections: [
                    {
                        id: 'basic',
                        label: 'Header fields',
                        collapsible: false,
                        initiallyCollapsed: false,
                        actions: [],
                        groups: [
                            {
                                id: 'header-values',
                                fields: [
                                    'date',
                                    'dateFixed',
                                    'dateDisabled',
                                    'notes',
                                    'textFixed',
                                    'textDisabled',
                                    'title',
                                    'optional',
                                    'nullable',
                                    'flag',
                                    'count',
                                    'server',
                                    'fixed',
                                    'disabled',
                                    'choice',
                                    'enumFixed',
                                    'enumDisabled',
                                ].map(path),
                            },
                        ],
                    },
                ],
            },
            {
                id: 'numbers',
                label: 'Numbers',
                actions: [],
                sections: [
                    {
                        id: 'amount',
                        label: 'Amount section',
                        collapsible: true,
                        initiallyCollapsed: true,
                        actions: [],
                        groups: [{ id: 'numbers', fields: [path('amount')] }],
                    },
                ],
            },
            {
                id: 'details',
                label: 'Details',
                actions: [],
                sections: [
                    {
                        id: 'first',
                        label: 'First section',
                        collapsible: true,
                        initiallyCollapsed: true,
                        actions: [],
                        groups: [{ id: 'first', fields: [], collections: [first, nested] }],
                    },
                    {
                        id: 'second',
                        label: 'Second section',
                        collapsible: true,
                        initiallyCollapsed: true,
                        actions: [],
                        groups: [{ id: 'second', fields: [], collections: [second] }],
                    },
                ],
            },
        ],
    };
    readonly layout = computed<FormLayout>(() => {
        if (!this.integrated()) return this.baselineLayout;
        const general = this.baselineLayout.tabs[0]!;
        return {
            actions: [{ id: 'inspect-root' }],
            tabs: [
                {
                    ...general,
                    label: 'General information',
                    sections: [
                        {
                            ...general.sections[0]!,
                            groups: general.sections[0]!.groups.map((group) => ({
                                ...group,
                                fields: group.fields.filter(
                                    (value) =>
                                        value[0]?.kind !== 'property' || value[0].name !== 'server',
                                ),
                            })),
                        },
                        ...this.baselineLayout.tabs[1]!.sections,
                    ],
                },
                { ...this.baselineLayout.tabs[2]!, label: 'Detail information' },
                {
                    id: 'additional',
                    label: 'Additional content',
                    actions: [{ id: 'inspect-tab' }],
                    sections: [
                        {
                            id: 'additional',
                            label: 'Additional section',
                            collapsible: true,
                            initiallyCollapsed: false,
                            actions: [{ id: 'inspect-extension' }, { id: 'blocked' }],
                            groups: [
                                {
                                    id: 'mixed',
                                    label: 'Mixed application content',
                                    fields: [path('server')],
                                    slots: [{ id: 'extension' }],
                                },
                            ],
                        },
                    ],
                },
            ],
        };
    });
    readonly encode = JSON.stringify;
    readonly reveal = (path: ValuePath): Promise<boolean> =>
        new Promise((resolve) => {
            const form = this.form();
            if (form)
                form.revealPath(path, (focused) => {
                    if (this.integrated())
                        this.focusResults.update((results) => [...results, focused]);
                    resolve(focused);
                });
            else resolve(false);
        });
    label(path: ValuePath): string {
        return (
            path
                .map((segment) => (segment.kind === 'property' ? segment.name : segment.key))
                .join(' / ') || 'Document'
        );
    }
    edit(intent: FormFieldEdit): void {
        this.fieldEdits.update((n) => n + 1);
        this.lastEdit.set(intent);
        applyDocumentFieldIntent(this.session, intent);
    }
    cell(intent: DetailGridEdit): void {
        this.gridEdits.update((n) => n + 1);
        this.lastEdit.set(intent);
        applyDocumentCollectionIntent(this.session, intent);
    }
    structure(intent: DetailGridChange): void {
        this.structures.update(this.increment);
        if (intent.kind === 'cell') this.legacy();
        applyDocumentCollectionIntent(
            this.session,
            intent,
            intent.kind === 'add-row' ? row('new-' + ++this.nextRow) : undefined,
        );
    }
    submit(): void {
        const result = this.session.submit(plan);
        this.message.set(result.kind);
        if (result.kind === 'ready') this.attempt = result.submission;
    }
    reject(reason: 'validation' | 'conflict' = 'conflict'): void {
        if (this.attempt)
            this.session.resolve(this.attempt, {
                kind: 'rejected',
                reason,
                issues: [
                    {
                        path: [],
                        code: reason,
                        message:
                            reason === 'conflict'
                                ? 'Synthetic version conflict'
                                : 'Synthetic validation rejection',
                    },
                    { path: path('title'), code: 'title', message: 'Synthetic header rejection' },
                    { path: nested, code: 'collection', message: 'Synthetic collection rejection' },
                    {
                        path: [...nested, key('n')],
                        code: 'row',
                        message: 'Synthetic row rejection',
                    },
                ],
            });
    }
    commit(): void {
        if (this.attempt) this.session.resolve(this.attempt, { kind: 'committed' });
    }
    accept(): void {
        if (!this.attempt) return;
        const accepted = structuredClone(this.attempt.document);
        const document: DocumentObject = {
            ...accepted,
            properties: {
                ...accepted.properties,
                title: field('Authoritative title'),
                amount: field('12.3400', { type: 'DECIMAL', allowExponent: true }),
            },
        };
        if (this.session.save.kind === 'saving')
            this.session.resolve(this.attempt, {
                kind: 'accepted',
                document,
                checksConfirmed: true,
            });
        else this.session.recover(this.attempt, document, true);
    }
    async discard(): Promise<void> {
        this.focus = globalThis.document.activeElement as HTMLElement;
        const result = await this.session.requestDiscard('discard', () => {
            this.confirming.set(true);
            return new Promise((resolve) => (this.confirmation = resolve));
        });
        this.message.set(result);
    }
    answer(confirmed: boolean): void {
        this.confirmation?.(confirmed);
        this.confirmation = undefined;
        this.confirming.set(false);
        this.discardDialog()?.nativeElement.close();
        if (this.focus?.isConnected) this.focus.focus();
    }
    ngOnDestroy(): void {
        this.answer(false);
        this.unsubscribe();
    }
}
