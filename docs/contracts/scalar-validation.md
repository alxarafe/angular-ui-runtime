# Local STRING, TEXT, BOOLEAN, ENUM and BINARY validation (AUR-VALID-004)

[AUR-VALID-005](temporal-uuid-validation.md) subsequently adds the remaining four
UUID/temporal definitions. The scalar contracts below are unchanged;
document-wide validation remains pending.

[AUR-VALID-009](pattern-validation.md) now adds patterns to STRING/TEXT/ENUM and a
distinct pending result. Local errors retain applicable deferred obligations. This
supersedes the earlier unsupported-pattern-only boundary; scalar semantics remain unchanged.

The existing framework-independent `validateField` accepts five additional public
definitions: `StringFieldDefinition`, `TextFieldDefinition`, `BooleanFieldDefinition`,
`EnumFieldDefinition` and `BinaryFieldDefinition`. This increment originally brought
the request union to seven types; the subsequent UUID/temporal increment completes
all eleven. INTEGER and DECIMAL contracts are unchanged.
There is no parallel engine, document validation store, aggregation or save API.

```ts
const result = validateField({
  definition: {
    type: 'ENUM', required: true, nullable: false,
    choices: ['', 'OPEN', 'CLOSED'],
    constraints: { minimumLength: 0, maximumLength: 6 },
  },
  input: documentField.input,
  path: [
    { kind: 'property', name: 'details' },
    { kind: 'row', key: 'stable-row' },
    { kind: 'property', name: 'status' },
  ],
});
```

## Definitions and presence

Every definition requires explicit `required` and `nullable` booleans. Definitions
are checked before accepting optional absence or nullable null. Unknown members,
unsupported constraints and malformed catalogues/profiles return `definition-error`.
Existing INTEGER/DECIMAL definitions, diagnostics, work policies and behavior remain
unchanged. No definitions are exported for UUID, DATE, TIME or DATETIME.

| Input | Meaning |
| --- | --- |
| `{kind:'absent'}` | valid only when optional; otherwise `required` |
| `{kind:'value',value:null}` | valid only when nullable; otherwise `null-not-allowed` |
| `{kind:'value',value:''}` | present empty text, not absence or null |
| `{kind:'raw',text:...}` | explicitly validate the raw text under the declared type |

Raw strings can produce a new parsed value slot only after supported STRING/TEXT,
ENUM or Base64 checks. Raw BOOLEAN never produces a boolean: BOOLEAN requires a
primitive boolean in a value slot. No default, first-choice substitution, truthiness,
string-to-boolean conversion or last-valid fallback exists. Validation never changes
the supplied envelope, STATE accepted/current values, revision, dirty state or keys.
These types use STATE's exact lexical equality, with no numeric or Unicode rewrite.

## STRING and TEXT

`StringFieldDefinition` and `TextFieldDefinition` accept optional `constraints:
TextConstraints`, also reused by ENUM:

```ts
interface TextConstraints {
  readonly minimumLength?: number;
  readonly maximumLength?: number;
  readonly pattern?: PatternConstraint;
}
```

Lengths count Unicode scalar values, excluding isolated UTF-16 surrogates:

| Text | Length |
| --- | ---: |
| `A` | 1 |
| `😀` | 1 |
| `e` followed by U+0301 | 2 |
| precomposed `é` | 1 |
| empty text | 0 |
| space, CR, LF, tab, space | 5 |

Valid surrogate pairs count once; isolated high/low surrogates yield
`invalid-unicode` before length or membership checks. Noncharacters that are Unicode
scalar values are not arbitrarily excluded. No normalization, trimming, whitespace
collapse or line-ending conversion occurs. Empty and whitespace-only text pass
unless declared length limits prohibit them. Parsed text retains the original exact
string, including combining marks, supplementary characters and line endings.

Each limit must be a nonnegative safe integer. Zero is explicit and valid. Negative,
fractional, NaN, infinite, unsafe and non-number counters yield `constraint`, as do
minimum greater than maximum and unknown constraint members. No numeric 4,096 limit
is imposed on text, text counters or encoded binary strings. Counting is a single
UTF-16 scan with constant auxiliary space, without copying the text into an array.
The longest engine-representable strings remain subject to application resource
policies; this increment adds no arbitrary storage or scan-length cutoff.

## BOOLEAN

`BooleanFieldDefinition` contains only `type:'BOOLEAN'`, `required` and `nullable`.
Only `{kind:'value',value:true}` and `{kind:'value',value:false}` are boolean scalar
successes. Strings such as `true`, `false`, `0`, `1`, numbers, objects, arrays and
boxed booleans yield `type`. Raw drafts also yield `type`, even if their text is
`true` or `false`. Inputs stay available to the parent editor. Synthetic length,
enum or numeric constraints are unknown definition members and are diagnosed.

## ENUM

`EnumFieldDefinition` additionally requires a nonempty ordered `readonly string[]`
`choices`, with optional `TextConstraints`. Every declared choice must be a
well-formed Unicode string; duplicate, malformed, sparse, non-string and empty
catalogues yield `definition`. The caller's array is neither sorted, mutated nor
frozen. A local Set performs exact membership without replacing declaration order.

Membership is case-sensitive and preserves whitespace and Unicode spelling. A
declared `''` is a valid choice; absent, null, empty, `OPEN` and `open` remain
distinct. Declared empty text is not a renderer placeholder. Length limits and
membership both apply: membership cannot silently override length constraints, nor
can a length-compliant undeclared string pass. A malformed input string yields
`invalid-unicode`; otherwise length failures precede `enum` membership failure.

## BINARY profile

`BinaryFieldDefinition` requires `format:'base64'`. This is strict standard
[RFC 4648 sections 3.1–3.5 and 4](https://www.rfc-editor.org/rfc/rfc4648.html#section-4)
Base64, with the canonical-padding choice made explicit:

- Alphabet: `A–Z`, `a–z`, `0–9`, `+`, `/` only.
- Encoded length is a multiple of four; one or two final `=` characters are
  required when needed, with no other padding placement or excess padding.
- Unused bits must be zero: four low bits in the last data sextet with `==`,
  two low bits with `=`. For example, `Zg==` is accepted and `Zh==` is rejected.
- No whitespace, wrapping, implicit trimming, URL-safe alphabet or repair.
- Empty text encodes zero bytes and is valid, including for a required property.

Examples include `Zg==` (one byte), `Zm8=` (two), `Zm9v` (three) and empty text.
The validator scans characters and checks final sextet bits without allocating a
decoded byte array or decoding/re-encoding input. Work is linear with constant
auxiliary space; there is no new binary-size limit. The exact encoded string is
returned on success. BINARY has no text-length constraints in this increment.
Uploads, downloads, serialization, MIME/base64url and backend parity are outside scope.

## Results, diagnostics and pattern boundary

The immutable `valid`, `invalid` and `definition-error` branches remain, joined by
`pending` for locally parsed fields awaiting a server-pattern check. Invalid results
can retain nonempty deferred `checks` and nonfatal pattern `diagnostics`. Results
with no pattern preserve their previous shapes. See the [pattern contract](pattern-validation.md).
Parsed slots, nonempty issue/diagnostic arrays, entries and detached typed path
segments are frozen. Local issues retain source `local`; definition diagnostics
retain source `definition`. Messages do not interpolate values, catalogue members,
paths, row keys or private metadata. No pending branch is introduced.

New stable local codes are `minimum-length`, `maximum-length`, `invalid-unicode`,
`enum` and `binary-format`. Presence and type codes are reused. For text/ENUM,
Unicode failures stop further checks; otherwise issues accumulate in minimum-length,
maximum-length, membership order. Base64 format failures use `binary-format`.
Definition errors reuse `definition` (shape, catalogue, profile) and `constraint`
(lengths, contradiction, unknown constraints); no new definition-code vocabulary is
needed. Definitions fail before any input acceptance, including null/absence.

**Patterns are restricted to the implemented VALID-009 boundary.** `TextConstraints`
admits explicit `portable-ascii-v1` or `server` metadata. The bounded local compiler
never executes a source as JavaScript regex. Malformed declarations diagnose;
unsupported sources defer. Pattern matching follows existing Unicode, length and
ENUM membership checks and cannot replace them. No backend pattern equivalence or
confirmation workflow is certified. BOOLEAN/BINARY continue to reject patterns.

## Browser evidence and renderer limitations

The installed-APF testbed `/default-theme/?scenario=validation` extends the existing
public FORM host with STRING/TEXT, BOOLEAN, ENUM and BINARY validation. Values live
in the existing STATE tree. It displays application-owned associated feedback per
field, independently of dirty state, and retains drafts across five packaged themes
and a structural frame on desktop/mobile. The tests cover Unicode and LF/whitespace
text, invalid raw BOOLEAN, null versus ENUM empty choice, noncanonical Base64,
correction and dirty/valid independence. Native control emissions remain exact
booleans rather than string coercion. No aggregate validation or save blocking exists.

Adaptation is explicit and repository-local:

- The packaged BINARY renderer is an output view, so QA uses the public TEXT
  renderer to edit Base64 strings while validating them as BINARY.
- A raw BOOLEAN draft replaces its field's renderer selection with public STRING;
  the parent retains a raw envelope and its invalid result. An explicit typed-boolean
  action supplies `true` and restores the BOOLEAN renderer. It never parses raw text.
- The packaged ENUM renderer selects by index and distinguishes `Not set` (null)
  from `(empty string)` (a declared empty choice). Both slots are tested. It cannot
  faithfully display an undeclared/raw arbitrary choice; pure validator tests cover
  those inputs without claiming editor support.
- The legacy scalar context has no absent/raw envelope. QA admits only present
  value/raw slots and explicitly maps raw text into text renderer values; absence
  is not silently mapped to null. Native text controls do not prove all possible
  line-ending/editor round trips; the pure core tests pin exact CR/LF preservation.

This is field validation evidence, not complete FIELD-003 editor capability.
Backend/consumer conformance, remaining temporal/UUID types, VALID-009 patterns,
document aggregation, persistence and navigation protection remain pending.
