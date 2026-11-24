# Local UUID and exact temporal validation (AUR-VALID-005)

`validateField` now admits `UuidFieldDefinition`, `DateFieldDefinition`,
`TimeFieldDefinition` and `DateTimeFieldDefinition` alongside the seven existing
definitions. This completes local type coverage for the eleven semantic identifiers
under explicitly supported profiles; it does not complete every validation/editor
requirement. Patterns, document aggregation, saving, reconciliation and navigation
protection remain outside this increment.

## Public definitions and common behavior

```ts
const definition: DateTimeFieldDefinition = {
  type: 'DATETIME', required: true, nullable: false,
  format: 'offset-instant', fractionalDigits: 7,
  constraints: {
    minimum: { value: '2026-11-23T17:00:00Z' },
    maximum: { value: '2026-11-24T17:00:00Z', exclusive: true },
  },
};
const result = validateField({ definition, input: documentField.input, path });
```

Every definition retains explicit `required` and `nullable`. UUID requires
`casing:'lower'|'either'`; DATE requires `format:'gregorian-date'`; TIME requires
`format:'local-time'` and `fractionalDigits`; DATETIME requires
`format:'offset-instant'` and `fractionalDigits`. DATE/TIME/DATETIME accept optional
`TemporalConstraints` with independent minimum/maximum `TemporalBound` values:
exact string `value` and optional `exclusive` (default false). The bound shape is
structurally identical to existing numeric bounds, but its text is parsed only
under the declared temporal profile. UUID does not accept range constraints.

Unknown members, profiles, casing policies and constraints diagnose rather than
relaxing checks. Definitions are admitted before optional absence or nullable null.
Presence/nullability and primitive text type checking are unchanged. Empty text is
present but invalid for these formats; no trimming or coercion occurs. Raw drafts
are explicitly checked; a valid raw draft returns a new parsed lexical value slot,
without replacing its source envelope. Invalid drafts have no parsed fallback.

Results remain immutable `valid`, `invalid` or `definition-error`; issue paths use
detached frozen property/stable-row segments. No pending check or backend acceptance
is implied. INTEGER, DECIMAL, scalar and STATE implementations retain their behavior.

## UUID

UUID text contains exactly 36 ASCII characters in the form
`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`, where every x is a hexadecimal digit.
`lower` admits only a–f; `either` also admits A–F and mixed case. Digits are always
allowed. All-zero, all-f and every version/variant nibble are admitted without
invented restrictions. No braces, compact spelling, whitespace or normalization is
accepted. A successful result retains original case and spelling.

## Gregorian DATE

DATE uses exactly `yyyy-MM-dd`, with years 0001–9999 and real proleptic Gregorian
month/day rules. Leap years are divisible by four except century years not divisible
by 400: 2000 and 2024 admit February 29; 1900 and 2025 do not. There is no historical
calendar cutover, rollover, timezone suffix or locale-dependent interpretation.

Internally DATE is an ordinal day from `0001-01-01` = 0. Days preceding year y are
`365*(y-1) + floor((y-1)/4) - floor((y-1)/100) + floor((y-1)/400)`, followed by at
most eleven preceding-month additions and the zero-based day. All data arithmetic
uses BigInt. The last admitted ordinal, `9999-12-31`, is 3,652,058.

## Local TIME and fractional precision

TIME uses `HH:mm:ss` with an optional dot followed by one through seven decimal
digits. Hours are 00–23, minutes and seconds 00–59. No offset, timezone, 24:00,
leap second, reduced clock syntax, decimal comma or incomplete fraction is admitted.

**`fractionalDigits` is maximum input precision**, not required lexical width or
canonical output width. It must be an explicit nonnegative safe integer from zero
through seven. Zero forbids a fractional part. Seven admits no fraction or any
fraction length 1–7. Excess lexical digits are rejected even when they are zeros.
The same policy applies to temporal bounds. Validation never pads the returned
editing text: `12:30:00.1` remains that exact spelling.

This interpretation follows AUR's zero-to-seven input contract and separates it
from the historical adapter's reference serialization of seven digits. An application adapter owns
any successful canonical output. No local TIME is converted to UTC.

Internally a local clock is exact 100-nanosecond ticks since midnight: whole seconds
times 10,000,000 plus the fraction right-padded to seven digits **only inside the
comparison representation**. Thus `.1` and `.1000000` compare equally for bounds,
while `.1000001` is one tick later. The original lexical input is never rewritten.

## Offset DATETIME profile

The closed ISO-style lexical subset is:

`yyyy-MM-ddTHH:mm:ss[.fraction](Z|+HH:mm|-HH:mm)`

T and Z are uppercase, the date and clock must be valid, seconds are required,
fractions follow the declared maximum precision, and the numeric offset requires
two-digit hours/minutes with a colon. No missing timezone, space separator,
offset seconds, named zone, browser-local timezone or daylight-saving inference
is admitted.

Offsets are within **−14:00 through +14:00**. Minutes must be 00–59 and must be zero
at either fourteen-hour boundary. ±13:59, ±14:00 and minute offsets such as +05:45
are admitted; ±14:01, ±15:00 and +00:60 are rejected. Z, +00:00 and −00:00 all
represent zero numeric offset in this profile, following inspected adapter arithmetic;
−00:00 is not an unknown-offset marker here. Its original sign remains in the text.
This is an explicit local profile, not a claim to accept every ISO/RFC spelling.

Both the local Gregorian date and the offset-adjusted UTC instant must fall within
years 0001–9999. For example:

| Input | Result |
| --- | --- |
| `0001-01-01T14:00:00+14:00` | earliest admitted instant |
| `0001-01-01T00:00:00+00:01` | invalid: UTC would precede year 0001 |
| `9999-12-31T09:59:59.9999999-14:00` | latest admitted instant |
| `9999-12-31T10:00:00-14:00` | invalid: UTC would enter year 10000 |

There is no wrapping, clamping or automatic UTC string conversion. The exact instant
representation is `ordinalDay * 864000000000 + localTicks - offsetMinutes * 600000000`,
using BigInt throughout. Admitted instant ticks range from 0 through
3,155,378,975,999,999,999 relative to `0001-01-01T00:00:00Z`, not Unix milliseconds.
Signed intermediate calculations detect UTC underflow/overflow without precision loss.

### Profile evidence and authority

The normative AUR contract determines Gregorian years, clock ranges, seven-digit
precision, explicit offsets and lexical retention. Read-only source inspection
informed the previously unspecified offset bound and year-crossing policy:

Historical profile-selection sources and revisions are retained in
[engineering provenance](../history/engineering-provenance.md). The AUR profile
requires the ±14:00 offset boundary, minute checks, seven-digit precision and rejection
of UTC year crossings. Input precision and adapter output width remain separate.
These rules do not imply equivalence to permissive backend parsers or external
consumer conformance. No reference repository is modified or run for library QA.

## Bounds, diagnostics and bounded work

DATE bounds compare ordinals, TIME bounds local clock ticks and DATETIME bounds
instant ticks. Each bound must be valid under the field's own profile, precision,
offset and year limits. Equality at an exclusive bound fails, including differently
spelled equal instants. Reversed/equal-exclusive intervals diagnose contradictions.
Contradiction detection also respects the representable grid: DATE steps one day;
TIME/DATETIME step `10^(7-fractionalDigits)` ticks. An open interval containing no
representable value is diagnosed, including adjacent excluded days or ticks and
an exclusive endpoint beyond the intrinsic domain. This changes no input spelling.

New local codes are `uuid-format`, `date-format`, `time-format` and `datetime-format`.
Presence/type/minimum/maximum codes are reused; invalid bounds use `constraint`,
invalid profiles/casing/malformed counters use `definition`, supported-shape precision
above seven uses `constraint-limit`, and empty intervals use `contradictory-bounds`.
Numeric bound failures accumulate minimum then maximum. Format failures stop range
checks. Definition diagnostics precede all input acceptance. Messages contain no
input values, private row keys or path metadata.

Input sizes are intrinsically bounded by the grammar: UUID exactly 36 characters,
DATE 10, TIME 8–16 and DATETIME 20–33. Length is checked before fixed-size regex
matching; nonmatching or oversized text yields a format issue, not truncation or
an arbitrary storage-limit policy. Temporal arithmetic uses constant-size BigInts,
at most eleven month additions, seven fraction digits and powers no larger than
10^7 for the precision grid. No Date constructor, Date.parse, Number conversion of
temporal data, floating epoch arithmetic, locale parsing or user-supplied regex is used.

## STATE, browser evidence and remaining limitations

STATE's temporal equality remains **lexical**. DATETIME bounds recognize equal
instants across offsets, but changing `18:00:00+01:00` to `17:00:00Z` can still make
the document dirty. TIME lexical fraction changes and UUID casing changes likewise
remain edits. Validation never changes snapshots, revision, keys or paths. Clean/
invalid, dirty/valid and dirty/invalid states are independent and tested.

The installed-APF validation testbed adds UUID and DATE/TIME/DATETIME to its existing
FORM/STATE fixture. Temporal fields deliberately select the public STRING renderer
as a repository-local exact-text adapter; no native date/time widget conformance
is claimed. This preserves invalid dates, incomplete temporal drafts, explicit
offsets and seven-digit fractions across five themes plus a structural frame at
desktop/mobile sizes. UUID uses its public artifact. Feedback is application-owned
and associated with each field. The legacy string event channel is not a new raw
envelope; pure tests separately exercise explicit raw inputs. Absence/raw editor
capability, hidden errors and aggregate/save workflows remain separate acceptance gaps.

Unit evidence includes independent ordinal/instant anchors, all month lengths,
century exceptions, offset/year extrema, one-tick distinctions above safe Number
precision, definition diagnostics, frozen paths/results and 128 deterministic
instant cases generated from known day anchors and clock tick arithmetic. A test
temporarily makes JavaScript Date unusable while validation runs. Existing seven-type
and STATE regression suites remain mandatory. Backend serialization, broad consumer
temporal parity, patterns and document-wide validation are not certified here.
