/** Installed-APF QA: the two scalar probes deliberately know nothing about EditingInput. */
import { Component, computed, inject, input, output, signal } from '@angular/core';
import {
    FormComposition,
    ThemePanelOutlet,
    ThemeService,
    DocumentSession,
    createDocumentState,
    bindDocumentEditor,
    applyDocumentFieldIntent,
    applyDocumentCollectionIntent,
    type FieldRendererContext,
    type FieldValue,
    type ControlRequest,
    type FormDefinition,
    type DocumentBindingOptions,
    type DocumentField,
    type EditingInput,
    type FormFieldEdit,
    type DetailGridEdit,
    type ThemeDefinition,
} from '@alxarafe/ui-runtime';
import { GRID_THEMES } from './grid';
import { FORM_CONTROLS } from './form';

const domain = {
    semantic: 'qa-lossless-optional',
    values: [
        null,
        '',
        false,
        true,
        'false',
        '01',
        ' spaced ',
        'e\u0301',
        'é',
        '9223372036854775807.000000001',
    ],
};
const template = `<label [for]="context().id">{{ context().label + ' optional selection' }}</label>
    <select [id]="context().id" [disabled]="context().disabled || context().readOnly"
        [attr.aria-describedby]="context().describedBy?.join(' ') || null"
        [attr.aria-invalid]="context().invalid || null" (change)="choose($event)">
        @for (value of context().control!.domain.values; track $index) {
            <option [value]="'' + $index" [selected]="value === context().value">{{ label(value) }}</option>
        }
    </select>
    <button type="button" (click)="valueChange.emit('UNKNOWN')">Probe out-of-domain output</button>
    <button type="button" (click)="valueChange.emit(context().control!.domain.values[0]!)">Probe scalar output</button>
    <output data-testid="optional-renderer" [attr.data-envelope]="hasEnvelope()"
        [attr.data-mode]="context().control?.presentation?.['mode']">{{ representation }}</output>`;
@Component({ template, styles: ['select,button{font:inherit;max-width:100%}label{display:block}'] })
class ScalarProbe {
    readonly context = input.required<FieldRendererContext>();
    readonly valueChange = output<FieldValue>();
    readonly representation: string = 'primary';
    hasEnvelope(): boolean {
        return Object.hasOwn(this.context(), 'documentInput');
    }
    label(value: FieldValue): string {
        return `${typeof value}: ${JSON.stringify(value)}`;
    }
    choose(event: Event): void {
        const text = (event.target as HTMLSelectElement).value,
            index = Number(text);
        const values = this.context().control!.domain.values;
        if (String(index) === text && index >= 0 && index < values.length)
            this.valueChange.emit(values[index]!);
    }
}
@Component({ template, styles: ['select,button{font:inherit;max-width:100%}label{display:block}'] })
class AlternativeProbe extends ScalarProbe {
    override readonly representation = 'alternative';
}
const capability = (primary: boolean) => (request: ControlRequest) => {
    const mode = request.presentation?.['mode'];
    return (mode === undefined || mode === 'regular' || (!primary && mode === 'compact')) &&
        request.domain.values.every((v) => domain.values.includes(v))
        ? request.domain
        : undefined;
};
const primary = { component: ScalarProbe, domain, capabilities: capability(true) };
const alternative = { component: AlternativeProbe, domain, capabilities: capability(false) };
export const OPTIONAL_EDITOR_CONTROLS = [
    ...FORM_CONTROLS,
    { id: 'optional-exact', domain, alternatives: ['optional-alternative'] },
    { id: 'optional-alternative', domain },
];
export const OPTIONAL_EDITOR_THEMES: readonly ThemeDefinition[] = GRID_THEMES.map((theme) => ({
    ...theme,
    controls: {
        ...theme.controls,
        ...(theme.id === 'default' || theme.id === 'high-contrast'
            ? { 'optional-exact': primary, 'optional-alternative': alternative }
            : theme.id === 'alternative' || theme.id === 'vintage'
              ? { 'optional-alternative': alternative }
              : {}),
    },
}));
const prop = (name: string) => ({ kind: 'property' as const, name });
const field = (input: EditingInput): DocumentField => ({
    kind: 'field',
    equality: { type: 'exact' },
    input,
});
const leaf = {
    kind: 'field' as const,
    definition: {
        type: 'STRING' as const,
        required: false,
        nullable: true,
        constraints: { maximumLength: 3 },
    },
};

@Component({
    selector: 'qa-testbed',
    imports: [FormComposition, ThemePanelOutlet],
    template: `<h1>Lossless optional controls</h1>
        <p id="optional-help">Exact values and drafts remain document-owned.</p>
        @for (id of themes; track id) {
            <button (click)="theme.activate(id)">{{ id }}</button>
        }
        <button (click)="tick.update(increment)">Refresh optional contexts</button>
        <button (click)="mode.set('regular')">Regular presentation</button>
        <button (click)="mode.set('compact')">Compact presentation</button>
        <button (click)="mode.set('unavailable')">Unavailable presentation</button>
        <button (click)="subset.set(!subset())">Toggle optional domain</button>
        <button (click)="alternateId.set(!alternateId())">Toggle control identity</button>
        <button (click)="replace({ kind: 'absent' })">Use absent input</button>
        <button (click)="replace({ kind: 'value', value: null })">Use null input</button>
        <button (click)="replace({ kind: 'value', value: '' })">Use empty value</button>
        <button (click)="replace({ kind: 'value', value: 'UNKNOWN' })">Use unknown value</button>
        <button (click)="replace({ kind: 'raw', text: '01' })">Use matching raw draft</button>
        <button (click)="useDraft()">Use incomplete draft</button>
        <button (click)="reorder()">Reorder optional rows</button>
        <button (click)="readOnly.set(!readOnly())">Toggle editor read-only</button>
        <aur-theme-panel
            ><aur-form
                [definition]="form()"
                [contexts]="binding().contexts"
                [collectionContexts]="binding().collectionContexts"
                [readOnly]="readOnly()"
                (fieldEdit)="edit($event)"
                (collectionEdit)="cell($event)"
                (fieldChange)="legacy.update(increment)"
                (collectionChange)="legacy.update(increment)"
        /></aur-theme-panel>
        <aur-form
            [definition]="legacyForm"
            [contexts]="legacyContexts()"
            (fieldChange)="legacyValue.set($event.value); legacyChanges.update(increment)"
        />
        <output data-testid="optional-snapshot">{{ encode(session.state) }}</output>
        <output data-testid="optional-events">{{
            encode({ fields: fields(), cells: cells(), legacy: legacy(), last: last() })
        }}</output>
        <output data-testid="optional-legacy">{{
            encode({ value: legacyValue(), events: legacyChanges() })
        }}</output>`,
    styles: [
        ':host{display:block;min-width:0;padding:.5rem}button{font:inherit;max-width:100%;margin:.2rem}output{display:block;overflow-wrap:anywhere}',
    ],
})
export class OptionalEditorTestbed {
    readonly theme = inject(ThemeService);
    readonly themes = ['default', 'alternative', 'cyberpunk', 'vintage', 'high-contrast'];
    readonly tick = signal(0);
    readonly mode = signal('regular');
    readonly subset = signal(false);
    readonly alternateId = signal(false);
    readonly readOnly = signal(false);
    readonly fields = signal(0);
    readonly cells = signal(0);
    readonly legacy = signal(0);
    readonly last = signal<FormFieldEdit | DetailGridEdit | null>(null);
    readonly legacyValue = signal<FieldValue>('01');
    readonly legacyChanges = signal(0);
    readonly increment = (n: number) => n + 1;
    readonly encode = JSON.stringify;
    readonly request = computed<ControlRequest>(() => ({
        domain: { ...domain, values: this.subset() ? [null, false, 'false'] : domain.values },
        presentation: { mode: this.mode() },
    }));
    readonly controlId = computed(() =>
        this.alternateId() ? 'optional-alternative' : 'optional-exact',
    );
    readonly form = computed<FormDefinition>(() => ({
        id: 'optional',
        label: 'Optional document',
        fields: ['main', 'fixed', 'disabled'].map((id) => ({
            id,
            path: [prop(id)],
            kind: 'control',
            controlId: this.controlId(),
        })),
        collections: [{ id: 'rows', path: [prop('rows')] }],
    }));
    readonly session = new DocumentSession(
        createDocumentState({
            kind: 'object',
            properties: {
                main: field({ kind: 'value', value: '01' }),
                fixed: { ...field({ kind: 'value', value: '01' }), readOnly: true },
                disabled: { ...field({ kind: 'value', value: '01' }), disabled: true },
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
                            properties: { choice: field({ kind: 'value', value: '01' }) },
                        },
                    })),
                },
            },
        }),
    );
    readonly binding = computed(() => {
        this.tick();
        const options: DocumentBindingOptions = {
            definition: this.form(),
            plan: {
                kind: 'object',
                properties: {
                    main: leaf,
                    fixed: leaf,
                    disabled: leaf,
                    rows: {
                        kind: 'collection',
                        row: { kind: 'object', properties: { choice: leaf } },
                    },
                },
            },
            fields: Object.fromEntries(
                ['main', 'fixed', 'disabled'].map((id) => [
                    id,
                    {
                        id: 'optional-' + id,
                        label:
                            id === 'main'
                                ? 'Optional value'
                                : id === 'fixed'
                                  ? 'Fixed optional'
                                  : 'Disabled optional',
                        control: this.request(),
                        describedBy: ['optional-help'],
                    },
                ]),
            ),
            collections: {
                rows: {
                    label: 'Optional rows',
                    fields: { choice: { control: this.request(), describedBy: ['optional-help'] } },
                    columns: [
                        {
                            id: 'choice',
                            field: 'choice',
                            label: 'Row optional',
                            kind: 'control',
                            controlId: this.controlId(),
                        },
                    ],
                },
            },
        };
        return bindDocumentEditor(this.session, options);
    });
    readonly legacyForm: FormDefinition = {
        id: 'legacy',
        label: 'Legacy optional',
        fields: [
            { id: 'legacy', kind: 'control', controlId: 'optional-exact', path: [prop('legacy')] },
        ],
    };
    readonly legacyContexts = computed(() => ({
        legacy: {
            id: 'legacy-optional',
            label: 'Legacy optional',
            value: this.legacyValue(),
            control: { domain, presentation: { mode: 'regular' } },
        },
    }));
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
        this.session.change({
            kind: 'field',
            path: [prop('rows'), { kind: 'row', key: 'a' }, prop('choice')],
            input,
        });
        this.tick.update(this.increment);
    }
    useDraft(): void {
        this.replace({ kind: 'raw', text: 'invalid\npartial-' });
    }
    reorder(): void {
        this.session.change({ kind: 'move-row', path: [prop('rows')], key: 'b', before: 'a' });
        this.tick.update(this.increment);
    }
}
