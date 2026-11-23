import {
    validateField,
    type EditingInput,
    type IntegerFieldDefinition,
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
// @ts-expect-error DECIMAL is not implemented by this boundary
validateField({ definition: { type: 'DECIMAL', required: true, nullable: false }, input, path });
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
