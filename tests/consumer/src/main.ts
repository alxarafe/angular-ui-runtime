import { Component, inject, input, output } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import {
    UI_RUNTIME_VERSION,
    ThemeArtifact,
    THEME_ARTIFACTS,
    ThemeId,
    ThemeRegistry,
    ThemeService,
    ThemeResolver,
    provideThemeRuntime,
    FIELD_RENDERER_BINDINGS,
    ListGrid,
    DetailGrid,
    FormComposition,
    type DetailGridContext,
    type DetailGridChange,
    type ThemeDefinition,
    type ThemeArtifacts,
    type StructureArtifact,
    type FieldArtifact,
    type FieldRenderer,
    type FieldRendererContext,
    type FieldValue,
} from '@alxarafe/ui-runtime';

// Empty disposable probes validate public declarations and the Angular linker.
@Component({ standalone: true, template: '' })
class FieldProbe implements FieldRenderer {
    readonly context = input.required<FieldRendererContext>();
    readonly valueChange = output<FieldValue>();
}
@Component({
    selector: 'aur-consumer',
    standalone: true,
    imports: [ListGrid, DetailGrid, FormComposition],
    template: `<p>Runtime {{ version }} {{ theme.current().id }}</p>
        <aur-list-grid
            [context]="{
                id: 'list',
                label: 'List',
                columns: details.columns,
                rows: [],
                selectable: true,
            }"
            (rowSelected)="selected = $event"
        />
        <aur-detail-grid [context]="details" (gridChange)="intent = $event" />
        <aur-form
            [definition]="{
                id: 'parent',
                label: 'Parent',
                fields: [],
                collections: [{ id: details.id, path: details.path }],
            }"
            [contexts]="{}"
            [collectionContexts]="{ items: details }"
            (collectionChange)="intent = $event"
        />`,
})
class Consumer {
    selected = '';
    intent?: DetailGridChange;
    readonly details: DetailGridContext = {
        id: 'items',
        label: 'Items',
        path: [{ kind: 'property', name: 'items' }],
        columns: [
            { id: 'quantity', label: 'Quantity', field: 'quantity', artifact: 'field.INTEGER' },
        ],
        rows: [],
        ordered: true,
        readOnly: false,
        allowAdd: true,
        allowRemove: true,
        allowReorder: true,
    };
    readonly version = UI_RUNTIME_VERSION;
    readonly theme = inject(ThemeService);
    private readonly registry = inject(ThemeRegistry);
    private readonly resolver = inject(ThemeResolver);
    constructor() {
        const structure: StructureArtifact = ThemeArtifact.Shell;
        const decimal: FieldArtifact = ThemeArtifact.FieldDecimal;
        const integer: FieldArtifact = ThemeArtifact.FieldInteger;
        this.registry.require(ThemeId.Default);
        this.theme.activate('css-only');
        this.resolver.resolve(structure);
        this.resolver.resolve(decimal);
        this.resolver.resolve(integer);
        if (FIELD_RENDERER_BINDINGS.context !== 'context')
            throw new Error('Invalid public bindings');
    }
}
const defaults: ThemeArtifacts = Object.fromEntries(
    THEME_ARTIFACTS.map((artifact) => [
        artifact,
        artifact.startsWith('field.') ? FieldProbe : Consumer,
    ]),
) as ThemeArtifacts;
const themes: readonly ThemeDefinition[] = [
    { id: ThemeId.Default, cssClass: 'theme-default', overrides: defaults },
    { id: 'css-only', cssClass: 'theme-css-only', overrides: {} },
];
bootstrapApplication(Consumer, { providers: provideThemeRuntime(themes) }).catch(
    (error: unknown) => {
        throw error;
    },
);
