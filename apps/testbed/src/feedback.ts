/** Installed-APF feedback acceptance; application labels and synthetic messages only. */
import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import {
    FeedbackSummary,
    FormComposition,
    ThemePanelOutlet,
    ThemeService,
    DocumentSession,
    createDocumentState,
    bindDocumentEditor,
    applyDocumentFieldIntent,
    applyDocumentCollectionIntent,
    type EditorFeedback,
    type ValuePath,
    type FormDefinition,
    type FormLayout,
    type ObjectValidationPlan,
    type FormFieldEdit,
    type DetailGridEdit,
} from '@alxarafe/ui-runtime';
const p = (name: string) => ({ kind: 'property' as const, name });
const path = (name: string): ValuePath => [p(name)];
const key = 'opaque /?#';
const row: ValuePath = [p('rows'), { kind: 'row', key }];
const cell: ValuePath = [...row, p('value')];
const field = (value: string) => ({
    kind: 'field' as const,
    equality: { type: 'exact' as const },
    input: { kind: 'value' as const, value },
});
const text = {
    kind: 'field' as const,
    definition: {
        type: 'STRING' as const,
        required: true,
        nullable: false,
        constraints: { minimumLength: 1 },
    },
};
const plan: ObjectValidationPlan = {
    kind: 'object',
    properties: {
        disabled: text,
        hidden: text,
        visible: {
            ...text,
            definition: {
                ...text.definition,
                constraints: { pattern: { dialect: 'server', source: '.*' } },
            },
        },
        rows: {
            kind: 'collection',
            row: { kind: 'object', properties: { blocked: text, value: text } },
        },
    },
};
const definition: FormDefinition = {
    id: 'feedback',
    label: 'Feedback form',
    fields: ['disabled', 'hidden', 'visible'].map((id) => ({
        id,
        path: path(id),
        artifact: 'field.STRING',
    })),
    collections: [{ id: 'rows', path: path('rows') }],
};
const layout: FormLayout = {
    actions: [],
    tabs: ['header', 'details'].map((id, index) => ({
        id,
        label: index ? 'Details' : 'Header',
        actions: [],
        sections: [
            {
                id: 'section',
                label: index ? 'Hidden section' : 'Header section',
                collapsible: true,
                initiallyCollapsed: !!index,
                actions: [],
                groups: [
                    {
                        id: 'group',
                        label: index ? 'Hidden group' : 'Header group',
                        fields: index ? [path('hidden')] : [path('disabled'), path('visible')],
                        collections: index ? [path('rows')] : [],
                    },
                ],
            },
        ],
    })),
};
@Component({
    selector: 'qa-testbed',
    imports: [FeedbackSummary, FormComposition, ThemePanelOutlet],
    template: `<h1>Feedback interaction probes</h1>
        <div class="toolbar">
            @for (id of themes; track id) {
                <button (click)="theme.activate(id)">{{ id }}</button>
            }
            <button (click)="summary()?.focus()">Return to feedback</button>
            <button (click)="refresh.update(increment)">Refresh unrelated context</button>
            <button (click)="interrupt()">Move focus during reveal</button>
            <button #outside>Outside focus target</button>
            <button (click)="destroyPending()">Destroy pending form</button>
        </div>
        <aur-theme-panel>
            <aur-feedback-summary [feedback]="feedback()" [reveal]="reveal" [labelPath]="label" />
            @if (mounted()) {
                <aur-form
                    [definition]="definition"
                    [layout]="layout"
                    [contexts]="binding().contexts"
                    [collectionContexts]="binding().collectionContexts"
                    (fieldEdit)="edit($event)"
                    (collectionEdit)="cellEdit($event)"
                    (fieldChange)="unexpected.update(increment)"
                    (collectionChange)="unexpected.update(increment)"
                />
            }
        </aur-theme-panel>
        <output data-testid="feedback-state">{{ encode(session.state.current) }}</output>
        <output data-testid="feedback-events">{{
            encode({
                requests: requests(),
                results: results(),
                edits: edits(),
                unexpected: unexpected(),
                refresh: refresh(),
            })
        }}</output>`,
    styles: [
        ':host{display:block;min-width:0;padding:.5rem}.toolbar{display:flex;flex-wrap:wrap;gap:.25rem}button{font:inherit}output{display:block;overflow-wrap:anywhere}',
    ],
})
export class FeedbackTestbed {
    readonly theme = inject(ThemeService);
    readonly themes = [
        'default',
        'alternative',
        'cyberpunk',
        'vintage',
        'high-contrast',
        'form-frame',
    ];
    readonly form = viewChild(FormComposition);
    readonly summary = viewChild(FeedbackSummary);
    readonly outside = viewChild('outside', { read: ElementRef });
    readonly mounted = signal(true);
    readonly tick = signal(0);
    readonly refresh = signal(0);
    readonly increment = (n: number) => n + 1;
    readonly requests = signal<readonly ValuePath[]>([]);
    readonly results = signal<readonly boolean[]>([]);
    readonly edits = signal(0);
    readonly unexpected = signal(0);
    readonly encode = JSON.stringify;
    readonly definition = definition;
    readonly layout = layout;
    readonly session = new DocumentSession(
        createDocumentState({
            kind: 'object',
            properties: {
                disabled: field(''),
                hidden: field(''),
                visible: field('VALID'),
                rows: {
                    kind: 'collection',
                    ordered: true,
                    allowAdd: false,
                    allowRemove: false,
                    allowReorder: false,
                    rows: [
                        {
                            key,
                            value: {
                                kind: 'object',
                                properties: { blocked: field('locked'), value: field('') },
                            },
                        },
                    ],
                },
            },
        }),
    );
    private readonly unsubscribe = this.session.subscribe(() => this.tick.update(this.increment));
    ngOnDestroy(): void {
        this.unsubscribe();
    }
    readonly binding = computed(() => {
        this.tick();
        return bindDocumentEditor(this.session, {
            definition,
            plan,
            fields: {
                disabled: { id: 'feedback-disabled', label: 'Disabled error', disabled: true },
                hidden: { id: 'feedback-hidden', label: 'Hidden error' },
                visible: { id: 'feedback-visible', label: 'Visible check' },
            },
            collections: {
                rows: {
                    label: 'Keyed details',
                    columns: [
                        {
                            id: 'blocked',
                            field: 'blocked',
                            label: 'Disabled cell',
                            artifact: 'field.STRING',
                        },
                        {
                            id: 'value',
                            field: 'value',
                            label: 'Editable cell',
                            artifact: 'field.STRING',
                        },
                    ],
                    fields: { blocked: { disabled: true } },
                },
            },
        });
    });
    readonly feedback = computed<readonly EditorFeedback[]>(() => [
        { source: 'server', path: [], message: 'Root failure one' },
        { source: 'server', path: [], message: 'Root failure two' },
        { source: 'server', path: path('unknown'), message: 'Unknown field failure' },
        ...this.binding().feedback,
        { source: 'server', path: path('rows'), message: 'Collection failure' },
        { source: 'server', path: row, message: 'Row failure' },
        { source: 'server', path: cell, message: 'Cell failure one' },
        { source: 'server', path: cell, message: 'Cell failure two' },
        { source: 'server', path: [...row, p('unknown')], message: 'Unknown cell failure' },
        {
            source: 'server',
            path: [p('rows'), { kind: 'row', key: 'missing' }],
            message: 'Removed row failure',
        },
    ]);
    readonly label = (value: ValuePath): string => {
        if (!value.length) return 'Document';
        if (value.length > 1) return value.length === 2 ? 'Keyed row' : 'Keyed cell';
        const labels: Readonly<Record<string, string>> = {
            hidden: 'Hidden',
            disabled: 'Disabled',
            visible: 'Visible',
            rows: 'Collection',
            unknown: 'Unknown',
        };
        const segment = value[0]!;
        return segment.kind === 'property' ? (labels[segment.name] ?? 'Other') : 'Other';
    };
    readonly reveal = (value: ValuePath): Promise<boolean> =>
        new Promise((resolve) => {
            this.requests.update((paths) => [...paths, value]);
            const form = this.form();
            if (!form) {
                resolve(false);
                return;
            }
            form.revealPath(value, (focused) => {
                this.results.update((results) => [...results, focused]);
                resolve(focused);
            });
        });
    interrupt(): void {
        void this.reveal(path('hidden'));
        this.outside()?.nativeElement.focus();
    }
    destroyPending(): void {
        void this.reveal(path('hidden'));
        this.mounted.set(false);
    }
    edit(intent: FormFieldEdit): void {
        this.edits.update(this.increment);
        applyDocumentFieldIntent(this.session, intent);
    }
    cellEdit(intent: DetailGridEdit): void {
        this.edits.update(this.increment);
        applyDocumentCollectionIntent(this.session, intent);
    }
}
