/** AUR-DESIGN-001 compile-only assertions; not behavioral acceptance evidence. */
import type {
  FieldArtifact, FieldRendererContext, FieldRenderer, FieldValue,
  ThemeArtifacts, ThemeDefinition,
} from '../../projects/ui-runtime/src/public-api.js';
import type {
  SemanticType, IntegerType, FieldDefinition, ValueSlot, EditingInput,
  FieldValidation, ValidationIssue, DocumentObject, FieldEdit, SaveResult,
  ProposedRendererContext, EditingRenderer, ProposedThemeDefinition,
  ThemeComponents, MenuDefinition, ValuePath, IntrinsicIntegerRanges,
} from '../../docs/design/ui-runtime-v1.types.js';

type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false;
type Extends<A, B> = A extends B ? true : false;
type Catalogue = Assert<Equal<SemanticType,
  'BOOLEAN' | 'STRING' | 'TEXT' | 'INT8' | 'UINT8' | 'INT16' | 'UINT16' |
  'INT32' | 'UINT32' | 'INT64' | 'DECIMAL' | 'UUID' | 'DATE' | 'TIME' |
  'DATETIME' | 'ENUM' | 'BINARY'>>;
type ArtifactParity = Assert<Equal<`field.${SemanticType}`, FieldArtifact>>;
type RangeCompleteness = Assert<Equal<keyof IntrinsicIntegerRanges, IntegerType>>;
type ExactBoundary = Assert<Equal<FieldValue, string | boolean | null>>;
type ContextCompatibility = Assert<Extends<ProposedRendererContext, FieldRendererContext>>;
type OldContextStillAccepted = Assert<Extends<FieldRendererContext, ProposedRendererContext>>;
type OldThemeStillAccepted = Assert<Extends<ThemeDefinition, ProposedThemeDefinition>>;
type NewThemeStillAssignable = Assert<Extends<ProposedThemeDefinition, ThemeDefinition>>;
type RendererCompatibility = Assert<Extends<EditingRenderer, FieldRenderer>>;
type LegacyArtifactsUnchanged = Assert<Equal<keyof ThemeArtifacts,
  FieldArtifact | 'shell' | 'navigation' | 'panel'>>;
type NoCapabilityObligation = Assert<Equal<Required<ProposedThemeDefinition>['components'], Partial<ThemeComponents>>>;
type ValidHasParsedValue = Assert<Extends<Extract<FieldValidation, { state: 'valid' }>, { readonly parsed: ValueSlot }>>;
type NoParsedInvalid = Assert<Equal<'parsed' extends keyof Extract<FieldValidation, { state: 'invalid' }> ? true : false, false>>;

// These fixtures compile; they are deliberately not executed or imported by tests.
function assignments(): void {
  const originalContext: FieldRendererContext = { id: 'x', label: 'X', value: null };
  const compatible: ProposedRendererContext = originalContext;
  const exact: ValueSlot = { kind: 'value', value: '9223372036854775807' };
  const absent: ValueSlot = { kind: 'absent' };
  const explicitNull: ValueSlot = { kind: 'value', value: null };
  const intermediate: EditingInput = { kind: 'raw', text: '-' };
  const definition: FieldDefinition = {
    id: 'amount', label: 'Amount', type: 'DECIMAL', required: true, nullable: true,
    allowExponent: false, constraints: { minimum: { value: '0', exclusive: true }, multipleOf: '0.01', scale: 2 },
  };
  const field: FieldEdit = { definition, input: intermediate, touched: true, validation: { state: 'invalid', issues: [{ path: [], code: 'decimal-syntax', message: 'Enter a decimal', source: 'local' }] } };
  const flat: DocumentObject<ValueSlot> = {
    kind: 'object', properties: { amount: { kind: 'field', field: exact } },
  };
  const nested: DocumentObject<FieldEdit> = {
    kind: 'object', properties: {
      header: { kind: 'object', properties: { amount: { kind: 'field', field } } },
      lines: { kind: 'collection', ordered: true, rows: [
        { key: 'temporary-a', value: { kind: 'object', properties: { amount: { kind: 'field', field } } } },
      ] },
    },
  };
  const path: ValuePath = [{ kind: 'property', name: 'lines' }, { kind: 'row', key: 'temporary-a' }, { kind: 'property', name: 'amount' }];
  const rootError: ValidationIssue = { path: [], code: 'application:conflict', message: 'Reload required', source: 'application' };
  const menus: readonly MenuDefinition[] = [
    { id: 'work', kind: 'primary', label: 'Work', items: [] },
    { id: 'tools', kind: 'primary', label: 'Tools', items: [] },
  ];
  // @ts-expect-error Values must never use Number for exact data.
  const lossy: ValueSlot = { kind: 'value', value: 9223372036854775807 };
  // @ts-expect-error A DATE object is not an editing input.
  const date: EditingInput = { kind: 'value', value: new Date() };
  // @ts-expect-error Absence is explicit, not implicit undefined.
  const missing: ValueSlot = undefined;
  // @ts-expect-error A boolean definition cannot declare numeric constraints.
  const booleanRange: FieldDefinition = { id: 'flag', label: 'Flag', type: 'BOOLEAN', required: false, nullable: false, constraints: { multipleOf: '2' } };
  // @ts-expect-error ENUM must have declared choices.
  const enumeration: FieldDefinition = { id: 'status', label: 'Status', type: 'ENUM', required: true, nullable: false };
  // @ts-expect-error Numeric boundaries must be exact text.
  const numericRange: FieldDefinition = { id: 'n', label: 'N', type: 'INT64', required: true, nullable: false, constraints: { minimum: { value: 0 } } };
  // @ts-expect-error Successful parsing requires a value/presence result.
  const unparsed: FieldValidation = { state: 'valid' };
  // @ts-expect-error Invalid validation needs at least one issue.
  const emptyError: FieldValidation = { state: 'invalid', issues: [] };
  // @ts-expect-error Application errors cannot masquerade as local validation codes.
  const wrongSource: ValidationIssue = { path: [], source: 'application', code: 'required', message: 'Missing' };
  // @ts-expect-error Array indexes cannot identify rows in error paths.
  const unstablePath: ValuePath = [{ kind: 'row', index: 0 }];
  // @ts-expect-error A save success needs accepted values, not just a transport ID.
  const incompleteSave: SaveResult = { kind: 'accepted', attempt: 'one', id: '42' };
  // @ts-expect-error Menus retain semantic kind, not visual placement.
  const misplaced: MenuDefinition = { id: 'm', label: 'M', kind: 'sidebar', items: [] };
  // @ts-expect-error Snapshots cannot be edited in place.
  flat.properties['amount'] = { kind: 'field', field: explicitNull };
  // @ts-expect-error A pending result is not a confirmed valid result.
  const pendingIsValid: Extract<FieldValidation, { state: 'valid' }> = { state: 'pending', parsed: absent, checks: [{ path, reason: 'server-pattern' }] };
  void [compatible, exact, absent, explicitNull, intermediate, nested, rootError, menus,
    lossy, date, missing, booleanRange, enumeration, numericRange, unparsed,
    emptyError, wrongSource, unstablePath, incompleteSave, misplaced, pendingIsValid];
}
void assignments;
