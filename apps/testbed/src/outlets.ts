/** Minimal QA hosts that bind the installed library contracts, not another runtime. */
import {
  Component, EmbeddedViewRef, TemplateRef, Type, ViewContainerRef, effect, inject, input,
  inputBinding, output, outputBinding, viewChild,
} from '@angular/core';
import {
  ThemeResolver, FIELD_RENDERER_BINDINGS,
  type StructureArtifact, type FieldArtifact, type FieldRenderer,
  type FieldRendererContext, type FieldValue,
} from '@alxarafe/ui-runtime';

@Component({ selector: 'qa-structure-outlet', template: '<ng-container #owned /><ng-container #target />' })
export class QaStructureOutlet {
  readonly artifact = input.required<StructureArtifact>();
  readonly content = input<TemplateRef<unknown>>();
  private readonly owned = viewChild('owned', { read: ViewContainerRef });
  private readonly target = viewChild('target', { read: ViewContainerRef });
  private readonly resolver = inject(ThemeResolver);
  private rendered?: Type<unknown>;
  constructor() {
    effect(() => {
      const owned = this.owned(), target = this.target();
      if (!owned || !target) return;
      const component = this.resolver.resolve(this.artifact());
      if (component === this.rendered) return;
      // The template is fixed per fixture host; owned views survive visual replacement.
      if (!owned.length && this.content()) owned.createEmbeddedView(this.content()!);
      const nodes = owned.length ? (owned.get(0) as EmbeddedViewRef<unknown>).rootNodes : [];
      target.clear();
      target.createComponent(component, { projectableNodes: [nodes] });
      this.rendered = component;
    });
  }
}
@Component({ selector: 'qa-field-outlet', template: '<ng-container #target />' })
export class QaFieldOutlet {
  readonly artifact = input.required<FieldArtifact>();
  readonly context = input.required<FieldRendererContext>();
  readonly valueChange = output<FieldValue>();
  private readonly target = viewChild('target', { read: ViewContainerRef });
  private readonly resolver = inject(ThemeResolver);
  private rendered?: Type<FieldRenderer>;
  constructor() {
    effect(() => {
      const target = this.target();
      if (!target) return;
      const component = this.resolver.resolve(this.artifact());
      if (component === this.rendered) return;
      target.clear();
      target.createComponent(component, { bindings: [
        inputBinding(FIELD_RENDERER_BINDINGS.context, this.context),
        outputBinding<FieldValue>(FIELD_RENDERER_BINDINGS.valueChange, value => this.valueChange.emit(value)),
      ] });
      this.rendered = component;
    });
  }
}
