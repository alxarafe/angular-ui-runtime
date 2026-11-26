/** Installed APF probes; all custom component behavior belongs to this private consumer. */
import { Component, DestroyRef, inject, input, output, signal, viewChild } from '@angular/core';
import {
    FormComposition,
    FormSlot,
    ThemePanelOutlet,
    ThemeService,
    type FormDefinition,
    type FormDiagnostic,
    type FormLayout,
    type FormCollectionContexts,
} from '@alxarafe/ui-runtime';
let created = 0;
let destroyed = 0;
@Component({
    selector: 'qa-slot-editor',
    template: `<label
            >{{ label()
            }}<input
                [value]="draft()"
                [readOnly]="readOnly()"
                [disabled]="disabled()"
                (input)="edit($any($event.target).value)" /></label
        ><output class="instance">{{ instance }}</output>`,
    styles: [
        ':host{display:block;min-width:0}input{box-sizing:border-box;max-width:100%;font:inherit}',
    ],
})
class SlotEditor {
    readonly label = input.required<string>();
    readonly readOnly = input(false);
    readonly disabled = input(false);
    readonly draft = signal('Local draft');
    readonly changed = output<string>();
    edit(value: string): void {
        if (this.readOnly() || this.disabled()) return;
        this.draft.set(value);
        this.changed.emit(value);
    }
    readonly instance = ++created;
    constructor() {
        inject(DestroyRef).onDestroy(() => destroyed++);
    }
}
const path = (name: string) => [{ kind: 'property' as const, name }];
@Component({
    selector: 'qa-testbed',
    imports: [FormComposition, FormSlot, SlotEditor, ThemePanelOutlet],
    template: `<h1>Retained form slots</h1>
        <div class="toolbar">
            @for (id of themes; track id) {
                <button (click)="theme.activate(id)">{{ id }}</button>
            }
            <button (click)="readOnly.set(!readOnly())">Toggle read-only</button>
            <button (click)="disabled.set(!disabled())">Toggle custom disabled</button>
            <button (click)="refresh.update(increment)">Refresh field</button>
        </div>
        <aur-theme-panel>
            @if (mounted()) {
                <aur-form
                    [definition]="definition"
                    [contexts]="{
                        title: {
                            id: 'slots-title',
                            label: 'Standard title',
                            value: 'Refresh ' + refresh(),
                        },
                    }"
                    [layout]="layout"
                    [readOnly]="readOnly()"
                    [collectionContexts]="collections"
                    (actionSelected)="action.set($event)"
                >
                    <ng-template aurFormSlot="first" let-readOnly="readOnly">
                        <qa-slot-editor
                            label="Custom first"
                            (changed)="customChange.set($event)"
                            [readOnly]="readOnly"
                            [disabled]="disabled()"
                        />
                    </ng-template>
                    <ng-template aurFormSlot="second" let-readOnly="readOnly">
                        <qa-slot-editor label="Custom second" [readOnly]="readOnly" />
                    </ng-template>
                    <ng-template aurFormSlot="third"
                        ><button type="button">Custom third</button></ng-template
                    >
                    <ng-template aurFormSlot="unused"
                        ><qa-slot-editor label="Must stay uncreated"
                    /></ng-template>
                </aur-form>
            }
        </aur-theme-panel>
        <button (click)="mounted.set(!mounted())">Toggle form mounted</button>
        <output data-testid="slot-change">{{ customChange() }}</output>
        <output data-testid="slot-lifetime">{{ counts() }}</output><output
            data-testid="slot-action"
            >{{ action() }}</output
        >`,
    styles: [
        ':host{display:block;min-width:0;padding:.5rem}.toolbar{display:flex;flex-wrap:wrap;gap:.25rem}button{font:inherit}',
    ],
})
export class FormSlotsTestbed {
    readonly mounted = signal(true);
    readonly form = viewChild(FormComposition);
    constructor() {
        const target = globalThis as typeof globalThis & {
            __aurSlotsQa?: { diagnostics: () => readonly FormDiagnostic[] };
        };
        const api = { diagnostics: () => this.form()?.composition().diagnostics ?? [] };
        target.__aurSlotsQa = api;
        inject(DestroyRef).onDestroy(() => {
            if (target.__aurSlotsQa === api) delete target.__aurSlotsQa;
        });
    }
    readonly themes = [
        'default',
        'alternative',
        'cyberpunk',
        'vintage',
        'high-contrast',
        'form-frame',
    ];
    readonly theme = inject(ThemeService);
    readonly readOnly = signal(new URLSearchParams(location.search).get('readonly') === '1');
    readonly disabled = signal(false);
    readonly refresh = signal(0);
    readonly increment = (n: number) => n + 1;
    readonly action = signal('');
    readonly customChange = signal('');
    counts(): string {
        return `${created}/${destroyed}`;
    }
    readonly definition: FormDefinition = {
        id: 'slots',
        label: 'Mixed slots form',
        fields: [
            { id: 'title', path: path('title'), artifact: 'field.STRING' },
            { id: 'fallback', path: path('fallback'), artifact: 'field.STRING', excluded: true },
        ],
        collections: [{ id: 'rows', path: path('rows') }],
        actions: [{ id: 'inspect', label: 'Inspect slots', enabled: true }],
    };
    readonly collections: FormCollectionContexts = {
        rows: {
            id: 'rows',
            path: path('rows'),
            label: 'Detail rows',
            columns: [
                { id: 'value', field: 'value', label: 'Detail value', artifact: 'field.STRING' },
            ],
            rows: [{ key: 'one', label: 'One', values: { value: 'Detail draft' } }],
            ordered: false,
            readOnly: false,
            allowAdd: false,
            allowRemove: false,
            allowReorder: false,
        },
    };
    readonly layout: FormLayout = {
        actions: [],
        tabs: ['first', 'second'].map((id, index) => ({
            id,
            label: index ? 'Second tab' : 'First tab',
            actions: [],
            sections: [
                {
                    id: 'section',
                    label: index ? 'Second section' : 'First section',
                    collapsible: true,
                    initiallyCollapsed: false,
                    actions: index ? [] : [{ id: 'inspect' }],
                    groups: [
                        {
                            id: 'mixed',
                            label: 'Mixed group',
                            fields: index ? [] : [path('title')],
                            collections: index ? [] : [path('rows')],
                            slots: index
                                ? [{ id: 'second' }, { id: 'first' }, { id: 'missing' }]
                                : [{ id: 'first' }, { id: 'third' }],
                        },
                    ],
                },
            ],
        })),
    };
}
