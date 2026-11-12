/** Synthetic independently authored structural components; public package imports only. */
import { Component, ElementRef, input, output, signal, inject } from '@angular/core';
import {
  ThemeShellOutlet, ThemeNavigationOutlet, ThemePanelOutlet, ThemeService,
  type ThemeShellComponent, type ThemeNavigationComponent, type ThemeNavigationItem,
  type ThemeNavigationSelection, type ThemeDefinition, type ThemeArtifacts,
  ThemeArtifact,
} from '@alxarafe/ui-runtime';
import { QA_THEMES } from './fixtures';

const NAVIGATION = `
  <nav aria-label="Composition navigation"><ul>
    @for (item of items(); track item.id) {
      <li>
        @if (item.href && !item.disabled) {
          <a [href]="item.href" [attr.aria-current]="item.current ? 'page' : null">{{ item.label }}</a>
        } @else {
          <button [disabled]="item.disabled" (click)="selected.emit({ itemId: item.id })">{{ item.label }}</button>
        }
      </li>
    }
  </ul></nav>`;
@Component({ selector: 'qa-port-navigation', template: NAVIGATION })
class PortNavigation implements ThemeNavigationComponent {
  readonly items = input<readonly ThemeNavigationItem[]>([]);
  readonly selected = output<ThemeNavigationSelection>();
}
@Component({ selector: 'qa-port-alternate-navigation', template: NAVIGATION, host: { 'data-testid': 'alternate-navigation' } })
class AlternateNavigation implements ThemeNavigationComponent {
  readonly items = input<readonly ThemeNavigationItem[]>([]);
  readonly selected = output<ThemeNavigationSelection>();
}
@Component({ selector: 'qa-port-panel', template: '<section data-testid="port-panel"><ng-content /></section>' })
class PortPanel {}
@Component({ selector: 'qa-port-alternate-panel', template: '<article data-testid="alternate-port-panel"><ng-content /></article>' })
class AlternatePanel {
  private readonly document = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement.ownerDocument;
  ngAfterViewInit(): void {
    // Synthetic race probe: application focus selected while a panel mounts.
    this.document.querySelector<HTMLElement>('[data-qa-focus-on-panel-mount]')?.focus();
  }
}

@Component({
  selector: 'qa-port-shell', imports: [ThemeNavigationOutlet, ThemePanelOutlet],
  template: `
    <section data-testid="port-shell">
      <header><ng-content select="[aur-shell-heading]" /></header>
      <aur-theme-navigation [items]="navigation()" (selected)="navigationSelected.emit($event)" />
      <main><aur-theme-panel><ng-content select="[aur-shell-content]" /></aur-theme-panel></main>
      <aside aria-label="Named tools"><ng-content select='[aur-theme-region="tools"]' /></aside>
      <footer><ng-content select="[aur-shell-footer]" /></footer>
      <div data-testid="unclaimed-regions"><ng-content /></div>
    </section>`,
})
class PortShell implements ThemeShellComponent {
  readonly navigation = input<readonly ThemeNavigationItem[]>([]);
  readonly navigationSelected = output<ThemeNavigationSelection>();
}
@Component({
  selector: 'qa-port-alternate-shell', imports: [ThemeNavigationOutlet, ThemePanelOutlet],
  template: `
    <article data-testid="alternate-port-shell">
      <header><ng-content select="[aur-shell-heading]" /><ng-content select='[aur-theme-region="tools"]' /></header>
      <div class="port-columns">
        <aside><aur-theme-navigation [items]="navigation()" (selected)="navigationSelected.emit($event)" /></aside>
        <main><aur-theme-panel><ng-content select="[aur-shell-content]" /></aur-theme-panel></main>
      </div>
      <footer><ng-content select="[aur-shell-footer]" /></footer>
      <div data-testid="unclaimed-regions"><ng-content /></div>
    </article>`,
})
class AlternateShell implements ThemeShellComponent {
  readonly navigation = input<readonly ThemeNavigationItem[]>([]);
  readonly navigationSelected = output<ThemeNavigationSelection>();
}

export const COMPOSITION_THEMES: readonly ThemeDefinition[] = [
  { id: 'default', cssClass: 'qa-default', overrides: {
    ...QA_THEMES[0]!.overrides,
    [ThemeArtifact.Shell]: PortShell, [ThemeArtifact.Navigation]: PortNavigation, [ThemeArtifact.Panel]: PortPanel,
  } as ThemeArtifacts },
  { id: 'qa-structural', cssClass: 'qa-alternative', overrides: {
    [ThemeArtifact.Shell]: AlternateShell, [ThemeArtifact.Navigation]: AlternateNavigation, [ThemeArtifact.Panel]: AlternatePanel,
  } },
  { id: 'qa-css-only', cssClass: 'qa-alternative', overrides: {} },
  { id: 'qa-panel-only', cssClass: 'qa-alternative', overrides: { [ThemeArtifact.Panel]: AlternatePanel } },
];

@Component({
  selector: 'qa-testbed', imports: [ThemeShellOutlet],
  template: `
    <h1>Independent composition ports</h1>
    <button id="port-default" (click)="themes.activate('default')">Default structure</button>
    <button id="port-alternate" (click)="themes.activate('qa-structural')">Alternate structure</button>
    <button id="port-css" (click)="themes.activate('qa-css-only')">CSS-only structure</button>
    <button id="port-unknown" (click)="themes.activate('unknown')">Unknown structure</button>
    <button id="port-panel-only" (click)="themes.activate('qa-panel-only')">Panel-only structure</button>
    <button id="port-content-toggle" (click)="showContent.set(!showContent())">Toggle supplied content</button>
    <button id="port-navigation-update" (click)="updateNavigation()">Update navigation</button>
    <p role="status">Effective: <span data-testid="port-effective">{{ themes.current().id }}</span></p>
    <p>Intent: <output data-testid="navigation-intent">{{ intent() }}</output></p>
    <aur-theme-shell [heading]="heading" [content]="showContent() ? content : replacement"
      [footer]="footer" [navigation]="navigation()" [regions]="{ tools: tools, unplaced: unplaced }"
      (navigationSelected)="intent.set($event.itemId)" />
    <ng-template #heading><h2>Application heading</h2></ng-template>
    <ng-template #content>
      <label for="port-draft">Application draft</label>
      <input id="port-draft" [value]="draft()" (input)="draft.set($any($event.target).value)" />
      <p data-testid="port-draft-result">{{ draft() }}</p>
      <button (click)="edits.set(edits() + 1)">Application counter {{ edits() }}</button>
    </ng-template>
    <ng-template #replacement><p>Replacement content</p></ng-template>
    <ng-template #footer><p>Application footer</p></ng-template>
    <ng-template #tools>
      <label for="port-tool">Application tool draft</label><input id="port-tool" value="Local view state" />
      <button (click)="edits.set(edits() + 1)">Tool counter {{ edits() }}</button>
    </ng-template>
    <ng-template #unplaced><button>Unplaced application action</button></ng-template>
  `,
})
export class CompositionTestbed {
  readonly themes = inject(ThemeService);
  readonly draft = signal('Unsaved application data');
  readonly intent = signal('none');
  readonly edits = signal(0);
  readonly showContent = signal(true);
  readonly navigation = signal<readonly ThemeNavigationItem[]>([
    { id: 'draft-link', label: 'Go to draft', href: '?scenario=composition#port-draft', current: true },
    { id: 'application-action', label: 'Application action' },
    { id: 'blocked', label: 'Unavailable action', disabled: true },
  ]);
  updateNavigation(): void {
    this.navigation.update(items => [...items, { id: 'later', label: 'Later action' }]);
  }
}
