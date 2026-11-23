# Local exact DECIMAL validation (AUR-VALID-002/003)

[AUR-VALID-004](scalar-validation.md) subsequently expands the boundary to seven
implemented definitions; DECIMAL behavior and the numeric work policy below are unchanged.

The existing `validateField` boundary now accepts either `IntegerFieldDefinition`
or `DecimalFieldDefinition`. It still returns only immutable `valid`, `invalid` or
`definition-error` results with typed paths. There are no pending obligations,
other semantic validators, document aggregation, save readiness or backend claims.

## Public definition

```ts
const definition: DecimalFieldDefinition = {
  type: 'DECIMAL', required: true, nullable: false, allowExponent: true,
  constraints: {
    minimum: { value: '-1.25', exclusive: false },
    maximum: { value: '1e3', exclusive: true },
    multipleOf: '0.05', precision: 20, scale: 4,
  },
};
const result = validateField({ definition, input: documentField.input, path });
```

`DecimalBound` has exact string `value` and optional `exclusive` (default false).
It is structurally identical to the existing `IntegerBound`. Numeric constraints
are strings; precision and scale are safe integer counters. `allowExponent` is
required and applies to editing text **and** bound/divisor syntax. Unsupported
definition members, such as capacity or step, are diagnosed, never ignored.
INTEGER definitions, codes and behavior remain unchanged.

Presence and nullability use the existing rules. Optional absence is valid;
required absence yields `required`. Explicit null depends only on `nullable`.
Empty/whitespace text is present and fails `decimal-syntax`, not required. Neither
booleans nor JS numbers are coerced. Raw text is validated directly, without a
last-valid fallback. Success returns a new value slot retaining the exact spelling;
it never changes the raw envelope or draft in STATE. Local success is not backend
acceptance. Paths and result objects are defensively copied/frozen as before.

## Grammar and shared mathematical representation

The full-string ASCII grammar is `[+-]?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?`, with
the exponent part admitted only when enabled. `.5`, `1.`, empty/incomplete parts,
whitespace, separators, non-ASCII digits, other bases, NaN and infinity are rejected.
No text is trimmed, rounded or rewritten. For example, `+001.20E+3` remains exactly
that string in a successful parsed slot.

STATE equality and validation share internal parsing/normalization primitives.
A nonzero value is represented as `sign × digits × 10^exponent`: digits have no
leading or trailing zero; exponent is a bounded BigInt. Zero, including negative
zero and fractional/exponent spellings, has sign zero, digits `0` and exponent zero.
The public `exactNumericEqual` signature and observable equality/work policy remain
unchanged. Parsing/equality alone still does not certify constraints or validity.

Exact comparison first compares signs, then decimal orders (`digits.length +
exponent`), then equally padded coefficient digits when orders match. At most
4,096 coefficient characters are compared; widely separated exponents never cause
expanded powers. Negative order is reversed correctly. This distinguishes values
such as `9007199254740993.000000001` and `9007199254740993.000000002` exactly.

## Precision and normalized scale

Precision counts digits of the normalized value expanded without exponent,
excluding sign and leading zeros. Integral trailing zeros count; insignificant
fractional trailing zeros do not. For normalized nonzero digits and exponent `e`:

- precision = digit count + max(e, 0)
- scale = max(-e, 0)
- zero always has precision 1 and scale 0

| Input | Precision | Scale |
| --- | ---: | ---: |
| `12.3400` | 4 | 2 |
| `1000` | 4 | 0 |
| `0.0012` | 2 | 4 |
| `-12.3400` | 4 | 2 |
| `0.0000` | 1 | 0 |
| `1.234e2` (= `123.4`) | 4 | 1 |
| `1.2300e-2` | 3 | 4 |

`1.234e2` has precision **4**, because its expanded value `123.4` contains four
significant digits. These examples are pinned by independent test expectations.

Precision/scale constraints are independent upper limits, not a `(precision, scale)`
database capacity. Precision need not be greater than scale. Each counter must be
a nonnegative safe integer at most 4,096, following the approved finite numeric
work profile. No clamping occurs: unsafe, nonintegral, negative or non-number
counters produce `constraint`; larger safe counters produce `constraint-limit`.
Zero precision is admitted as a limit but rejects every present nonnull numeric
value (even zero); optional absence/nullable null still follow their own rules.
No constraint implies no semantic precision/scale limit beyond the lexical/work
policy. A value such as `1e4096` can be locally valid with no precision constraint,
although it exceeds a declared precision of 4,096.

## Bounds and divisibility

Inclusive/exclusive minimum and maximum compare mathematical values exactly.
`1.20` equals `1.2`, `-1.25` is below `-1.2`, `1e3` equals `1000` and all zero
spellings are equivalent. Equality with an exclusive endpoint fails. Reversed
intervals and equal endpoints with either end exclusive produce
`contradictory-bounds` before any input is admitted. Unlike INTEGER, decimal bounds
are not adjusted by one: `(0.1, 0.2)` contains decimal values.

`multipleOf` requires a strictly positive decimal, with malformed/oversized syntax
reported as `constraint`/`constraint-limit` and zero/negative values reported as
`multiple-of-definition`. For coefficients `a`, `b` and exponent difference `d`,
divisibility uses `(a × 10^d) % b` for nonnegative d, or `a % (b × 10^-d)` otherwise.
Magnitude arithmetic suffices for negative dividends; zero is always divisible.
Thus `0.3 / 0.1`, `-1.25 / 0.05` and `1e-3 / 0.0005` are integral while
`0.31 / 0.1` is not. No floating remainder, tolerance or rounding is used.

This increment detects interval contradictions, but does not solve joint domain
emptiness across arbitrary decimal bounds, precision, scale and multipleOf. It
does not enumerate candidate multiples. Definitions can therefore have no permitted
nonnull value without a contradiction diagnostic; individual values are still
checked against every constraint. INTEGER's existing discrete-interval diagnostics
are preserved.

## Resource limits and failures

- Every input/bound/divisor lexeme is at most 4,096 UTF-16 units, including sign,
  fractional part and exponent. Size is checked before regex or arithmetic.
- The exponent text has at most six characters (including its sign), and absolute
  exponent is at most 4,096. This preserves STATE's established policy, including
  rejection of excessively padded exponent text even for mathematical zero.
- After coefficient normalization, exponents are within the conservative bound
  ±8,192. Two admitted values require at most 16,384 decimal alignment places.
  The divisibility helper checks that bound before constructing powers; aligned
  BigInts have at most 20,480 decimal digits. There are at most three numeric
  constraints and one input, not an unbounded list or search.
- Precision/scale calculations use only digit counts and BigInt exponent arithmetic;
  they never expand the represented value. Data/constraints never pass through
  Number, parseFloat or parseInt. Number is used only for lengths and safe counters.

Unsupported editing lexemes/exponents yield `input-limit`; corresponding definition
limits yield `constraint-limit`. `work-limit` is a defensive divisibility issue if
an alignment cannot be safely performed; admitted parser outputs fit the derived
alignment bound, so no additional semantic exclusion is introduced. Unsupported
arithmetic is never accepted as valid.

New local codes are `decimal-syntax`, `precision`, `scale` and `work-limit`.
Existing presence/type/input-limit/minimum/maximum/multiple-of and definition codes
are reused. Numeric issues accumulate in minimum, maximum, precision, scale,
multiple-of/work-limit order. Syntax/type/work admission failures stop arithmetic.
Definition diagnostics stop at the first invalid definition, before absence/null.
No failure result contains a parsed fallback.

## Evidence and remaining scope

Pure tests cover all table dimensions, grammar, zeros, fractions, long coefficients,
wide exponent separation, bounds, fractional divisibility, counters, definition
diagnostics, raw drafts, complete frozen paths/results and STATE snapshot/dirty
independence. A fixed-seed generator checks 256 bounded cases against independent
rational cross-products/remainders. The entire INTEGER/STATE regression suite runs.

The installed-APF validation testbed adds one DECIMAL field to the existing FORM
host. Desktop/mobile tests exercise exact values above 2^53, incomplete drafts,
scale and divisibility failures, correction, lexical reversion to clean and theme
switches without losing input. Application-owned associated feedback is shown;
there is no duplicated rendering infrastructure, aggregate validation or save block.

VALID-002/003 local numeric behavior is implemented. External backend parity and
transport/consumer conformance remain open; isolated Angular consumer builds prove
packaging, not external numerical contract parity. Remaining semantic types,
patterns, document aggregation, saving and navigation protection are not implemented.
