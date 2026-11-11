import { Component, inject, input, output } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import {
  UI_RUNTIME_VERSION, ThemeArtifact, THEME_ARTIFACTS, ThemeId,
  ThemeRegistry, ThemeService, ThemeResolver, provideThemeRuntime, FIELD_RENDERER_BINDINGS,
  type ThemeDefinition, type ThemeArtifacts, type StructureArtifact, type FieldArtifact,
  type FieldRenderer, type FieldRendererContext, type FieldValue,
} from '@alxarafe/ui-runtime';

// Empty disposable probes validate public declarations and the Angular linker.
@Component({ standalone: true, template: '' })
class FieldProbe implements FieldRenderer {
  readonly context = input.required<FieldRendererContext>();
  readonly valueChange = output<FieldValue>();
}
@Component({ selector: 'aur-consumer', standalone: true, template: '<p>Runtime {{ version }} {{ theme.current().id }}</p>' })
class Consumer {
  readonly version = UI_RUNTIME_VERSION;
  readonly theme = inject(ThemeService);
  private readonly registry = inject(ThemeRegistry);
  private readonly resolver = inject(ThemeResolver);
  constructor() {
    const structure: StructureArtifact = ThemeArtifact.Shell;
    const field: FieldArtifact = ThemeArtifact.FieldDecimal;
    this.registry.require(ThemeId.Default);
    this.theme.activate('css-only');
    this.resolver.resolve(structure);
    this.resolver.resolve(field);
    if (FIELD_RENDERER_BINDINGS.context !== 'context') throw new Error('Invalid public bindings');
  }
}
const defaults: ThemeArtifacts = Object.fromEntries(
  THEME_ARTIFACTS.map((artifact) => [artifact, artifact.startsWith('field.') ? FieldProbe : Consumer]),
) as ThemeArtifacts;
const themes: readonly ThemeDefinition[] = [
  { id: ThemeId.Default, cssClass: 'theme-default', overrides: defaults },
  { id: 'css-only', cssClass: 'theme-css-only', overrides: {} },
];
bootstrapApplication(Consumer, { providers: provideThemeRuntime(themes) }).catch((error: unknown) => { throw error; });
