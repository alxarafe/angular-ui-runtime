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
export type { DiscardRequest, ConfirmDiscard, DiscardResult } from './state/document-session.js';
export { NavigationProtection, protectBeforeUnload } from './state/navigation-protection.js';
export type { BeforeUnloadTarget } from './state/navigation-protection.js';
export { snapshotMenus, composeMenus } from './menu/menu-definition.js';
export type {
    MenuKind,
    MenuItem,
    MenuDefinition,
    MenuPlacement,
    MenuSelection,
    MenuLinkActivation,
    MenuLinkActivationHandler,
    MenuDiagnostic,
    ComposedMenu,
    MenuComposition,
} from './menu/menu-definition.js';
export {
    bindDocumentEditor,
    applyDocumentFieldIntent,
    applyDocumentCollectionIntent,
} from './editor/document-bindings.js';
export type {
    DocumentBindingOptions,
    DocumentEditorSnapshot,
    EditorFeedback,
} from './editor/document-bindings.js';
export type { FormFieldEdit } from './form/form-definition.js';
export type { DetailGridEdit } from './grid/grid-definition.js';
export { ChoiceSelector } from './selector/choice-selector.js';
export type { ChoiceSelectorContext } from './selector/choice-selector.js';
export type {
    ChoiceOption,
    ChoiceSelectorOptions,
    ChoicePageDirection,
} from './selector/choice-options.js';
export type { FormFieldPage } from './form/form-definition.js';
export type { DetailGridPage } from './grid/grid-definition.js';

export { FormSlot } from './form/form-slot.js';
export type { FormSlotContext } from './form/form-slot.js';
export type { FormSlotReference } from './form/form-definition.js';

export { FeedbackSummary } from './feedback/feedback-summary.js';
export type { FeedbackReveal } from './feedback/feedback-summary.js';

export type {
    ListSelectionChange,
    ListPaging,
    ListPageChange,
    ListQueryInput,
    ListQuery,
    ListQueryChange,
} from './grid/list-ports.js';
