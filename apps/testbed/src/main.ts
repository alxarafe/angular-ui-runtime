import { Component, inject, signal } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import {
  UI_RUNTIME_VERSION, ThemeArtifact, THEME_ARTIFACTS, ThemeRegistry, ThemeService,
  provideThemeRuntime, type FieldValue,
} from '@alxarafe/ui-runtime';
import { QA_THEMES } from './fixtures';
import { QaFieldOutlet, QaStructureOutlet } from './outlets';
import { CompositionTestbed, COMPOSITION_THEMES } from './composition';

@Component({
  selector: 'qa-testbed',
  imports: [QaFieldOutlet, QaStructureOutlet],
  template: `
    <div [class]="theme.current().cssClass">
      <header>
        <p class="eyebrow">Repository-local QA fixture · Package {{ version }}</p>
        <h1>UI Runtime browser probes</h1>
        <p>Synthetic themes only. No production theme or 1.0 visual approval.</p>
        <div class="theme-controls" role="group" aria-label="Synthetic QA themes">
          <button (click)="activate('default')" [attr.aria-pressed]="theme.current().id === 'default'">Default QA theme</button>
          <button (click)="activate('qa-alternative')" [attr.aria-pressed]="theme.current().id === 'qa-alternative'">Alternative QA theme</button>
          <button (click)="activate('unknown')">Unknown theme fallback</button>
        </div>
        <p role="status" data-testid="theme-status">Active: <strong data-testid="active-theme">{{ theme.current().id }}</strong> · Activation: {{ activation() }}</p>
      </header>
      <qa-structure-outlet [artifact]="artifact.Shell" [content]="shellContent" />
      <ng-template #shellContent>
        <qa-structure-outlet [artifact]="artifact.Navigation" />
        <main id="probes">
          <qa-structure-outlet [artifact]="artifact.Panel" [content]="panelContent" />
        </main>
      </ng-template>
      <ng-template #panelContent>
        <h2>Existing renderer bindings</h2>
        <p>Exact text is emitted unchanged. No semantic validation is implemented.</p>
        <qa-field-outlet [artifact]="artifact.FieldDecimal"
          [context]="{ id: 'exact-value', label: 'Exact decimal text', value: exact() }"
          (valueChange)="exact.set($event)" />
        <qa-field-outlet [artifact]="artifact.FieldBoolean"
          [context]="{ id: 'boolean-value', label: 'Boolean probe', value: flag() }"
          (valueChange)="flag.set($event)" />
        <qa-field-outlet [artifact]="artifact.FieldString"
          [context]="{ id: 'disabled-value', label: 'Disabled probe', value: 'Disabled fixture', disabled: true }" />
        <qa-field-outlet [artifact]="artifact.FieldString"
          [context]="{ id: 'readonly-value', label: 'Read-only probe', value: 'Read-only fixture', readOnly: true }" />
        <p class="result">Emitted exact text: <output data-testid="exact-result">{{ exact() }}</output></p>
        <p>Boolean result: <output data-testid="boolean-result">{{ flag() }}</output></p>
      </ng-template>
      <footer>
        Registered: <span data-testid="registered-themes">{{ registered }}</span> ·
        <span data-testid="artifact-count">{{ artifactCount }}</span> artifact bindings.
        Captures are review candidates, not approved baselines.
      </footer>
    </div>
  `,
})
class Testbed {
  readonly version = UI_RUNTIME_VERSION;
  readonly artifact = ThemeArtifact;
  readonly artifactCount = THEME_ARTIFACTS.length;
  readonly theme = inject(ThemeService);
  readonly registered = inject(ThemeRegistry).all.map(theme => theme.id).join(', ');
  readonly exact = signal<FieldValue>('9223372036854775807.123456789');
  readonly flag = signal<FieldValue>(true);
  readonly activation = signal(true);
  activate(id: string): void { this.activation.set(this.theme.activate(id)); }
}
const composition = new URLSearchParams(location.search).get('scenario') === 'composition';
bootstrapApplication(composition ? CompositionTestbed : Testbed, {
  providers: provideThemeRuntime(composition ? COMPOSITION_THEMES : QA_THEMES),
}).catch(error => {
  console.error(error);
  throw error;
});
