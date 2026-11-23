/** SPDX-License-Identifier: Apache-2.0 */
import type { PathSegment, ValuePath } from '../form/form-definition.js';
import type { EditingInput, ValueSlot } from '../state/document-state.js';
import { scalarLength, canonicalBase64 } from './scalar-values.js';
import { canonicalUuid, parseTemporal, temporalDomain } from './temporal-values.js';
import { compilePortable, matchPortable, type PatternDeferReason } from './portable-pattern.js';
import {
    integerMatch,
    numericTextLimit,
    parseNumeric,
    compareNumeric,
    numericMultipleOf,
    numericDimensions,
    type ExactNumeric,
} from '../state/numeric-syntax.js';

export interface IntegerBound {
    readonly value: string;
    readonly exclusive?: boolean;
}
export interface IntegerFieldDefinition {
    readonly type: 'INTEGER';
    readonly required: boolean;
    readonly nullable: boolean;
    readonly capacity?: { readonly bits: 8 | 16 | 32 | 64; readonly signed: boolean };
    readonly constraints?: {
        readonly minimum?: IntegerBound;
        readonly maximum?: IntegerBound;
        readonly multipleOf?: string;
    };
}
export type DecimalBound = IntegerBound;
export interface DecimalFieldDefinition {
    readonly type: 'DECIMAL';
    readonly required: boolean;
    readonly nullable: boolean;
    readonly allowExponent: boolean;
    readonly constraints?: {
        readonly minimum?: DecimalBound;
        readonly maximum?: DecimalBound;
        readonly multipleOf?: string;
        readonly precision?: number;
        readonly scale?: number;
    };
}
export type PatternConstraint =
    | { readonly dialect: 'portable-ascii-v1'; readonly source: string }
    | { readonly dialect: 'server'; readonly source: string };
export interface TextConstraints {
    readonly minimumLength?: number;
    readonly maximumLength?: number;
    readonly pattern?: PatternConstraint;
}
interface ScalarDefinition {
    readonly required: boolean;
    readonly nullable: boolean;
}
export interface StringFieldDefinition extends ScalarDefinition {
    readonly type: 'STRING';
    readonly constraints?: TextConstraints;
}
export interface TextFieldDefinition extends ScalarDefinition {
    readonly type: 'TEXT';
    readonly constraints?: TextConstraints;
}
export interface BooleanFieldDefinition extends ScalarDefinition {
    readonly type: 'BOOLEAN';
}
export interface EnumFieldDefinition extends ScalarDefinition {
    readonly type: 'ENUM';
    readonly choices: readonly string[];
    readonly constraints?: TextConstraints;
}
export interface BinaryFieldDefinition extends ScalarDefinition {
    readonly type: 'BINARY';
    readonly format: 'base64';
}
export interface UuidFieldDefinition extends ScalarDefinition {
    readonly type: 'UUID';
    readonly casing: 'lower' | 'either';
}
export type TemporalBound = IntegerBound;
export interface TemporalConstraints {
    readonly minimum?: TemporalBound;
    readonly maximum?: TemporalBound;
}
export interface DateFieldDefinition extends ScalarDefinition {
    readonly type: 'DATE';
    readonly format: 'gregorian-date';
    readonly constraints?: TemporalConstraints;
}
export interface TimeFieldDefinition extends ScalarDefinition {
    readonly type: 'TIME';
    readonly format: 'local-time';
    /** Maximum accepted input fraction digits, not an output-normalization request. */
    readonly fractionalDigits: number;
    readonly constraints?: TemporalConstraints;
}
export interface DateTimeFieldDefinition extends ScalarDefinition {
    readonly type: 'DATETIME';
    readonly format: 'offset-instant';
    /** Maximum accepted input fraction digits, from zero through seven. */
    readonly fractionalDigits: number;
    readonly constraints?: TemporalConstraints;
}
type TemporalFieldDefinition = DateFieldDefinition | TimeFieldDefinition | DateTimeFieldDefinition;
type ScalarFieldDefinition =
    | StringFieldDefinition
    | TextFieldDefinition
    | BooleanFieldDefinition
    | EnumFieldDefinition
    | BinaryFieldDefinition;
export type LocalValidationCode =
    | 'required'
    | 'null-not-allowed'
    | 'type'
    | 'integer-syntax'
    | 'integer-range'
    | 'decimal-syntax'
    | 'precision'
    | 'scale'
    | 'work-limit'
    | 'minimum'
    | 'maximum'
    | 'multiple-of'
    | 'input-limit'
    | 'minimum-length'
    | 'maximum-length'
    | 'invalid-unicode'
    | 'enum'
    | 'binary-format'
    | 'uuid-format'
    | 'date-format'
    | 'time-format'
    | 'datetime-format'
    | 'pattern';
export type DefinitionDiagnosticCode =
    | 'definition'
    | 'capacity'
    | 'constraint'
    | 'constraint-limit'
    | 'multiple-of-definition'
    | 'contradictory-bounds';
export interface ValidationIssue {
    readonly source: 'local';
    readonly code: LocalValidationCode;
    readonly path: ValuePath;
    readonly message: string;
}
export interface DefinitionDiagnostic {
    readonly source: 'definition';
    readonly code: DefinitionDiagnosticCode;
    readonly path: ValuePath;
    readonly message: string;
}
export interface DeferredCheck {
    readonly reason: 'server-pattern';
    readonly path: ValuePath;
}
export type PatternDiagnosticCode =
    | 'pattern-server-only'
    | 'pattern-unsupported'
    | 'pattern-source-limit'
    | 'pattern-prefix-limit'
    | 'pattern-repetition-limit'
    | 'pattern-input-limit';
/** Nonfatal execution information, distinct from invalid field metadata. */
export interface PatternDiagnostic {
    readonly source: 'pattern';
    readonly code: PatternDiagnosticCode;
    readonly path: ValuePath;
    readonly message: string;
}
interface DeferredEvidence {
    readonly checks?: readonly [DeferredCheck, ...DeferredCheck[]];
    readonly diagnostics?: readonly [PatternDiagnostic, ...PatternDiagnostic[]];
}
export type FieldValidationResult =
    | { readonly state: 'valid'; readonly parsed: ValueSlot }
    | ({
          readonly state: 'invalid';
          readonly issues: readonly [ValidationIssue, ...ValidationIssue[]];
      } & DeferredEvidence)
    | {
          readonly state: 'pending';
          readonly parsed: ValueSlot;
          readonly checks: readonly [DeferredCheck, ...DeferredCheck[]];
          readonly diagnostics?: readonly [PatternDiagnostic, ...PatternDiagnostic[]];
      }
    | {
          readonly state: 'definition-error';
          readonly diagnostics: readonly [DefinitionDiagnostic, ...DefinitionDiagnostic[]];
      };
export interface FieldValidationRequest {
    readonly definition:
        | IntegerFieldDefinition
        | DecimalFieldDefinition
        | ScalarFieldDefinition
        | UuidFieldDefinition
        | TemporalFieldDefinition;
    readonly input: EditingInput;
    readonly path: ValuePath;
}

function shape(
    value: unknown,
    required: string[],
    optional: string[] = [],
): value is Record<string, unknown> {
    return (
        !!value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        [Object.prototype, null].includes(Object.getPrototypeOf(value)) &&
        required.every((key) => Object.hasOwn(value, key)) &&
        Reflect.ownKeys(value).every(
            (key) => typeof key === 'string' && [...required, ...optional].includes(key),
        )
    );
}
function snapshotPath(path: ValuePath): ValuePath {
    if (!Array.isArray(path) || !path.length || path.length > 128)
        throw new Error('Invalid validation path');
    return Object.freeze(
        Array.from(path, (part: PathSegment) => {
            if (!shape(part, ['kind', part?.kind === 'property' ? 'name' : 'key']))
                throw new Error('Invalid validation path');
            const id = part.kind === 'property' ? part.name : part.key;
            if (!['property', 'row'].includes(part.kind) || typeof id !== 'string' || !id.trim())
                throw new Error('Invalid validation path');
            return Object.freeze({ ...part });
        }),
    );
}
class DefinitionError extends Error {
    constructor(
        readonly code: DefinitionDiagnosticCode,
        message: string,
    ) {
        super(message);
    }
}
function definitionError(code: DefinitionDiagnosticCode, message: string): never {
    throw new DefinitionError(code, message);
}
function constraintInteger(value: unknown): bigint {
    if (typeof value === 'string' && value.length > numericTextLimit)
        definitionError('constraint-limit', 'Integer constraint exceeds 4096 characters.');
    if (typeof value !== 'string' || !integerMatch(value))
        definitionError('constraint', 'Integer constraints require signed base-ten integer text.');
    return BigInt(value);
}
function resolveInteger(definition: IntegerFieldDefinition) {
    if (
        !shape(definition, ['type', 'required', 'nullable'], ['capacity', 'constraints']) ||
        definition.type !== 'INTEGER' ||
        typeof definition.required !== 'boolean' ||
        typeof definition.nullable !== 'boolean'
    )
        definitionError(
            'definition',
            'A supported INTEGER definition with explicit presence and nullability is required.',
        );
    let intrinsicMin: bigint | undefined, intrinsicMax: bigint | undefined;
    if (definition.capacity !== undefined) {
        const c = definition.capacity;
        if (
            !shape(c, ['bits', 'signed']) ||
            ![8, 16, 32, 64].includes(c.bits) ||
            typeof c.signed !== 'boolean'
        )
            definitionError(
                'capacity',
                'Capacity requires both bits (8, 16, 32 or 64) and signed.',
            );
        const power = 1n << BigInt(c.signed ? c.bits - 1 : c.bits);
        intrinsicMin = c.signed ? -power : 0n;
        intrinsicMax = power - 1n;
    }
    const constraints = definition.constraints;
    if (constraints !== undefined && !shape(constraints, [], ['minimum', 'maximum', 'multipleOf']))
        definitionError('constraint', 'Unsupported INTEGER constraints.');
    function bound(value: IntegerBound | undefined): bigint | undefined {
        if (value === undefined) return undefined;
        if (
            !shape(value, ['value'], ['exclusive']) ||
            (value.exclusive !== undefined && typeof value.exclusive !== 'boolean')
        )
            definitionError(
                'constraint',
                'A bound requires exact value text and an optional exclusive boolean.',
            );
        return constraintInteger(value.value);
    }
    const minimum = bound(constraints?.minimum),
        maximum = bound(constraints?.maximum);
    const min =
        minimum === undefined ? undefined : minimum + (constraints?.minimum?.exclusive ? 1n : 0n);
    const max =
        maximum === undefined ? undefined : maximum - (constraints?.maximum?.exclusive ? 1n : 0n);
    let low = intrinsicMin,
        high = intrinsicMax;
    if (min !== undefined && (low === undefined || min > low)) low = min;
    if (max !== undefined && (high === undefined || max < high)) high = max;
    if (low !== undefined && high !== undefined && low > high)
        definitionError('contradictory-bounds', 'The effective INTEGER interval is empty.');
    let divisor: bigint | undefined;
    if (constraints?.multipleOf !== undefined) {
        divisor = constraintInteger(constraints.multipleOf);
        if (divisor <= 0n)
            definitionError('multiple-of-definition', 'multipleOf must be a positive integer.');
        // Detect an empty discrete domain without iterating or expanding powers.
        if (low !== undefined && high !== undefined) {
            const remainder = low % divisor;
            const first =
                low + (remainder === 0n ? 0n : remainder < 0n ? -remainder : divisor - remainder);
            if (first > high)
                definitionError(
                    'contradictory-bounds',
                    'The effective interval contains no multipleOf value.',
                );
        }
    }
    return {
        family: 'numeric' as const,
        type: 'INTEGER' as const,
        intrinsicMin,
        intrinsicMax,
        min,
        max,
        divisor,
    };
}

function resolveDecimal(definition: DecimalFieldDefinition) {
    if (
        !shape(definition, ['type', 'required', 'nullable', 'allowExponent'], ['constraints']) ||
        definition.type !== 'DECIMAL' ||
        typeof definition.required !== 'boolean' ||
        typeof definition.nullable !== 'boolean' ||
        typeof definition.allowExponent !== 'boolean'
    )
        definitionError(
            'definition',
            'A DECIMAL definition requires explicit presence, nullability and exponent policy.',
        );
    const constraints = definition.constraints;
    if (
        constraints !== undefined &&
        !shape(constraints, [], ['minimum', 'maximum', 'multipleOf', 'precision', 'scale'])
    )
        definitionError('constraint', 'Unsupported DECIMAL constraints.');
    function decimal(value: unknown): ExactNumeric {
        if (typeof value !== 'string')
            definitionError('constraint', 'DECIMAL constraints require exact text.');
        const parsed = parseNumeric(value, definition);
        if (!parsed.ok)
            definitionError(
                parsed.reason === 'limit' ? 'constraint-limit' : 'constraint',
                'DECIMAL constraint syntax or numeric work limit is unsupported.',
            );
        return parsed.value;
    }
    function bound(value: DecimalBound | undefined) {
        if (value === undefined) return undefined;
        if (
            !shape(value, ['value'], ['exclusive']) ||
            (value.exclusive !== undefined && typeof value.exclusive !== 'boolean')
        )
            definitionError(
                'constraint',
                'A bound requires exact value text and an optional exclusive boolean.',
            );
        return { value: decimal(value.value), exclusive: value.exclusive === true };
    }
    function counter(value: number | undefined, name: string): bigint | undefined {
        if (value === undefined) return undefined;
        if (!Number.isSafeInteger(value) || value < 0)
            definitionError('constraint', `${name} must be a nonnegative safe integer counter.`);
        if (value > numericTextLimit)
            definitionError(
                'constraint-limit',
                `${name} exceeds the supported counter limit of 4096.`,
            );
        return BigInt(value);
    }
    const minimum = bound(constraints?.minimum),
        maximum = bound(constraints?.maximum);
    if (minimum && maximum) {
        const order = compareNumeric(minimum.value, maximum.value);
        if (order > 0 || (order === 0 && (minimum.exclusive || maximum.exclusive)))
            definitionError('contradictory-bounds', 'The effective DECIMAL interval is empty.');
    }
    const divisor =
        constraints?.multipleOf === undefined ? undefined : decimal(constraints.multipleOf);
    if (divisor && divisor.sign !== 1)
        definitionError('multiple-of-definition', 'multipleOf must be a positive decimal.');
    return {
        type: 'DECIMAL' as const,
        family: 'numeric' as const,
        allowExponent: definition.allowExponent,
        minimum,
        maximum,
        divisor,
        precision: counter(constraints?.precision, 'precision'),
        scale: counter(constraints?.scale, 'scale'),
    };
}
function resolvePattern(value: unknown) {
    if (value === undefined) return undefined;
    if (
        !shape(value, ['dialect', 'source']) ||
        typeof value['source'] !== 'string' ||
        (value['dialect'] !== 'portable-ascii-v1' && value['dialect'] !== 'server')
    )
        definitionError(
            'constraint',
            'Pattern metadata requires a supported dialect and exact source text.',
        );
    if (value['dialect'] === 'server')
        return { state: 'deferred' as const, reason: 'server-only' as const };
    const compilation = compilePortable(value['source']);
    if (compilation.state === 'malformed')
        definitionError('constraint', 'Malformed portable-ascii-v1 pattern declaration.');
    return compilation;
}
function resolveScalar(definition: ScalarFieldDefinition) {
    const type = definition.type;
    const required = [
        'type',
        'required',
        'nullable',
        ...(type === 'ENUM' ? ['choices'] : type === 'BINARY' ? ['format'] : []),
    ];
    const textual = type === 'STRING' || type === 'TEXT' || type === 'ENUM';
    if (
        !shape(definition, required, textual ? ['constraints'] : []) ||
        typeof definition.required !== 'boolean' ||
        typeof definition.nullable !== 'boolean'
    )
        definitionError(
            'definition',
            'A supported scalar definition with explicit presence and nullability is required.',
        );
    if (type === 'BINARY' && definition.format !== 'base64')
        definitionError('definition', 'BINARY requires the explicit base64 profile.');
    const constraints = 'constraints' in definition ? definition.constraints : undefined;
    if (
        constraints !== undefined &&
        !shape(constraints, [], ['minimumLength', 'maximumLength', 'pattern'])
    )
        definitionError('constraint', 'Unsupported text constraints.');
    function counter(value: unknown): number | undefined {
        if (value === undefined) return undefined;
        if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
            definitionError(
                'constraint',
                'Text lengths must be nonnegative safe integer counters.',
            );
        return value;
    }
    const minimumLength = counter(constraints?.['minimumLength']),
        maximumLength = counter(constraints?.['maximumLength']);
    if (minimumLength !== undefined && maximumLength !== undefined && minimumLength > maximumLength)
        definitionError('constraint', 'The minimum text length exceeds the maximum.');
    let choices: Set<string> | undefined;
    if (type === 'ENUM') {
        if (!Array.isArray(definition.choices) || !definition.choices.length)
            definitionError('definition', 'ENUM requires a nonempty ordered string catalogue.');
        choices = new Set<string>();
        for (const choice of definition.choices) {
            if (
                typeof choice !== 'string' ||
                scalarLength(choice) === undefined ||
                choices.has(choice)
            )
                definitionError(
                    'definition',
                    'ENUM choices must be unique well-formed Unicode strings.',
                );
            choices.add(choice);
        }
    }
    const pattern = resolvePattern(constraints?.['pattern']);
    return { family: 'scalar' as const, type, minimumLength, maximumLength, choices, pattern };
}
function resolveUuid(definition: UuidFieldDefinition) {
    if (
        !shape(definition, ['type', 'required', 'nullable', 'casing']) ||
        typeof definition.required !== 'boolean' ||
        typeof definition.nullable !== 'boolean' ||
        (definition.casing !== 'lower' && definition.casing !== 'either')
    )
        definitionError(
            'definition',
            'UUID requires explicit presence, nullability and lower/either casing.',
        );
    return { family: 'uuid' as const, type: 'UUID' as const, casing: definition.casing };
}
function resolveTemporal(definition: TemporalFieldDefinition) {
    const type = definition.type;
    if (
        !shape(
            definition,
            [
                'type',
                'required',
                'nullable',
                'format',
                ...(type === 'DATE' ? [] : ['fractionalDigits']),
            ],
            ['constraints'],
        ) ||
        typeof definition.required !== 'boolean' ||
        typeof definition.nullable !== 'boolean'
    )
        definitionError(
            'definition',
            'A temporal definition requires explicit presence, nullability and supported profile members.',
        );
    const expected =
        type === 'DATE' ? 'gregorian-date' : type === 'TIME' ? 'local-time' : 'offset-instant';
    if (definition.format !== expected)
        definitionError('definition', 'Unsupported temporal profile.');
    const fractionalDigits = type === 'DATE' ? 0 : definition.fractionalDigits;
    if (!Number.isSafeInteger(fractionalDigits) || fractionalDigits < 0)
        definitionError('definition', 'fractionalDigits must be a nonnegative safe integer.');
    if (fractionalDigits > 7)
        definitionError(
            'constraint-limit',
            'fractionalDigits supports at most seven input digits.',
        );
    const constraints = definition.constraints;
    if (constraints !== undefined && !shape(constraints, [], ['minimum', 'maximum']))
        definitionError('constraint', 'Unsupported temporal constraints.');
    function bound(value: unknown) {
        if (value === undefined) return undefined;
        if (
            !shape(value, ['value'], ['exclusive']) ||
            typeof value['value'] !== 'string' ||
            (value['exclusive'] !== undefined && typeof value['exclusive'] !== 'boolean')
        )
            definitionError(
                'constraint',
                'A temporal bound requires exact text and an optional exclusive boolean.',
            );
        const parsed = parseTemporal(value['value'], type, fractionalDigits);
        if (parsed === undefined)
            definitionError('constraint', 'Temporal bound is invalid under the declared profile.');
        return { value: parsed, exclusive: value['exclusive'] === true };
    }
    const minimum = bound(constraints?.['minimum']),
        maximum = bound(constraints?.['maximum']);
    const domain = temporalDomain(type, fractionalDigits);
    const low = minimum ? minimum.value + (minimum.exclusive ? domain.step : 0n) : domain.minimum;
    const high = maximum ? maximum.value - (maximum.exclusive ? domain.step : 0n) : domain.maximum;
    if (low > high)
        definitionError(
            'contradictory-bounds',
            'The temporal interval has no value at the declared precision.',
        );
    const code =
        type === 'DATE'
            ? ('date-format' as const)
            : type === 'TIME'
              ? ('time-format' as const)
              : ('datetime-format' as const);
    return { family: 'temporal' as const, type, fractionalDigits, minimum, maximum, code };
}
function resolve(definition: FieldValidationRequest['definition']) {
    switch (definition?.type) {
        case 'DECIMAL':
            return resolveDecimal(definition);
        case 'UUID':
            return resolveUuid(definition);
        case 'DATE':
        case 'TIME':
        case 'DATETIME':
            return resolveTemporal(definition);
        case 'STRING':
        case 'TEXT':
        case 'BOOLEAN':
        case 'ENUM':
        case 'BINARY':
            return resolveScalar(definition);
        default:
            return resolveInteger(definition as IntegerFieldDefinition);
    }
}

/** Pure local validation for the implemented semantic types. Never modifies editing state. */
export function validateField(request: FieldValidationRequest): FieldValidationResult {
    const path = snapshotPath(request.path);
    let resolved: ReturnType<typeof resolve>;
    try {
        resolved = resolve(request.definition);
    } catch (error) {
        if (!(error instanceof DefinitionError)) throw error;
        const diagnostic = Object.freeze({
            source: 'definition' as const,
            code: error.code,
            path,
            message: error.message,
        });
        return Object.freeze({
            state: 'definition-error',
            diagnostics: Object.freeze([diagnostic] as const),
        });
    }
    const issues: ValidationIssue[] = [];
    let checks: readonly [DeferredCheck, ...DeferredCheck[]] | undefined;
    let patternDiagnostics: readonly [PatternDiagnostic, ...PatternDiagnostic[]] | undefined;
    const defer = (reason: PatternDeferReason | 'server-only' | 'input-limit') => {
        const codes = {
            'server-only': 'pattern-server-only',
            unsupported: 'pattern-unsupported',
            'source-limit': 'pattern-source-limit',
            'prefix-limit': 'pattern-prefix-limit',
            'repetition-limit': 'pattern-repetition-limit',
            'input-limit': 'pattern-input-limit',
        } as const;
        checks = Object.freeze([
            Object.freeze({ reason: 'server-pattern' as const, path }),
        ] as const);
        const message =
            reason === 'server-only'
                ? 'This pattern requires server confirmation.'
                : reason === 'input-limit'
                  ? 'Local pattern input exceeds 4096 Unicode scalars; server confirmation is required.'
                  : 'Local pattern execution is unavailable under the supported syntax or work profile; server confirmation is required.';
        patternDiagnostics = Object.freeze([
            Object.freeze({ source: 'pattern' as const, code: codes[reason], path, message }),
        ] as const);
    };
    const issue = (code: LocalValidationCode, message: string) =>
        issues.push(Object.freeze({ source: 'local', code, path, message }));
    const invalid = (): FieldValidationResult =>
        Object.freeze({
            state: 'invalid',
            issues: Object.freeze(issues) as readonly [ValidationIssue, ...ValidationIssue[]],
            ...(checks ? { checks, diagnostics: patternDiagnostics } : {}),
        });
    const valid = (parsed: ValueSlot): FieldValidationResult =>
        checks
            ? Object.freeze({
                  state: 'pending',
                  parsed: Object.freeze(parsed),
                  checks,
                  diagnostics: patternDiagnostics,
              })
            : Object.freeze({ state: 'valid', parsed: Object.freeze(parsed) });
    const input = request.input;
    if (shape(input, ['kind']) && input.kind === 'absent') {
        if (!request.definition.required) return valid({ kind: 'absent' });
        issue('required', 'The property must be present.');
        return invalid();
    }
    if (shape(input, ['kind', 'value']) && input.kind === 'value' && input.value === null) {
        if (request.definition.nullable) return valid({ kind: 'value', value: null });
        issue('null-not-allowed', 'Explicit null is not allowed.');
        return invalid();
    }
    if (resolved.type === 'BOOLEAN') {
        if (
            shape(input, ['kind', 'value']) &&
            input.kind === 'value' &&
            typeof input.value === 'boolean'
        )
            return valid({ kind: 'value', value: input.value });
        issue('type', 'BOOLEAN requires a boolean value slot.');
        return invalid();
    }
    const text =
        shape(input, ['kind', 'text']) && input.kind === 'raw'
            ? input.text
            : shape(input, ['kind', 'value']) && input.kind === 'value'
              ? input.value
              : undefined;
    if (typeof text !== 'string') {
        issue('type', `${resolved.type} requires exact text.`);
        return invalid();
    }
    if (resolved.family === 'uuid') {
        if (!canonicalUuid(text, resolved.casing))
            issue('uuid-format', 'Use a canonical hyphenated UUID with the declared casing.');
        return issues.length ? invalid() : valid({ kind: 'value', value: text });
    }
    if (resolved.family === 'temporal') {
        const value = parseTemporal(text, resolved.type, resolved.fractionalDigits);
        if (value === undefined) {
            issue(
                resolved.code,
                'Use a valid calendar/time value within the declared temporal profile.',
            );
            return invalid();
        }
        if (
            resolved.minimum &&
            (value < resolved.minimum.value ||
                (value === resolved.minimum.value && resolved.minimum.exclusive))
        )
            issue('minimum', 'Temporal value is below the minimum or equals an exclusive minimum.');
        if (
            resolved.maximum &&
            (value > resolved.maximum.value ||
                (value === resolved.maximum.value && resolved.maximum.exclusive))
        )
            issue('maximum', 'Temporal value is above the maximum or equals an exclusive maximum.');
        return issues.length ? invalid() : valid({ kind: 'value', value: text });
    }
    if (resolved.family === 'scalar') {
        if (resolved.type === 'BINARY') {
            if (!canonicalBase64(text))
                issue(
                    'binary-format',
                    'Use canonical standard Base64 with correct padding and no whitespace.',
                );
        } else {
            if (resolved.pattern?.state === 'deferred') defer(resolved.pattern.reason);
            const length = scalarLength(text);
            if (length === undefined) {
                issue('invalid-unicode', 'Text contains an isolated Unicode surrogate.');
                return invalid();
            }
            if (resolved.minimumLength !== undefined && length < resolved.minimumLength)
                issue('minimum-length', 'Text is shorter than the declared minimum length.');
            if (resolved.maximumLength !== undefined && length > resolved.maximumLength)
                issue('maximum-length', 'Text is longer than the declared maximum length.');
            if (resolved.type === 'ENUM' && !resolved.choices!.has(text))
                issue('enum', 'Select a declared choice.');
            if (resolved.pattern?.state === 'compiled') {
                if (length > 4096) defer('input-limit');
                else if (matchPortable(resolved.pattern.program, text) !== 'matched')
                    issue('pattern', 'Text does not match the required whole-input pattern.');
            }
        }
        return issues.length ? invalid() : valid({ kind: 'value', value: text });
    }
    if (text.length > numericTextLimit) {
        issue(
            'input-limit',
            resolved.type === 'INTEGER'
                ? 'Integer input exceeds 4096 characters.'
                : 'Decimal input exceeds 4096 characters.',
        );
        return invalid();
    }
    if (resolved.type === 'DECIMAL') {
        const parsed = parseNumeric(text, resolved);
        if (!parsed.ok) {
            issue(
                parsed.reason === 'limit' ? 'input-limit' : 'decimal-syntax',
                parsed.reason === 'limit'
                    ? 'Decimal exponent exceeds the supported work limit.'
                    : 'Use decimal text with integer digits and complete fractional/exponent parts under the declared exponent policy.',
            );
            return invalid();
        }
        const value = parsed.value;
        const { minimum, maximum, divisor, precision, scale } = resolved;
        if (minimum) {
            const order = compareNumeric(value, minimum.value);
            if (order < 0 || (order === 0 && minimum.exclusive))
                issue('minimum', 'Decimal is below the minimum or equals an exclusive minimum.');
        }
        if (maximum) {
            const order = compareNumeric(value, maximum.value);
            if (order > 0 || (order === 0 && maximum.exclusive))
                issue('maximum', 'Decimal is above the maximum or equals an exclusive maximum.');
        }
        const dimensions = numericDimensions(value);
        if (precision !== undefined && dimensions.precision > precision)
            issue('precision', 'Decimal exceeds the declared normalized precision.');
        if (scale !== undefined && dimensions.scale > scale)
            issue('scale', 'Decimal exceeds the declared normalized scale.');
        if (divisor) {
            const multiple = numericMultipleOf(value, divisor);
            if (multiple === undefined)
                issue(
                    'work-limit',
                    'Decimal divisibility exceeds the supported arithmetic work limit.',
                );
            else if (!multiple)
                issue('multiple-of', 'Decimal must be an exact multiple of the declared divisor.');
        }
        return issues.length ? invalid() : valid({ kind: 'value', value: text });
    }
    if (!integerMatch(text)) {
        issue(
            'integer-syntax',
            'Use signed base-ten integer text without whitespace, fractions or exponents.',
        );
        return invalid();
    }
    const value = BigInt(text);
    const { intrinsicMin, intrinsicMax, min, max, divisor } = resolved;
    if (
        (intrinsicMin !== undefined && value < intrinsicMin) ||
        (intrinsicMax !== undefined && value > intrinsicMax)
    )
        issue('integer-range', 'Integer is outside the effective capacity.');
    if (min !== undefined && value < min)
        issue('minimum', 'Integer is below the declared minimum or equals an exclusive minimum.');
    if (max !== undefined && value > max)
        issue('maximum', 'Integer is above the declared maximum or equals an exclusive maximum.');
    if (divisor !== undefined && value % divisor !== 0n)
        issue('multiple-of', 'Integer must be an exact multiple of the declared divisor.');
    return issues.length ? invalid() : valid({ kind: 'value', value: text });
}
