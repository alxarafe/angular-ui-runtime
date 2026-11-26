/** SPDX-License-Identifier: Apache-2.0 */
import {
    Component,
    ElementRef,
    Injector,
    afterNextRender,
    computed,
    contentChildren,
    inject,
    input,
    output,
    signal,
    viewChild,
    viewChildren,
} from '@angular/core';
import { FormSlot, FormSlotOutlet } from './form-slot.js';
import { ThemeService } from '../theme/theme-runtime.js';
import { validateFormContexts } from './form-contexts.js';
import {
    composeForm,
    formPathKey,
    type ComposedSection,
    type ComposedTab,
} from './compose-form.js';
import type {
    ContextAction,
    FormDefinition,
    FormFieldContexts,
    FormFieldChange,
    FormFieldEdit,
    FormFieldPage,
    FormLayout,
    FormViewState,
    ValuePath,
} from './form-definition.js';

import { FormFrame, FormFieldOutlet } from './form-outlets.js';
import { DetailGrid } from '../grid/grid.js';
import {
    validateGrid,
    type FormCollectionContexts,
    type DetailGridChange,
    type DetailGridEdit,
    type DetailGridPage,
} from '../grid/grid-definition.js';
/** Application data is input/output only; the host owns solely visual navigation state. */
@Component({
    selector: 'aur-form',
    imports: [FormFrame, FormFieldOutlet, DetailGrid, FormSlotOutlet],
    host: { '[class]': 'theme.current().cssClass' },
    template: `
        <aur-form-frame [context]="{ id: definition().id, label: definition().label }">
            <form [attr.aria-labelledby]="domId('heading')" (submit)="$event.preventDefault()">
                <h2 [id]="domId('heading')">{{ definition().label }}</h2>
                <div role="group" aria-label="Form actions">
                    @for (action of composition().actions; track action.id) {
                        <button
                            type="button"
                            [disabled]="!action.enabled"
                            (click)="dispatch(action)"
                        >
                            {{ action.label }}
                        </button>
                    }
                </div>
                @if (composition().tabs.length) {
                    <div role="tablist" [attr.aria-label]="definition().label + ' tabs'">
                        @for (tab of composition().tabs; track tab.id; let index = $index) {
                            <button
                                type="button"
                                role="tab"
                                [id]="domId('tab', tab.id)"
                                [attr.data-aur-tab]="tab.id"
                                [attr.aria-controls]="domId('panel', tab.id)"
                                [attr.aria-selected]="selectedTab() === tab.id"
                                [tabIndex]="selectedTab() === tab.id ? 0 : -1"
                                (click)="selectTab(tab.id)"
                                (keydown)="tabKey($event, index)"
                            >
                                {{ tab.label || tab.id }}
                            </button>
                        }
                    </div>
                    @for (tab of composition().tabs; track tab.id) {
                        <div
                            role="tabpanel"
                            [id]="domId('panel', tab.id)"
                            [attr.aria-labelledby]="domId('tab', tab.id)"
                            [hidden]="selectedTab() !== tab.id"
                            tabindex="0"
                        >
                            <div
                                role="group"
                                [attr.aria-label]="(tab.label || tab.id) + ' actions'"
                            >
                                @for (action of tab.actions; track action.id) {
                                    <button
                                        type="button"
                                        [disabled]="!action.enabled"
                                        (click)="dispatch(action)"
                                    >
                                        {{ action.label }}
                                    </button>
                                }
                            </div>
                            @if (!tab.sections.length && !tab.actions.length) {
                                <p>No fields in this tab.</p>
                            }
                            @for (section of tab.sections; track section.id) {
                                <section
                                    [attr.aria-labelledby]="domId('section', tab.id, section.id)"
                                >
                                    <h3 [id]="domId('section', tab.id, section.id)">
                                        @if (section.collapsible) {
                                            <button
                                                type="button"
                                                [attr.aria-expanded]="!collapsed(tab.id, section)"
                                                [attr.aria-controls]="
                                                    domId('section-content', tab.id, section.id)
                                                "
                                                (click)="toggleSection(tab.id, section)"
                                            >
                                                {{ section.label || section.id }}
                                            </button>
                                        } @else {
                                            {{ section.label || section.id }}
                                        }
                                    </h3>
                                    <div
                                        [id]="domId('section-content', tab.id, section.id)"
                                        [hidden]="collapsed(tab.id, section)"
                                    >
                                        <div
                                            role="group"
                                            [attr.aria-label]="
                                                (section.label || section.id) + ' actions'
                                            "
                                        >
                                            @for (action of section.actions; track action.id) {
                                                <button
                                                    type="button"
                                                    [disabled]="!action.enabled"
                                                    (click)="dispatch(action)"
                                                >
                                                    {{ action.label }}
                                                </button>
                                            }
                                        </div>
                                        @if (!section.groups.length && !section.actions.length) {
                                            <p>No fields in this section.</p>
                                        }
                                        @for (group of section.groups; track group.id) {
                                            <fieldset>
                                                <legend>{{ group.label || group.id }}</legend>
                                                @for (field of group.fields; track field.id) {
                                                    <aur-form-field
                                                        data-aur-form-field
                                                        [field]="field"
                                                        [context]="boundContexts()[field.id]!"
                                                        [readOnly]="readOnly()"
                                                        (fieldChange)="fieldChange.emit($event)"
                                                        (fieldEdit)="fieldEdit.emit($event)"
                                                        (fieldPage)="fieldPage.emit($event)"
                                                    />
                                                }
                                                @for (
                                                    collection of group.collections;
                                                    track collection.id
                                                ) {
                                                    <aur-detail-grid
                                                        [context]="
                                                            boundCollections()[collection.id]!
                                                        "
                                                        [readOnly]="readOnly()"
                                                        (gridChange)="collectionChange.emit($event)"
                                                        (gridEdit)="collectionEdit.emit($event)"
                                                        (gridPage)="collectionPage.emit($event)"
                                                    />
                                                }
                                                @for (slot of group.slots; track slot.id) {
                                                    <aur-form-slot
                                                        data-aur-form-slot
                                                        [attr.data-aur-slot]="slot.id"
                                                        [template]="slotTemplates().get(slot.id)!"
                                                        [readOnly]="readOnly()"
                                                    />
                                                }
                                                @if (
                                                    !group.slots.length &&
                                                    !group.fields.length &&
                                                    !group.collections.length
                                                ) {
                                                    <p>No fields in this group.</p>
                                                }
                                            </fieldset>
                                        }
                                    </div>
                                </section>
                            }
                        </div>
                    }
                }
                @if (composition().unplaced.length) {
                    <fieldset>
                        <legend>{{ layout() ? 'Additional fields' : 'Fields' }}</legend>
                        @for (field of composition().unplaced; track field.id) {
                            <aur-form-field
                                data-aur-form-field
                                [field]="field"
                                [context]="boundContexts()[field.id]!"
                                [readOnly]="readOnly()"
                                (fieldChange)="fieldChange.emit($event)"
                                (fieldEdit)="fieldEdit.emit($event)"
                                (fieldPage)="fieldPage.emit($event)"
                            />
                        }
                    </fieldset>
                }
                @for (collection of composition().unplacedCollections; track collection.id) {
                    <aur-detail-grid
                        [context]="boundCollections()[collection.id]!"
                        [readOnly]="readOnly()"
                        (gridChange)="collectionChange.emit($event)"
                        (gridEdit)="collectionEdit.emit($event)"
                        (gridPage)="collectionPage.emit($event)"
                    />
                }
                @if (
                    !composition().tabs.length &&
                    !composition().unplaced.length &&
                    !composition().unplacedCollections.length
                ) {
                    <p>No fields in this form.</p>
                }
            </form>
        </aur-form-frame>
    `,
    styles: [
        `
            :host,
            aur-form-frame,
            form {
                display: block;
                min-width: 0;
            }
            [hidden] {
                display: none !important;
            }
            [role='tablist'] {
                display: flex;
                flex-wrap: wrap;
                gap: 0.5rem;
                margin: 1rem 0;
            }
            button {
                max-width: 100%;
                white-space: normal;
                overflow-wrap: anywhere;
                padding: 0.5rem;
                margin: 0.25rem;
                font: inherit;
                cursor: pointer;
            }
            [role='tab'][aria-selected='true'] {
                font-weight: bold;
                border-bottom: 0.25rem solid currentColor;
            }
            :focus-visible {
                outline: 3px solid currentColor;
                outline-offset: 2px;
            }
            fieldset {
                min-width: 0;
                margin: 0.75rem 0;
            }
            aur-form-field {
                display: block;
                min-width: 0;
                margin: 0.75rem 0;
            }
            li,
            legend,
            h2,
            h3 {
                overflow-wrap: anywhere;
            }
        `,
    ],
})
export class FormComposition {
    readonly collectionContexts = input<FormCollectionContexts>({});
    readonly collectionChange = output<DetailGridChange>();
    protected readonly boundCollections = computed(() => {
        const contexts = this.collectionContexts();
        for (const collection of this.definition().collections ?? []) {
            if (collection.excluded) continue;
            const context = Object.hasOwn(contexts, collection.id)
                ? contexts[collection.id]
                : undefined;
            if (
                !context ||
                context.id !== collection.id ||
                formPathKey(context.path) !== formPathKey(collection.path)
            )
                throw new Error('Missing or inconsistent collection context');
            validateGrid(context, true);
        }
        return contexts;
    });
    readonly definition = input.required<FormDefinition>();
    readonly contexts = input.required<FormFieldContexts>();
    readonly layout = input<FormLayout>();
    readonly readOnly = input(false);
    /** When supplied, the application updates this value in response to viewStateChange. */
    readonly viewState = input<FormViewState>();
    readonly viewStateChange = output<FormViewState>();
    readonly fieldChange = output<FormFieldChange>();
    readonly fieldEdit = output<FormFieldEdit>();
    readonly collectionEdit = output<DetailGridEdit>();
    readonly fieldPage = output<FormFieldPage>();
    readonly collectionPage = output<DetailGridPage>();
    readonly actionSelected = output<string>();
    private readonly slots = contentChildren(FormSlot);
    protected readonly slotTemplates = computed(() => {
        const templates = new Map<string, FormSlot['template']>();
        for (const slot of this.slots()) {
            const id = slot.aurFormSlot();
            if (typeof id !== 'string' || !id.trim()) throw new Error('Invalid form slot identity');
            if (templates.has(id)) throw new Error('Duplicate form slot identity');
            templates.set(id, slot.template);
        }
        return templates;
    });
    readonly composition = computed(() =>
        composeForm(this.definition(), this.layout(), [...this.slotTemplates().keys()]),
    );
    protected readonly boundContexts = computed(() => {
        validateFormContexts(this.definition(), this.contexts());
        return this.contexts();
    });
    protected readonly theme = inject(ThemeService);
    private readonly detailGrids = viewChildren(DetailGrid);
    private readonly localState = signal<FormViewState>({});
    private readonly state = computed(() => this.viewState() ?? this.localState());
    private readonly root = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly injector = inject(Injector);
    readonly selectedTab = computed(
        () =>
            this.composition().tabs.find((tab) => tab.id === this.state().selectedTab)?.id ??
            this.composition().tabs[0]?.id,
    );
    protected domId(...parts: string[]): string {
        return 'aur-form-' + encodeURIComponent(JSON.stringify([this.definition().id, ...parts]));
    }
    private update(state: FormViewState): void {
        this.localState.set(state);
        this.viewStateChange.emit(state);
    }
    selectTab(id: string): void {
        if (this.composition().tabs.some((tab) => tab.id === id))
            this.update({ ...this.state(), selectedTab: id });
    }
    collapsed(tabId: string, section: ComposedSection): boolean {
        return (
            section.collapsible &&
            (this.state().sections?.find(
                (item) => item.tabId === tabId && item.sectionId === section.id,
            )?.collapsed ??
                section.initiallyCollapsed)
        );
    }
    private expand(tab: ComposedTab, section: ComposedSection, collapsed: boolean): void {
        this.update({
            ...this.state(),
            selectedTab: tab.id,
            sections: [
                ...(this.state().sections ?? []).filter(
                    (item) => item.tabId !== tab.id || item.sectionId !== section.id,
                ),
                { tabId: tab.id, sectionId: section.id, collapsed },
            ],
        });
    }
    toggleSection(tabId: string, section: ComposedSection): void {
        const tab = this.composition().tabs.find((tab) => tab.id === tabId);
        if (tab && section.collapsible) this.expand(tab, section, !this.collapsed(tabId, section));
    }
    protected tabKey(event: KeyboardEvent, index: number): void {
        const tabs = this.composition().tabs;
        const next =
            event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? tabs.length - 1
                  : event.key === 'ArrowRight'
                    ? (index + 1) % tabs.length
                    : event.key === 'ArrowLeft'
                      ? (index + tabs.length - 1) % tabs.length
                      : undefined;
        if (next === undefined) return;
        event.preventDefault();
        this.selectTab(tabs[next]!.id);
        this.root.nativeElement.querySelectorAll<HTMLButtonElement>('[role=tab]')[next]?.focus();
    }
    protected dispatch(action: ContextAction): void {
        if (action.enabled) this.actionSelected.emit(action.id);
    }
    /** Reveal a header, keyed cell, row or collection, expanding its owning containers. */
    revealPath(path: ValuePath): boolean {
        if (!path.length) return false;
        if (this.revealField(path)) return true;
        const prefix = (base: ValuePath) =>
            base.length <= path.length &&
            formPathKey(path.slice(0, base.length)) === formPathKey(base);
        const catalogue = (this.definition().collections ?? [])
            .filter((item) => !item.excluded && prefix(item.path))
            .sort((a, b) => b.path.length - a.path.length);
        const collection = catalogue[0];
        if (!collection) return false;
        for (const tab of this.composition().tabs)
            for (const section of tab.sections)
                for (const group of section.groups)
                    if (group.collections.some((item) => item.id === collection.id))
                        this.expand(tab, section, false);
        afterNextRender(
            () =>
                this.detailGrids()
                    .find((grid) => grid.context().id === collection.id)
                    ?.revealPath(path),
            { injector: this.injector },
        );
        return true;
    }
    /** External validation/error hosts may reveal a path without importing a document engine. */
    revealField(path: ValuePath): boolean {
        const key = formPathKey(path),
            composition = this.composition();
        let match = composition.unplaced.find((field) => formPathKey(field.path) === key);
        for (const tab of composition.tabs)
            for (const section of tab.sections)
                for (const group of section.groups) {
                    const field = group.fields.find((field) => formPathKey(field.path) === key);
                    if (field) {
                        match = field;
                        this.expand(tab, section, false);
                    }
                }
        if (!match) return false;
        const fieldId = match.id;
        afterNextRender(
            () => {
                const wrapper = [
                    ...this.root.nativeElement.querySelectorAll<HTMLElement>(
                        'aur-form-field[data-aur-form-field]',
                    ),
                ].find((node) => node.dataset['aurField'] === fieldId);
                wrapper
                    ?.querySelector<HTMLElement>(
                        'input:not(:disabled),select:not(:disabled),textarea:not(:disabled),button:not(:disabled)',
                    )
                    ?.focus();
            },
            { injector: this.injector },
        );
        return true;
    }
}
