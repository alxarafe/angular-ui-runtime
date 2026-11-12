/** Disposable installed-package consumer: routing policy lives only in this fixture. */
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ThemeShellOutlet, ThemeService, type ThemeNavigationItem, type ThemeLinkActivationHandler } from '@alxarafe/ui-runtime';
import { PACKAGED_THEMES } from './default-theme';

@Component({
  selector: 'qa-testbed', imports: [ThemeShellOutlet],
  template: `
    <h1>Neutral link activation QA</h1>
    @for (theme of themes; track theme.id) {
      <button [attr.data-navigation-theme]="theme.id" (click)="runtime.activate(theme.id)">{{ theme.id }}</button>
    }
    <p data-testid="navigation-theme">{{ runtime.current().id }}</p>
    <p data-testid="navigation-count">{{ requests() }}</p>
    <p data-testid="action-count">{{ actions() }}</p>
    <p data-testid="navigation-route">{{ route() }}</p>
    <p data-testid="link-cancelled">{{ cancelled() }}</p>
    <p data-testid="link-last">{{ last() }}</p>
    <aur-theme-shell [navigation]="items" [content]="content" [linkActivation]="mode === 'native' ? undefined : activateLink"
      (navigationSelected)="actions.set(actions() + 1)" />
    <ng-template #content>
      <label for="navigation-draft">Navigation draft</label>
      <input id="navigation-draft" [value]="draft()" (input)="draft.set($any($event.target).value)" />
      <output data-testid="navigation-draft-state">{{ draft() }}</output>
      <h2 id="native-fragment">Native fragment target</h2>
    </ng-template>
  `,
})
export class NavigationTestbed {
  readonly runtime = inject(ThemeService);
  readonly themes = PACKAGED_THEMES;
  readonly mode = new URLSearchParams(location.search).get('mode') ?? 'spa';
  readonly requests = signal(0);
  readonly actions = signal(0);
  readonly route = signal(location.href);
  readonly cancelled = signal(false);
  readonly last = signal('none');
  readonly draft = signal('Unsaved navigation draft');
  readonly fragmentHref = `${location.pathname}${location.search}#native-fragment`;
  readonly items: readonly ThemeNavigationItem[] = [
    { id: 'current', label: 'Current page', href: this.fragmentHref, current: true },
    { id: 'group', label: 'Navigation group', children: [
      { id: 'internal', label: 'Internal query link', href: `/default-theme/?scenario=navigation&mode=${this.mode}&destination=first#native-fragment` },
      { id: 'fragment', label: 'Fragment link', href: this.fragmentHref },
      { id: 'external', label: 'External link', href: 'https://external.example/landing?query=exact#end' },
      { id: 'blank', label: 'New tab link', href: '/default-theme/?scenario=navigation&mode=native', target: '_blank' },
      { id: 'download', label: 'Download file', href: '/navigation-download.txt', download: 'navigation.txt' },
      { id: 'disabled', label: 'Disabled link', href: '/must-not-navigate', disabled: true },
      { id: 'action', label: 'Consumer action' },
    ] },
  ];
  readonly activateLink: ThemeLinkActivationHandler = activation => {
    this.requests.update(value => value + 1);
    this.last.set(JSON.stringify({ itemId: activation.itemId, href: activation.href }));
    if (this.mode === 'spa' || this.mode === 'reject') {
      activation.preventDefault();
      if (this.mode === 'spa') {
        history.pushState(null, '', activation.href);
        this.route.set(location.href);
      }
    }
    this.cancelled.set(activation.defaultPrevented);
    if (this.mode === 'late') Promise.resolve().then(() => {
      activation.preventDefault();
      this.cancelled.set(activation.defaultPrevented);
    });
  };
  constructor() {
    const pop = () => this.route.set(location.href);
    window.addEventListener('popstate', pop);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('popstate', pop));
  }
}
