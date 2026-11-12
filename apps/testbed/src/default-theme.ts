/** Installed theme consumer; no theme or runtime private source imports. */
import { Component, inject, signal } from '@angular/core';
import {
  ThemeShellOutlet, ThemeService, ThemeRegistry, ThemeResolver, ThemeArtifact, THEME_ARTIFACTS,
  type FieldValue, type ThemeDefinition, type ThemeNavigationItem,
} from '@alxarafe/ui-runtime';
import { DEFAULT_THEME } from '@alxarafe/ui-theme-default';
import { QaFieldOutlet } from './outlets';
import { COMPOSITION_THEMES } from './composition';

export const DEFAULT_PACKAGE_THEMES: readonly ThemeDefinition[] = [
  DEFAULT_THEME,
  { id: 'independent-structure', cssClass: 'qa-alternative', overrides: {
    [ThemeArtifact.Shell]: COMPOSITION_THEMES[1]!.overrides.shell,
  } },
  { id: 'css-only', cssClass: 'theme-default', overrides: {} },
];
const initial: Readonly<Record<string, FieldValue>> = {
  BOOLEAN: null, STRING: null, TEXT: '', INT8: '-128', UINT8: '255', INT16: '-32768', UINT16: '65535',
  INT32: '-2147483648', UINT32: '4294967295', INT64: '9223372036854775807',
  DECIMAL: '12345678901234567890.123456789', UUID: '550e8400-e29b-41d4-a716-446655440000',
  DATE: '2026-11-12', TIME: '12:34:56.123', DATETIME: '2026-11-12T12:34:56.1234567+01:00',
  ENUM: null, BINARY: null,
};

@Component({
  selector: 'qa-testbed', imports: [ThemeShellOutlet, QaFieldOutlet],
  template: `
    <div class="package-qa-controls">
      <p>Installed independent default theme · captures pending human approval</p>
      <button id="package-default" (click)="themes.activate('default')">Packaged default</button>
      <button id="package-structural" (click)="themes.activate('independent-structure')">Independent structural override</button>
      <button id="package-css" (click)="themes.activate('css-only')">Sparse CSS fallback</button>
      <button id="package-unknown" (click)="themes.activate('unknown')">Unknown fallback</button>
      <button (click)="mode.set('disabled')">Disable fields</button>
      <button (click)="mode.set('readonly')">Read-only fields</button>
      <button (click)="mode.set('edit')">Edit fields</button>
      <button (click)="update('BINARY', 'Zm9v')">Supply binary output</button>
      <p data-testid="package-status">{{ themes.current().id }} · {{ artifacts.length }} artifacts</p>
      <p>Application intent: <output data-testid="package-intent">{{ intent() }}</output></p>
    </div>
    <aur-theme-shell [heading]="heading" [content]="content" [footer]="footer" [navigation]="navigation"
      [regions]="{ 'topbar-start': start, 'topbar-actions': actions, 'navigation-before': beforeNav,
        'navigation-after': afterNav, 'content-before': beforeContent, 'contextual-actions': contextual,
        'content-after': afterContent, 'floating-actions': tools, footer: footerRegion, unclaimed: unclaimed }"
      (navigationSelected)="intent.set($event.itemId)" />
    <ng-template #heading><h1>Independent default theme</h1></ng-template>
    <ng-template #content>
      <h2>Exact editing values</h2>
      <p>No 1.0 semantic validator is implemented.</p>
      @for (artifact of fieldArtifacts; track artifact) {
        <section [attr.data-field]="type(artifact)">
          <qa-field-outlet [artifact]="artifact" [context]="{ id: type(artifact), label: type(artifact),
            value: values()[type(artifact)], choices: ['', 'ready', 'Not set'],
            disabled: mode() === 'disabled', readOnly: mode() === 'readonly' }"
            (valueChange)="update(type(artifact), $event)" />
          <p>Application value: <output data-testid="field-result">{{ encode(values()[type(artifact)]) }}</output></p>
        </section>
      }
      <qa-field-outlet [artifact]="timeArtifact" [context]="{id: 'precise-time', label: 'Precise TIME', value: preciseTime()}"
        (valueChange)="preciseTime.set($event)" />
      <p>Precise TIME value: <output data-testid="precise-time-result">{{ preciseTime() }}</output></p>
      <label for="package-application-draft">Application-owned draft</label>
      <input id="package-application-draft" value="Unbound application state" />
      <pre class="package-values" data-testid="package-values">{{ encode(values()) }}</pre>
    </ng-template>
    <ng-template #footer><p>Application-owned footer</p></ng-template>
    <ng-template #start><span>Application identity</span></ng-template>
    <ng-template #actions><button>Account action</button></ng-template>
    <ng-template #beforeNav><p>Application navigation</p></ng-template>
    <ng-template #afterNav><p>Navigation help</p></ng-template>
    <ng-template #beforeContent><p>Context information</p></ng-template>
    <ng-template #contextual><button>Context action</button></ng-template>
    <ng-template #afterContent><p>End of editing controls</p></ng-template>
    <ng-template #tools><label for="package-tool">Application tool</label><input id="package-tool" value="Tool draft" /><button>Optional tool</button></ng-template>
    <ng-template #footerRegion><p>Footer contribution</p></ng-template>
    <ng-template #unclaimed><button>Unclaimed application action</button></ng-template>
  `,
})
export class DefaultThemeTestbed {
  readonly themes = inject(ThemeService);
  readonly registry = inject(ThemeRegistry);
  readonly resolver = inject(ThemeResolver);
  readonly artifacts = THEME_ARTIFACTS;
  readonly fieldArtifacts = THEME_ARTIFACTS.filter((key): key is Extract<typeof key, `field.${string}`> => key.startsWith('field.'));
  readonly timeArtifact = ThemeArtifact.FieldTime;
  readonly values = signal<Record<string, FieldValue>>({ ...initial });
  readonly preciseTime = signal<FieldValue>('12:34:56.1234567');
  readonly intent = signal('none');
  readonly mode = signal<'edit' | 'disabled' | 'readonly'>('edit');
  readonly navigation: readonly ThemeNavigationItem[] = [
    { id: 'fields', label: 'Editing fields', href: '#STRING', current: true },
    { id: 'operations', label: 'Operations', children: [
      { id: 'refresh-view', label: 'Application action' },
      { id: 'unavailable', label: 'Unavailable action', disabled: true },
    ] },
  ];
  readonly type = (key: string) => key.slice('field.'.length);
  readonly encode = (value: unknown) => JSON.stringify(value);
  update(id: string, value: FieldValue): void { this.values.update(values => ({ ...values, [id]: value })); }
}
