import {
    validateField,
    type EditingInput,
    type IntegerFieldDefinition,
    type DecimalFieldDefinition,
    type StringFieldDefinition,
    type TextFieldDefinition,
    type BooleanFieldDefinition,
    type EnumFieldDefinition,
    type BinaryFieldDefinition,
    type TextConstraints,
    type PatternConstraint,
    type DeferredCheck,
    type PatternDiagnostic,
    type UuidFieldDefinition,
    type DateFieldDefinition,
    type TimeFieldDefinition,
    type DateTimeFieldDefinition,
    type TemporalConstraints,
    type FieldValidationResult,
    type ValuePath,
} from '../../projects/ui-runtime/src/public-api.js';
const definition: IntegerFieldDefinition = {
    type: 'INTEGER',
    required: true,
    nullable: false,
    capacity: { bits: 64, signed: false },
};
const path: ValuePath = [{ kind: 'property', name: 'n' }];
const input: EditingInput = { kind: 'raw', text: '-' };
const result: FieldValidationResult = validateField({ definition, input, path });
if (result.state === 'valid') {
    // @ts-expect-error parsed slots are immutable
    result.parsed.kind = 'absent';
} else if (result.state === 'invalid') {
    const code: string = result.issues[0].code;
    void code;
    // @ts-expect-error invalid values have no parsed fallback
    result.parsed;
}
// @ts-expect-error DECIMAL requires an explicit exponent policy
validateField({ definition: { type: 'DECIMAL', required: true, nullable: false }, input, path });
const decimal: DecimalFieldDefinition = {
    type: 'DECIMAL',
    required: false,
    nullable: true,
    allowExponent: true,
    constraints: { minimum: { value: '0.01' }, multipleOf: '0.05', precision: 20, scale: 4 },
};
validateField({ definition: decimal, input, path });
// @ts-expect-error UUID requires an explicit casing policy
validateField({ definition: { type: 'UUID', required: true, nullable: false }, input, path });
const bounds: TemporalConstraints = { minimum: { value: '2026-11-23', exclusive: true } };
const temporal: (
    UuidFieldDefinition | DateFieldDefinition | TimeFieldDefinition | DateTimeFieldDefinition
)[] = [
    { type: 'UUID', required: true, nullable: false, casing: 'either' },
    { type: 'DATE', required: true, nullable: true, format: 'gregorian-date', constraints: bounds },
    { type: 'TIME', required: false, nullable: false, format: 'local-time', fractionalDigits: 7 },
    {
        type: 'DATETIME',
        required: false,
        nullable: true,
        format: 'offset-instant',
        fractionalDigits: 7,
    },
];
for (const definition of temporal) validateField({ definition, input, path });
validateField({
    definition: {
        type: 'DATETIME',
        required: true,
        nullable: false,
        // @ts-expect-error unsupported offset profiles remain excluded
        format: 'local-datetime',
        fractionalDigits: 7,
    },
    input,
    path,
});
validateField({
    // @ts-expect-error TIME requires maximum input precision explicitly
    definition: { type: 'TIME', required: true, nullable: false, format: 'local-time' },
    input,
    path,
});
// @ts-expect-error legacy integer names are not supported semantic types
validateField({ definition: { type: 'INT64', required: true, nullable: false }, input, path });
const lengths: TextConstraints = { minimumLength: 0, maximumLength: 50000 };
const scalars: (
    | StringFieldDefinition
    | TextFieldDefinition
    | BooleanFieldDefinition
    | EnumFieldDefinition
    | BinaryFieldDefinition
)[] = [
    { type: 'STRING', required: true, nullable: false, constraints: lengths },
    { type: 'TEXT', required: false, nullable: true, constraints: lengths },
    { type: 'BOOLEAN', required: true, nullable: false },
    { type: 'ENUM', required: true, nullable: true, choices: ['', 'OPEN'], constraints: lengths },
    { type: 'BINARY', required: true, nullable: false, format: 'base64' },
];
for (const definition of scalars) validateField({ definition, input, path });
// @ts-expect-error BINARY requires an explicit profile
validateField({ definition: { type: 'BINARY', required: true, nullable: false }, input, path });
validateField({
    // @ts-expect-error BOOLEAN has no synthetic constraints
    definition: { type: 'BOOLEAN', required: true, nullable: false, constraints: lengths },
    input,
    path,
});
// @ts-expect-error pattern metadata must declare a dialect and source
const unsupportedPattern: TextConstraints = { pattern: '.*' };
void unsupportedPattern;
const pattern: PatternConstraint = {
    dialect: 'portable-ascii-v1',
    source: '^[A-Z][A-Z0-9_]{0,29}$',
};
const patterned = validateField({
    definition: { type: 'STRING', required: true, nullable: false, constraints: { pattern } },
    input,
    path,
});
if (patterned.state === 'pending') {
    const check: DeferredCheck = patterned.checks[0];
    const diagnostic: PatternDiagnostic | undefined = patterned.diagnostics?.[0];
    void check;
    void diagnostic;
    // @ts-expect-error pending is not a confirmed valid result with issues
    patterned.issues;
    // @ts-expect-error deferred paths remain immutable
    patterned.checks[0].path[0] = { kind: 'property', name: 'changed' };
}
if (patterned.state === 'invalid') {
    const check: DeferredCheck | undefined = patterned.checks?.[0];
    void check;
}
const emptyPending: FieldValidationResult = {
    state: 'pending',
    parsed: { kind: 'value', value: 'A' },
    // @ts-expect-error pending checks cannot be empty
    checks: [],
};
// @ts-expect-error arbitrary RegExp objects are not pattern definitions
const executablePattern: PatternConstraint = /A/;
void emptyPending;
void executablePattern;
const partial: IntegerFieldDefinition = {
    type: 'INTEGER',
    required: true,
    nullable: false,
    // @ts-expect-error partial capacities are ambiguous
    capacity: { bits: 8 },
};
// @ts-expect-error FieldValue remains exact text, boolean or null, never Number
validateField({ definition, input: { kind: 'value', value: 42 }, path });
void partial;
