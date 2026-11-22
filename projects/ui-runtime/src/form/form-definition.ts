/** SPDX-License-Identifier: Apache-2.0 */
import type { InputSignal, Type } from '@angular/core';
import type { FieldArtifact } from '../theme/theme-definition.js';
import type { FieldRendererContext, FieldValue } from '../field-types/renderer-context.js';

export type PathSegment = { readonly kind: 'property'; readonly name: string } | { readonly kind: 'row'; readonly key: string };
export type ValuePath = readonly PathSegment[];
export interface ContextAction { readonly id: string; readonly label: string; readonly enabled: boolean }
export interface FormActionReference { readonly id: string }
export interface FormField {
  readonly id: string;
  readonly path: ValuePath;
  readonly kind?: 'artifact';
  readonly artifact: FieldArtifact;
  readonly controlId?: never;
  readonly excluded?: boolean;
}
/** Optional-control fields retain the request exclusively in renderer context.control. */
export interface OptionalControlFormField {
  readonly id: string;
  readonly path: ValuePath;
  readonly kind: 'control';
  readonly controlId: string;
  readonly artifact?: never;
  readonly excluded?: boolean;
}
export type FormFieldDefinition = FormField | OptionalControlFormField;
export type FormFieldContexts = Readonly<Record<string, FieldRendererContext>>;
/** Effective field/action catalogue. Applications perform authorization before supplying it. */
export interface FormDefinition {
  readonly id: string;
  readonly label: string;
  readonly fields: readonly FormFieldDefinition[];
  readonly actions?: readonly ContextAction[];
}
export interface LayoutGroup { readonly id: string; readonly label?: string; readonly fields: readonly ValuePath[] }
export interface LayoutSection {
  readonly id: string; readonly label?: string;
  readonly collapsible: boolean; readonly initiallyCollapsed: boolean;
  readonly groups: readonly LayoutGroup[]; readonly actions: readonly FormActionReference[];
}
export interface LayoutTab {
  readonly id: string; readonly label?: string;
  readonly sections: readonly LayoutSection[]; readonly actions: readonly FormActionReference[];
}
export interface FormLayout { readonly tabs: readonly LayoutTab[]; readonly actions: readonly FormActionReference[] }
export interface FormDiagnostic {
  readonly code: 'unknown-field' | 'duplicate-field' | 'excluded-field' | 'unknown-action' | 'duplicate-action';
  readonly path?: ValuePath;
  readonly id?: string;
}
export interface FormFieldChange { readonly id: string; readonly path: ValuePath; readonly value: FieldValue }
/** Visual state only. This is not a document editing or dirty-state model. */
export interface FormViewState {
  readonly selectedTab?: string;
  readonly sections?: readonly { readonly tabId: string; readonly sectionId: string; readonly collapsed: boolean }[];
}
export interface FormPresentationContext { readonly id: string; readonly label: string }
/** Presentation wraps host-owned content; it never owns data, tabs or field views. */
export interface FormPresentation { readonly context: InputSignal<FormPresentationContext> }
export interface ThemeComponents { readonly form: Type<FormPresentation> }
