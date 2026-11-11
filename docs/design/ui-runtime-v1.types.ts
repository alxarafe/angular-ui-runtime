/**
 * AUR-DESIGN-001: proposed contracts, compiled only by repository tests.
 * No runtime implementation or public package export. See ui-runtime-v1-api.md.
 */
import type { InputSignal, OutputEmitterRef, Type } from '@angular/core';
import type {
  FieldArtifact, FieldRenderer, FieldRendererContext, FieldValue, ThemeDefinition,
} from '../../projects/ui-runtime/src/public-api.js';

// Derive the catalogue from the existing artifact keys, not another registry.
export type SemanticType = FieldArtifact extends `field.${infer S}` ? S : never;
export type IntegerType = Extract<SemanticType, `${'INT' | 'UINT'}${number}`>;
export type ExactText = string; // Syntax and range require runtime validation.
export interface Bound {
  readonly value: ExactText;
  readonly exclusive?: boolean;
}
export interface RangeConstraints {
  readonly minimum?: Bound;
  readonly maximum?: Bound;
}
export interface NumericConstraints extends RangeConstraints {
  readonly multipleOf?: ExactText;
}
export interface DecimalConstraints extends NumericConstraints {
  readonly precision?: number;
  readonly scale?: number;
}
export type PatternConstraint =
  | { readonly dialect: 'portable-ascii-v1'; readonly source: string }
  | { readonly dialect: 'server'; readonly source: string };
export interface TextConstraints {
  readonly minimumLength?: number;
  readonly maximumLength?: number;
  readonly pattern?: PatternConstraint;
}
interface FieldBase {
  readonly id: string;
  readonly label: string;
  readonly required: boolean;
  readonly nullable: boolean;
  readonly readOnly?: boolean;
}
export type FieldDefinition = FieldBase & (
  | { readonly type: 'BOOLEAN'; readonly constraints?: never }
  | { readonly type: IntegerType; readonly constraints?: NumericConstraints }
  | { readonly type: 'DECIMAL'; readonly constraints?: DecimalConstraints;
      readonly allowExponent: boolean }
  | { readonly type: 'STRING' | 'TEXT'; readonly constraints?: TextConstraints }
  | { readonly type: 'ENUM'; readonly choices: readonly string[]; readonly constraints?: TextConstraints }
  | { readonly type: 'UUID'; readonly casing: 'lower' | 'either' }
  | { readonly type: 'DATE'; readonly format: 'gregorian-date'; readonly constraints?: RangeConstraints }
  | { readonly type: 'TIME'; readonly format: 'local-time'; readonly fractionalDigits: number; readonly constraints?: RangeConstraints }
  | { readonly type: 'DATETIME'; readonly format: 'offset-instant'; readonly fractionalDigits: number; readonly constraints?: RangeConstraints }
  | { readonly type: 'BINARY'; readonly format: 'base64' }
);
export interface IntrinsicIntegerRange {
  readonly minimum: ExactText;
  readonly maximum: ExactText;
}
// Proposed table shape only; the seven values remain normative in the contract.
export type IntrinsicIntegerRanges = Readonly<Record<IntegerType, IntrinsicIntegerRange>>;

export type ValueSlot =
  | { readonly kind: 'absent' }
  | { readonly kind: 'value'; readonly value: FieldValue };
export type EditingInput = ValueSlot | { readonly kind: 'raw'; readonly text: string };
export type PathSegment =
  | { readonly kind: 'property'; readonly name: string }
  | { readonly kind: 'row'; readonly key: string };
export type ValuePath = readonly PathSegment[];
export type LocalErrorCode =
  | 'required' | 'null-not-allowed' | 'type' | 'integer-syntax' | 'integer-range'
  | 'decimal-syntax' | 'minimum' | 'maximum' | 'multiple-of' | 'precision' | 'scale'
  | 'minimum-length' | 'maximum-length' | 'invalid-unicode' | 'format' | 'enum'
  | 'pattern' | 'input-limit' | 'definition';
export type ValidationIssue = {
  readonly path: ValuePath;
  readonly message: string;
} & (
  | { readonly source: 'local'; readonly code: LocalErrorCode }
  | { readonly source: 'application'; readonly code: `application:${string}` }
);
export interface DeferredCheck {
  readonly path: ValuePath;
  readonly reason: 'server-pattern';
}
export type ValidationResult =
  | { readonly state: 'valid' }
  | { readonly state: 'invalid'; readonly issues: readonly [ValidationIssue, ...ValidationIssue[]] }
  | { readonly state: 'pending'; readonly checks: readonly [DeferredCheck, ...DeferredCheck[]] };
export interface FieldEdit {
  readonly definition: FieldDefinition;
  readonly input: EditingInput;
  readonly touched: boolean;
  readonly validation: FieldValidation;
}
export interface FieldValidationRequest {
  readonly definition: FieldDefinition;
  readonly input: EditingInput;
  readonly path: ValuePath;
}
export type FieldValidation =
  | (Extract<ValidationResult, { state: 'valid' | 'pending' }> & { readonly parsed: ValueSlot })
  | Extract<ValidationResult, { state: 'invalid' }>;
// One future local validation function, not a second adapter validation engine.
export type ValidateField = (request: FieldValidationRequest) => FieldValidation;

// Additions remain optional: existing renderers still receive their old context.
export interface ProposedRendererContext extends FieldRendererContext {
  readonly definition?: FieldDefinition;
  readonly editing?: FieldEdit;
  readonly path?: ValuePath;
  readonly describedBy?: readonly string[];
}
// Optional capability; new outlets must inspect bindings before subscribing.
// A new outlet binds editChange OR valueChange, never both.
export interface EditingRenderer extends FieldRenderer {
  readonly context: InputSignal<ProposedRendererContext>;
  readonly editChange: OutputEmitterRef<EditingInput>;
}

// The same recursive shape represents accepted values and current field edits.
export type DocumentNode<T> =
  | { readonly kind: 'field'; readonly field: T }
  | DocumentObject<T>
  | EditableCollection<T>;
export interface DocumentObject<T> {
  readonly kind: 'object';
  readonly properties: Readonly<Record<string, DocumentNode<T>>>;
}
export interface CollectionRow<T> {
  readonly key: string; // UI identity, never an array index or assumed server ID.
  readonly value: DocumentObject<T>;
}
export interface EditableCollection<T> {
  readonly kind: 'collection';
  readonly ordered: boolean;
  readonly rows: readonly CollectionRow<T>[];
}
export interface DocumentSnapshot {
  readonly revision: number; // Local safe counter, not a server version.
  readonly original: DocumentObject<ValueSlot>;
  readonly current: DocumentObject<FieldEdit>;
  readonly dirty: boolean;
  readonly validation: ValidationResult; // Includes field, row and root issues.
  readonly save: SaveState;
}
export interface Submission {
  readonly attempt: string;
  readonly revision: number;
  readonly values: DocumentObject<ValueSlot>;
  readonly deferred: readonly DeferredCheck[];
}
export type SubmitResult =
  | { readonly kind: 'blocked'; readonly reason: 'invalid' | 'busy' | 'definition' }
  | { readonly kind: 'ready'; readonly submission: Submission };
export type SaveState =
  | { readonly state: 'idle' }
  | { readonly state: 'saving'; readonly submission: Submission }
  | { readonly state: 'error'; readonly message: string; readonly conflict: boolean }
  | { readonly state: 'reconcile-error'; readonly attempt: string; readonly message: string };
export type SaveResult =
  | { readonly kind: 'accepted'; readonly attempt: string;
      readonly accepted: DocumentObject<ValueSlot> }
  | { readonly kind: 'rejected'; readonly attempt: string; readonly message: string;
      readonly conflict: boolean; readonly issues: readonly ValidationIssue[] }
  | { readonly kind: 'unreconciled'; readonly attempt: string; readonly message: string };
export interface DiscardRequest {
  readonly reason: 'discard' | 'navigation' | 'application-action';
  readonly revision: number;
}
export type ConfirmDiscard = (request: DiscardRequest) => Promise<'discard' | 'cancel'>;
export type LeaveDecision = 'allow' | 'stay';
// Only a guard boundary: Angular Router and beforeunload adapters are separate.
export interface NavigationProtection {
  readonly requestLeave: (request: DiscardRequest) => Promise<LeaveDecision>;
}

export type MenuKind = 'primary' | 'secondary' | 'account';
export interface MenuItem {
  readonly id: string;
  readonly label: string;
  readonly enabled: boolean;
  readonly current?: boolean;
  readonly action?: string; // Application-owned opaque reference.
  readonly href?: string; // Native link semantics; application validates the target.
  readonly children?: readonly MenuItem[];
}
export interface MenuDefinition {
  readonly id: string;
  readonly label: string;
  readonly kind: MenuKind;
  readonly items: readonly MenuItem[];
}
export interface MenuSelection {
  readonly menuId: string;
  readonly itemId: string;
}
export interface MenuPlacement {
  readonly menuId: string;
  readonly regionId: string; // Visual region identity, never a menu kind.
}
export interface MenusContext {
  readonly menus: readonly MenuDefinition[];
  readonly placements: readonly MenuPlacement[];
}
export interface ContextAction {
  readonly id: string;
  readonly label: string;
  readonly enabled: boolean;
}
export interface LayoutGroup {
  readonly id: string;
  readonly label?: string;
  readonly fields: readonly ValuePath[];
}
export interface LayoutSection {
  readonly id: string;
  readonly label?: string;
  readonly collapsible: boolean;
  readonly initiallyCollapsed: boolean;
  readonly groups: readonly LayoutGroup[];
  readonly actions: readonly ContextAction[];
}
export interface LayoutTab {
  readonly id: string;
  readonly label?: string;
  readonly sections: readonly LayoutSection[];
  readonly actions: readonly ContextAction[];
}
export interface FormLayout {
  readonly tabs: readonly LayoutTab[];
  readonly actions: readonly ContextAction[];
}
export interface FormContext {
  readonly document: DocumentSnapshot;
  readonly layout?: FormLayout;
  readonly readOnly: boolean;
}
export interface GridColumn {
  readonly id: string;
  readonly label: string;
  readonly field: string; // Property in each row object, not a source/SQL path.
}
export interface ListGridContext {
  readonly columns: readonly GridColumn[];
  readonly rows: readonly CollectionRow<ValueSlot>[];
}
export interface DetailGridContext {
  readonly document: DocumentSnapshot;
  readonly collectionPath: ValuePath;
  readonly columns: readonly GridColumn[];
  readonly allowAdd: boolean;
  readonly allowRemove: boolean;
  readonly allowReorder: boolean;
  readonly readOnly: boolean;
}
export type DocumentChange =
  | { readonly kind: 'field'; readonly path: ValuePath; readonly input: EditingInput }
  | { readonly kind: 'add-row'; readonly path: ValuePath; readonly row: CollectionRow<FieldEdit> }
  | { readonly kind: 'remove-row'; readonly path: ValuePath; readonly key: string }
  | { readonly kind: 'move-row'; readonly path: ValuePath; readonly key: string;
      readonly before: string | null };
export interface MenusComponent {
  readonly context: InputSignal<MenusContext>;
  readonly selected: OutputEmitterRef<MenuSelection>;
}
export interface FormComponent {
  readonly context: InputSignal<FormContext>;
  readonly change: OutputEmitterRef<DocumentChange>;
  readonly actionSelected: OutputEmitterRef<string>;
}
export interface ListGridComponent {
  readonly context: InputSignal<ListGridContext>;
  readonly rowSelected: OutputEmitterRef<string>;
}
export interface DetailGridComponent {
  readonly context: InputSignal<DetailGridContext>;
  readonly change: OutputEmitterRef<DocumentChange>;
}
export interface ThemeComponents {
  readonly menus: Type<MenusComponent>;
  readonly form: Type<FormComponent>;
  readonly listGrid: Type<ListGridComponent>;
  readonly detailGrid: Type<DetailGridComponent>;
}
export interface ProposedThemeDefinition extends ThemeDefinition {
  readonly components?: Partial<ThemeComponents>;
}
// Proposed additional method on the SAME resolver, not another registry.
export interface ComponentResolution {
  readonly resolveComponent: <K extends keyof ThemeComponents>(key: K) => ThemeComponents[K];
}
