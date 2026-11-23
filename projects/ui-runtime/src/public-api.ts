/** Technical bootstrap marker. No business or metadata API is defined yet. */
export const UI_RUNTIME_VERSION = '0.3.0-alpha.3';

export * from './theme/theme-definition.js';
export * from './theme/theme-runtime.js';
export * from './field-types/renderer-context.js';
export * from './structure/theme-ports.js';
export {
    ThemeShellOutlet,
    ThemeNavigationOutlet,
    ThemePanelOutlet,
} from './structure/theme-outlets.js';

export * from './structure/link-activation.js';

export type {
    ControlDomain,
    ControlRequest,
    ControlPresentation,
    OptionalControlDefinition,
    OptionalControlRenderer,
    ControlResolution,
} from './theme/optional-controls.js';

export type {
    PathSegment,
    ValuePath,
    ContextAction,
    FormActionReference,
    FormField,
    OptionalControlFormField,
    FormFieldDefinition,
    FormFieldContexts,
    FormDefinition,
    LayoutGroup,
    LayoutSection,
    LayoutTab,
    FormLayout,
    FormDiagnostic,
    FormFieldChange,
    FormViewState,
    FormPresentationContext,
    FormPresentation,
    ThemeComponents,
} from './form/form-definition.js';
export { composeForm, formPathKey } from './form/compose-form.js';
export type {
    ComposedGroup,
    ComposedSection,
    ComposedTab,
    FormComposition as FormCompositionResult,
} from './form/compose-form.js';
export { FormComposition } from './form/form-composition.js';
