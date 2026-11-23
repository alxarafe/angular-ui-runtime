# Local INTEGER validation (AUR-VALID-001)

[AUR-VALID-004](scalar-validation.md) subsequently adds five scalar definitions to
the same boundary; this document continues to specify unchanged INTEGER behavior.

`validateField(request: FieldValidationRequest): FieldValidationResult` is the
framework-independent local field validation boundary exported from
`@alxarafe/ui-runtime`. AUR-VALID-001 introduced `IntegerFieldDefinition`;
[AUR-VALID-002/003](decimal-validation.md) extends the same request boundary with
`DecimalFieldDefinition`. This document describes INTEGER behavior, which is unchanged.
No other semantic type, document aggregation, save readiness, transport or backend
acceptance is implemented. Existing FORM, GRID and STATE contracts are unchanged.

## Definition and inputs

```ts
const result = validateField({
  definition: {
    type: 'INTEGER', required: true, nullable: false,
    capacity: { bits: 64, signed: false },
    constraints: {
      minimum: { value: '0' },
      maximum: { value: '18446744073709551615', exclusive: false },
      multipleOf: '3',
    },
  },
  input: documentField.input,
  path: [
    { kind: 'property', name: 'details' },
    { kind: 'row', key: 'stable-row' },
    { kind: 'property', name: 'quantity' },
  ],
});
```

Definitions are separate from `DocumentField`, renderer contexts and editing inputs.
Only `type`, `required`, `nullable`, optional `capacity` and optional `constraints`
are admitted. Unknown definition members/constraints are diagnosed rather than
silently ignored. Application labels and identities remain outside this comparison
and validation definition. Definitions are checked before any value, even absence
or null, so malformed constraints never produce a success through an optional slot.

The existing `EditingInput`, `ValueSlot`, `FieldValue` and `ValuePath` are reused:

| Input | Result |
| --- | --- |
| absent, optional | valid, parsed absent |
| absent, required | invalid: `required` |
| explicit null, nullable | valid, parsed null, regardless of required |
| explicit null, nonnullable | invalid: `null-not-allowed` |
| empty or whitespace text | present, invalid: `integer-syntax`, never `required` |
| boolean or runtime JS number | invalid: `type`, never coerced |
| raw text | checked as exact integer text; invalid drafts remain in caller state |

Defaults and update omission semantics belong to the application. A corrected raw
input may produce a locally parsed value slot, but validation never replaces that
raw input in STATE. No previous parsed fallback is supplied for invalid input.

## Exact INTEGER rules

The grammar is ASCII `[+-]?[0-9]+`, matching the entire string. Leading zeros,
plus signs and negative zero are accepted and retained. No trimming, canonical
rewrite, fractions, exponents, other bases, separators, Unicode digits, NaN,
infinity or incomplete signs are accepted. Negative zero is mathematically zero,
including under unsigned capacity. A valid result preserves the exact lexical text.

Capacity, when provided, requires **both** `bits: 8 | 16 | 32 | 64` and `signed`.
Partial capacity is a definition error. Omitted capacity means no intrinsic numeric
range; it does not imply any ARP dictionary default, bit width or signedness.
The input work bound still applies. Signed capacity is `[-2^(bits-1), 2^(bits-1)-1]`;
unsigned is `[0, 2^bits-1]`. Unsigned 64 maximum is `18446744073709551615`;
`18446744073709551616` is rejected. All limits and arithmetic use BigInt.

`IntegerBound` has exact integer `value` and optional `exclusive` (default false).
Minimum and maximum are independent. Declared bounds intersect intrinsic capacity
and cannot widen it. Exclusive equality fails. Effective integer endpoints are
computed by adding/subtracting one exactly; an empty interval is a definition
error, including intervals emptied only after capacity intersection.

`multipleOf` must be positive exact integer text. Zero, negative, malformed and
oversized divisors are definition errors. Remainder uses BigInt, including negative
operands and zero. When both endpoints exist, an interval containing no permitted
multiple is also diagnosed as contradictory, without enumeration.

## Results, diagnostics and work limits

`FieldValidationResult` is discriminated:

- `valid`: `parsed: ValueSlot`, certifying only the supported local checks.
- `invalid`: a nonempty `issues` array of `ValidationIssue` with source `local`,
  stable code, full typed path and a human-readable English message.
- `definition-error`: a nonempty `diagnostics` array of `DefinitionDiagnostic`
  with source `definition`, stable code, full typed path and message.

There is no pending branch because this increment has no deferred obligation.
Later supported obligations can add a meaningful pending result. A local success
never certifies server acceptance, permissions, domain rules or unchecked types.

Local codes are `required`, `null-not-allowed`, `type`, `integer-syntax`,
`integer-range` (intrinsic capacity), `minimum`, `maximum`, `multiple-of` and
`input-limit`. After lexical admission, all failing numeric checks are returned in
that deterministic order. Presence/type/syntax/size failures stop numeric checks.
Definition codes are `definition`, `capacity`, `constraint`, `constraint-limit`,
`multiple-of-definition` and `contradictory-bounds`. Definition diagnostics stop at
the first failure. Malformed divisor syntax uses `constraint`; a nonpositive
well-formed divisor uses `multiple-of-definition`. No parsed slot accompanies
either failure result.

Every input/constraint integer lexeme is limited to 4,096 UTF-16 code units,
including sign and leading zeros. Oversized editing text produces `input-limit`;
oversized constraints produce `constraint-limit`, before regex or BigInt parsing.
At most three constraint integers and one input integer are parsed. Only bounded
BigInt comparison, remainder and endpoint arithmetic are used; the only shift is
the capacity calculation (at most 64 bits). There are no expanded huge powers,
floating point conversions or unbounded searches. This work limit is separate from
semantic capacity and does not claim consumer transport parity.

Results, arrays, issue objects, parsed slots and detached path segments are deeply
frozen. Caller input, definition and paths are never mutated or frozen. Paths must
be nonempty typed property/key sequences with nonblank identities, at most 128
segments; malformed paths throw a programming error because a trustworthy issue
location cannot be constructed. The validator does not resolve paths against a
document; the caller supplies the actual field location.

## STATE and browser evidence

The shared internal bounded INTEGER lexical primitive is also used by
`exactNumericEqual`. Its public API, DECIMAL equality semantics and dirty behavior
are unchanged. Equality alone remains insufficient for validity. Validation neither
changes accepted/current snapshots nor advances revision, sets dirty, changes keys
or stores validation on the document. All four clean/dirty and valid/invalid
combinations are possible and tested.

The installed-APF testbed `/default-theme/?scenario=validation` uses the public FORM
host with an INTEGER value held in STATE. Application-owned feedback is associated
through `describedBy`. Browser tests show an incomplete draft, capacity overflow,
exact correction and clean numeric reversion across the five packaged themes and
a structural frame. Feedback text belongs to the QA application. This is focused
field evidence, not complete form error presentation, aggregate validation or save
blocking. No backend or external consumer conformance is claimed.

DECIMAL is now covered by the [DECIMAL contract](decimal-validation.md). BOOLEAN,
STRING/TEXT, ENUM, BINARY, DATE, TIME, DATETIME and UUID validation remain unimplemented.
Pattern checks, document aggregation, deferred checks and
save readiness remain subsequent increments. VALID-002/004 remain partial at the
full acceptance level; broad definition/adapter and invalid-save requirements are
not closed by AUR-VALID-001. See the DECIMAL contract for subsequent local numeric evidence.
