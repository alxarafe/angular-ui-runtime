/** Installed public-package scalar editor QA, with one session and keyed rows. */
import { Component, computed, inject, signal } from '@angular/core';
import {
    DocumentSession,
    createDocumentState,
    bindDocumentEditor,
    applyDocumentFieldIntent,
    applyDocumentCollectionIntent,
    FormComposition,
    ThemePanelOutlet,
    ThemeService,
    type FieldValidationRequest,
    type DocumentBindingOptions,
    type FormDefinition,
    type DocumentField,
    type EditingInput,
    type FormFieldEdit,
    type DetailGridEdit,
} from '@alxarafe/ui-runtime';

const cases: Record<string, { definition: FieldValidationRequest['definition']; initial: string }> =
    {
        time: {
            definition: {
                type: 'TIME',
                required: false,
                nullable: true,
                format: 'local-time',
                fractionalDigits: 0,
                constraints: {
                    minimum: { value: '09:00:00', exclusive: true },
                    maximum: { value: '18:00:00', exclusive: true },
                },
            },
            initial: '12:30:15',
        },
    };
const selected =
    cases[new URLSearchParams(location.search).get('type') ?? 'time'] ?? cases['time']!;
const prop = (name: string) => ({ kind: 'property' as const, name });
const field = (input: EditingInput): DocumentField => ({
    kind: 'field',
    equality: { type: 'exact' },
    input,
});

@Component({
    selector: 'qa-testbed',
    imports: [FormComposition, ThemePanelOutlet],
    template: `<h1>Lossless scalar editor</h1>
        <p id="scalar-help">Exact scalar text; validation reports unsupported input.</p>
        @for (id of themes; track id) {
            <button (click)="theme.activate(id)">{{ id }}</button>
        }
        <button (click)="tick.update(increment)">Refresh scalar contexts</button>
        @if (selected.definition.type === 'TIME') {
            <button (click)="precision.set(0)">Whole seconds</button>
            <button (click)="precision.set(7)">Seven fraction digits</button>
            <button (click)="limited.set(!limited())">Toggle time bounds</button>
        }
        <button (click)="replace({ kind: 'value', value: false })">Use unsupported scalar</button>
        <button (click)="reorder()">Reorder scalar rows</button>
        <aur-theme-panel
            ><aur-form
                [definition]="form"
                [contexts]="binding().contexts"
                [collectionContexts]="binding().collectionContexts"
                (fieldEdit)="edit($event)"
                (collectionEdit)="cell($event)"
                (fieldChange)="legacy.update(increment)"
                (collectionChange)="legacy.update(increment)"
        /></aur-theme-panel>
        <output data-testid="scalar-snapshot">{{ encode(session.state) }}</output>
        <output data-testid="scalar-events">{{
            encode({ fields: fields(), cells: cells(), legacy: legacy(), last: last() })
        }}</output>
        <output data-testid="scalar-validation">{{ encode(binding().validation) }}</output>`,
    styles: [
        ':host{display:block;min-width:0;padding:.5rem}button{font:inherit;max-width:100%;margin:.2rem}output{display:block;overflow-wrap:anywhere}',
    ],
})
export class ScalarEditorTestbed {
    readonly selected = selected;
    readonly theme = inject(ThemeService);
    readonly themes = ['default', 'alternative', 'cyberpunk', 'vintage', 'high-contrast'];
    readonly precision = signal(0);
    readonly limited = signal(true);
    readonly tick = signal(0);
    readonly fields = signal(0);
    readonly cells = signal(0);
    readonly legacy = signal(0);
    readonly last = signal<FormFieldEdit | DetailGridEdit | null>(null);
    readonly increment = (n: number) => n + 1;
    readonly encode = JSON.stringify;
    readonly session = new DocumentSession(
        createDocumentState({
            kind: 'object',
            properties: {
                main: field({ kind: 'value', value: selected.initial }),
                fixed: { ...field({ kind: 'value', value: selected.initial }), readOnly: true },
                disabled: { ...field({ kind: 'value', value: selected.initial }), disabled: true },
                rows: {
                    kind: 'collection',
                    ordered: true,
                    allowAdd: false,
                    allowRemove: false,
                    allowReorder: true,
                    rows: ['a', 'b'].map((key) => ({
                        key,
                        value: {
                            kind: 'object',
                            properties: {
                                value: field({ kind: 'value', value: selected.initial }),
                            },
                        },
                    })),
                },
            },
        }),
    );
    readonly form: FormDefinition = {
        id: 'scalar',
        label: 'Scalar editor',
        fields: ['main', 'fixed', 'disabled'].map((id) => ({
            id,
            path: [prop(id)],
            artifact: `field.${selected.definition.type}`,
        })),
        collections: [{ id: 'rows', path: [prop('rows')] }],
    };
    readonly definition = computed(() => {
        const definition = selected.definition;
        return definition.type === 'TIME'
            ? {
                  ...definition,
                  fractionalDigits: this.precision(),
                  constraints: this.limited() ? definition.constraints : undefined,
              }
            : definition;
    });
    readonly binding = computed(() => {
        this.tick();
        const leaf = { kind: 'field' as const, definition: this.definition() };
        const options: DocumentBindingOptions = {
            definition: this.form,
            plan: {
                kind: 'object',
                properties: {
                    main: leaf,
                    fixed: leaf,
                    disabled: leaf,
                    rows: {
                        kind: 'collection',
                        row: { kind: 'object', properties: { value: leaf } },
                    },
                },
            },
            fields: {
                main: { id: 'scalar-main', label: 'Scalar value', describedBy: ['scalar-help'] },
                fixed: { id: 'scalar-fixed', label: 'Fixed scalar' },
                disabled: { id: 'scalar-disabled', label: 'Disabled scalar' },
            },
            collections: {
                rows: {
                    label: 'Scalar rows',
                    fields: { value: { describedBy: ['scalar-help'] } },
                    columns: [
                        {
                            id: 'value',
                            field: 'value',
                            label: 'Row scalar',
                            artifact: `field.${selected.definition.type}`,
                        },
                    ],
                },
            },
        };
        return bindDocumentEditor(this.session, options);
    });
    edit(intent: FormFieldEdit): void {
        this.fields.update(this.increment);
        this.last.set(intent);
        applyDocumentFieldIntent(this.session, intent);
        this.tick.update(this.increment);
    }
    cell(intent: DetailGridEdit): void {
        this.cells.update(this.increment);
        this.last.set(intent);
        applyDocumentCollectionIntent(this.session, intent);
        this.tick.update(this.increment);
    }
    replace(input: EditingInput): void {
        this.session.change({ kind: 'field', path: [prop('main')], input });
        this.tick.update(this.increment);
    }
    reorder(): void {
        this.session.change({ kind: 'move-row', path: [prop('rows')], key: 'b', before: 'a' });
        this.tick.update(this.increment);
    }
}
