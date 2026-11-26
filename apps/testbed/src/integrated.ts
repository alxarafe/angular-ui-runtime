/** Cohesive acceptance host. Existing private scenarios consume installed public APF exports. */
import {
    Component,
    ViewContainerRef,
    computed,
    effect,
    inject,
    inputBinding,
    untracked,
    signal,
    viewChild,
} from '@angular/core';
import {
    ThemeShellOutlet,
    ThemeService,
    type MenuDefinition,
    type ThemeNavigationItem,
} from '@alxarafe/ui-runtime';
import { EditorTestbed } from './editor';
import { ListPortsTestbed } from './list-ports';

@Component({
    selector: 'qa-testbed',
    imports: [ThemeShellOutlet],
    template: `<aur-theme-shell
            [heading]="heading"
            [content]="content"
            [navigation]="legacy"
            [menus]="typed() ? menus() : undefined"
            (menuSelected)="navigate('typed', $event.itemId)"
            (navigationSelected)="navigate('legacy', $event.itemId)"
        />
        <ng-template #heading>
            <h1>Integrated MVP acceptance</h1>
            <div class="toolbar">
                @for (id of themes; track id) {
                    <button (click)="theme.activate(id)">{{ id }}</button>
                }
                <button (click)="typed.set(false)">Use legacy menus</button
                ><button (click)="typed.set(true)">Use typed menus</button>
            </div>
            <output data-testid="integration-navigation">{{
                encode({ view: view(), typed: typed(), events: events() })
            }}</output>
        </ng-template>
        <ng-template #content>
            <div data-testid="integrated-editor" [hidden]="view() !== 'editor'">
                <ng-container #editorTarget />
            </div>
            <div data-testid="integrated-list" [hidden]="view() !== 'list'">
                <ng-container #listTarget />
            </div>
        </ng-template>`,
    styles: [
        ':host{display:block;min-width:0;max-width:100%}.toolbar{display:flex;flex-wrap:wrap;gap:.25rem}button{font:inherit;max-width:100%;white-space:normal}output{display:block;overflow-wrap:anywhere}[hidden]{display:none!important}',
    ],
})
export class IntegratedTestbed {
    readonly theme = inject(ThemeService);
    readonly themes = ['default', 'alternative', 'cyberpunk', 'vintage', 'high-contrast'];
    readonly typed = signal(true);
    readonly view = signal('editor');
    readonly events = signal<readonly { source: string; target: string }[]>([]);
    readonly encode = JSON.stringify;
    readonly legacy: readonly ThemeNavigationItem[] = [
        { id: 'editor', label: 'Editor legacy' },
        { id: 'list', label: 'List legacy' },
    ];
    readonly menus = computed<readonly MenuDefinition[]>(() => [
        {
            id: 'workspace',
            kind: 'primary',
            label: 'Workspace views',
            items: [
                {
                    id: 'editor',
                    label: 'Open editor',
                    action: 'editor',
                    current: this.view() === 'editor',
                },
                { id: 'list', label: 'Open list', action: 'list', current: this.view() === 'list' },
                { id: 'blocked', label: 'Unavailable view', action: 'blocked', disabled: true },
            ],
        },
    ]);
    private readonly editorTarget = viewChild('editorTarget', { read: ViewContainerRef });
    private readonly listTarget = viewChild('listTarget', { read: ViewContainerRef });
    constructor() {
        effect((cleanup) => {
            const editorTarget = this.editorTarget(),
                listTarget = this.listTarget();
            if (!editorTarget || !listTarget) return;
            const editor = untracked(() =>
                editorTarget.createComponent(EditorTestbed, {
                    bindings: [inputBinding('integrated', () => true)],
                }),
            );
            const list = untracked(() =>
                listTarget.createComponent(ListPortsTestbed, {
                    bindings: [inputBinding('embedded', () => true)],
                }),
            );
            cleanup(() => {
                editor.destroy();
                list.destroy();
            });
        });
    }
    navigate(source: string, target: string): void {
        this.events.update((events) => [...events, { source, target }]);
        if (target === 'editor' || target === 'list') this.view.set(target);
    }
}
