/** SPDX-License-Identifier: Apache-2.0 */
import type { PathSegment, ValuePath } from '../form/form-definition.js';
import type { EditingInput, ValueSlot } from '../state/document-state.js';
import { integerMatch, numericTextLimit } from '../state/numeric-syntax.js';

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
export type LocalValidationCode =
    | 'required'
    | 'null-not-allowed'
    | 'type'
    | 'integer-syntax'
    | 'integer-range'
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
    readonly definition: IntegerFieldDefinition;
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
function resolve(definition: IntegerFieldDefinition) {
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
    return { intrinsicMin, intrinsicMax, min, max, divisor };
}

/** Pure local INTEGER validation. Never accepts a backend result or modifies editing state. */
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
        issue('type', 'INTEGER requires exact text.');
        return invalid();
    }
    if (text.length > numericTextLimit) {
        issue('input-limit', 'Integer input exceeds 4096 characters.');
        return invalid();
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
