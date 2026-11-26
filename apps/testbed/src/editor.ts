/** Integrated installed-package editor QA; synthetic adapter, no I/O or business policy. */
import {
    Component,
    ElementRef,
    computed,
    effect,
    inject,
    signal,
    viewChild,
    OnDestroy,
} from '@angular/core';
import {
    DocumentSession,
    createDocumentState,
    FormComposition,
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
        nested: collection(children),
    }),
});
const document = object({
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
        quantity: integerDef,
        choice: enumDef,
        nested: { kind: 'collection' as const, row: { kind: 'object' as const, properties: {} } },
    },
};
const rowPlan = {
    kind: 'object' as const,
    properties: {
        quantity: integerDef,
        choice: enumDef,
        nested: { kind: 'collection' as const, row: leafRowPlan },
    },
};
const plan: DocumentBindingOptions['plan'] = {
    kind: 'object',
    properties: {
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
    imports: [FormComposition, ThemePanelOutlet, FeedbackSummary],
    template: `<h1>Integrated document editor</h1>
        <div class="toolbar">
            @for (id of themes; track id) {
                <button (click)="theme.activate(id)">{{ id }}</button>
            }
            <button (click)="submit()" [disabled]="session.locked">Save</button
            ><button (click)="reject()">Reject conflict</button
            ><button (click)="commit()">Committed</button
            ><button (click)="accept()">Accept authoritative</button
            ><button (click)="discard()">Discard</button>
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
                [layout]="layout"
                [contexts]="binding().contexts"
                [collectionContexts]="binding().collectionContexts"
                (fieldEdit)="edit($event)"
                (fieldChange)="legacy()"
                (collectionEdit)="cell($event)"
                (collectionChange)="structure($event)"
        /></aur-theme-panel>
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
    readonly layout: FormLayout = {
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
    readonly encode = JSON.stringify;
    readonly reveal = (path: ValuePath): Promise<boolean> =>
        new Promise((resolve) => {
            const form = this.form();
            if (form) form.revealPath(path, resolve);
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
    reject(): void {
        if (this.attempt)
            this.session.resolve(this.attempt, {
                kind: 'rejected',
                reason: 'conflict',
                issues: [
                    { path: [], code: 'conflict', message: 'Synthetic version conflict' },
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
