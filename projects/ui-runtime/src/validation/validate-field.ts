/** SPDX-License-Identifier: Apache-2.0 */
import type { PathSegment, ValuePath } from '../form/form-definition.js';
import type { EditingInput, ValueSlot } from '../state/document-state.js';
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
    | 'input-limit';
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
export type FieldValidationResult =
    | { readonly state: 'valid'; readonly parsed: ValueSlot }
    | {
          readonly state: 'invalid';
          readonly issues: readonly [ValidationIssue, ...ValidationIssue[]];
      }
    | {
          readonly state: 'definition-error';
          readonly diagnostics: readonly [DefinitionDiagnostic, ...DefinitionDiagnostic[]];
      };
export interface FieldValidationRequest {
    readonly definition: IntegerFieldDefinition | DecimalFieldDefinition;
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
    return { type: 'INTEGER' as const, intrinsicMin, intrinsicMax, min, max, divisor };
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
        minimum,
        maximum,
        divisor,
        precision: counter(constraints?.precision, 'precision'),
        scale: counter(constraints?.scale, 'scale'),
    };
}
function resolve(definition: FieldValidationRequest['definition']) {
    return definition?.type === 'DECIMAL'
        ? resolveDecimal(definition)
        : resolveInteger(definition as IntegerFieldDefinition);
}

/** Pure local INTEGER/DECIMAL validation. Never modifies editing state. */
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
    const issue = (code: LocalValidationCode, message: string) =>
        issues.push(Object.freeze({ source: 'local', code, path, message }));
    const invalid = (): FieldValidationResult =>
        Object.freeze({
            state: 'invalid',
            issues: Object.freeze(issues) as readonly [ValidationIssue, ...ValidationIssue[]],
        });
    const valid = (parsed: ValueSlot): FieldValidationResult =>
        Object.freeze({ state: 'valid', parsed: Object.freeze(parsed) });
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
        const parsed = parseNumeric(text, request.definition);
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
