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
export { ListGrid, DetailGrid } from './grid/grid.js';
export type {
    GridColumn,
    GridRow,
    ListGridContext,
    DetailGridColumn,
    DetailGridRow,
    DetailGridContext,
    DetailGridChange,
    FormCollection,
    FormCollectionContexts,
} from './grid/grid-definition.js';

export { exactNumericEqual } from './state/exact-numeric.js';
export type { NumericSemantics } from './state/exact-numeric.js';
export { validateField } from './validation/validate-field.js';
export { validateDocument } from './validation/validate-document.js';
export type {
    ValidationFieldDefinition,
    FieldValidationPlan,
    ObjectValidationPlan,
    CollectionValidationPlan,
    ValidationPlanNode,
    DocumentValidationRequest,
    DocumentValidationState,
    DocumentFieldValidation,
    DocumentStructureDiagnosticCode,
    DocumentStructureDiagnostic,
    DocumentDiagnostic,
    DocumentValidationResult,
} from './validation/validate-document.js';
export type {
    IntegerBound,
    IntegerFieldDefinition,
    DecimalBound,
    DecimalFieldDefinition,
    TextConstraints,
    PatternConstraint,
    DeferredCheck,
    PatternDiagnostic,
    PatternDiagnosticCode,
    StringFieldDefinition,
    TextFieldDefinition,
    BooleanFieldDefinition,
    EnumFieldDefinition,
    BinaryFieldDefinition,
    UuidFieldDefinition,
    DateFieldDefinition,
    TimeFieldDefinition,
    DateTimeFieldDefinition,
    TemporalBound,
    TemporalConstraints,
    LocalValidationCode,
    DefinitionDiagnosticCode,
    ValidationIssue,
    DefinitionDiagnostic,
    FieldValidationResult,
    FieldValidationRequest,
} from './validation/validate-field.js';
export {
    createDocumentState,
    applyDocumentChange,
    resetDocumentState,
} from './state/document-state.js';
export type {
    ValueSlot,
    EditingInput,
    FieldEquality,
    DocumentField,
    DocumentObject,
    DocumentRow,
    DocumentCollection,
    DocumentNode,
    DocumentState,
    DocumentChange,
} from './state/document-state.js';

export { DocumentSession } from './state/document-session.js';
export type {
    DocumentSaveIssue,
    DocumentSubmission,
    DocumentSaveOutcome,
    DocumentSaveState,
    DocumentSubmitResult,
} from './state/document-session.js';
