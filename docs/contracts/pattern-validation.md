# Safe local patterns and deferred checks (AUR-VALID-009)

`validateField` extends the existing eleven-type boundary. `TextConstraints.pattern`
is available only for STRING, TEXT and ENUM:

```ts
export type PatternConstraint =
  | { readonly dialect: 'portable-ascii-v1'; readonly source: string }
  | { readonly dialect: 'server'; readonly source: string };

const result = validateField({
  definition: {
    type: 'STRING', required: true, nullable: false,
    constraints: {
      minimumLength: 1,
      pattern: { dialect: 'portable-ascii-v1', source: '^[A-Z][A-Z0-9_]{0,29}$' },
    },
  },
  input: documentField.input, path,
});
```

There is no separate public pattern engine, backend schema dependency, HTTP request,
confirmation transition, save readiness or document aggregation. Other semantic
definitions continue to reject pattern-bearing constraints. RegExp objects, flags,
unknown dialects/members and missing/non-string sources are fatal definition errors.

## Portable grammar

The closed language is a strict whole-input `^...$` with:

- Zero through 64 fixed atoms, each one printable ASCII literal or positive ASCII
  class. Every atom consumes exactly one Unicode scalar.
- Optionally one **final character class** followed by `{m,n}`, with decimal integer
  counters `0 <= m <= n <= 4096`. The repeated class does not count toward the fixed
  prefix limit. Leading zeros in counters are accepted without changing the bounds.
- No other quantifier or repeated literal. `{n}`, `{m,}` and `{,n}` are meaningful
  outside the approved grammar and are deferred rather than executed.

Printable means U+0020 through U+007E. Outside classes, reserved punctuation must
be quoted with a backslash: `\`, `^`, `$`, `.`, `|`, `?`, `*`, `+`, `(`, `)`, `[`, `]`,
`{`, `}`. Hyphen can be literal outside classes and can also be quoted. Slash is
an ordinary literal, not a pattern delimiter. Escaping nonreserved punctuation or
unknown escape letters is malformed portable syntax; known regex escapes such as
`\d`, `\w`, `\n`, `\1`, `\x41`, `\u0041`, `\p{L}` are recognized as unsupported,
never expanded or executed.

Positive classes contain printable ASCII literals and ascending ranges such as
`[A-Z0-9_]` or `[ -~]`. Hyphen is literal when first, last or quoted (`[-A-Z]`,
`[A-Z-]`, `[A\-Z]`); otherwise it connects ascending endpoints. Literal `]`, `[`
and backslash require quoting. Initial `^` denotes unsupported negation; quote it
for a literal caret there. Other regex metacharacters inside a class are literal.
Empty classes, unclosed positive classes, descending ranges and ambiguous interior
hyphens are malformed. Overlapping/duplicate ranges retain ordinary set semantics.
Negated, nested and intersected classes are not executed locally.

There are no groups, alternation, lookarounds, backreferences, Unicode properties,
wildcards, shorthand classes, flags, case folding, `*`, `+`, `?`, unbounded/nested
repetition, partial matching or multiline mode. Interior unquoted anchors are
outside the supported atom language. A quoted final dollar is not an end anchor.

| Source | Local disposition |
| --- | --- |
| `^$` | compiled; matches only empty text |
| `^ABC$` | compiled literal sequence |
| `^[A-Z][A-Z0-9_]{0,29}$` | compiled prefix plus final bounded class |
| `^[A]{0,0}$` | compiled; zero repetitions |
| `^(a+)+$`, `(?i)^A$`, `A`, `^é$` | unsupported; deferred, never executed |
| `^[Z-A]$`, `^[A]{2,1}$`, `^[A-Z$`, `^\q$` | malformed portable declaration; fatal |

## Compiler classification and safety

A private deterministic compiler runs from the definition before examining input.
It returns deeply frozen instructions (fixed atoms as ASCII range pairs, optional
final class/counts), a deferred disposition, or a malformed disposition. Programs
are independent of input, not cached in an unbounded global store, and never exposed
through the package's public exports.

The matcher scans scalar values against those instructions with no dynamic RegExp,
recursive descent at match time, branch search or backtracking. Length is checked
against prefix/repetition counts, and each consumed scalar is tested against the
relevant ASCII ranges. Exact end means the actual input end: `ABC\n` cannot match
`^ABC$`. Supplementary characters count as one scalar but cannot match ASCII classes.
No trimming, Unicode normalization or lexical repair occurs.

| Local resource | Maximum / behavior above it |
| --- | --- |
| Portable source | 256 UTF-16 units; defer before parsing larger sources |
| Fixed prefix | 64 atoms; defer excessive prefixes |
| Repetition upper bound | 4096; defer larger nonnegative ordered bounds |
| Executable input | 4096 Unicode scalars; defer pattern execution above it |

All successful portable sources are ASCII. Compilation allocates at most a
source-bounded set of tokens/ranges and 64 fixed instructions. Counter text is
bounded by the source limit and parsed exactly before safe small counter conversion.
Matching performs at most 4096 scalar steps, each scanning a source-bounded range
list. There is no exponential behavior or decoded/expanded unbounded representation.
The existing Unicode scan and independently declared length checks still run on
long text: this is a local pattern limit, not a universal text storage limit.

**Reconciliation of the provisional design:** the earlier phrase “unsupported/
malformed sources defer” is refined as follows. Malformed metadata is always fatal.
For an anchored portable source inside the work profile, confidently malformed
supported fragments (empty/unclosed positive class, bad range, invalid quoting,
broken or reversed bounded counts) produce fatal `constraint` diagnostics. The
compiler is deliberately not a general regex syntax checker: encountering a
construct outside its grammar defers conservatively, without certifying the rest
of that source as syntactically valid in any backend. For example, even `^($`
defers because groups are outside its grammar. Source/anchoring/work exclusions
can therefore defer before later malformed fragments are examined. No malformed
portable declaration diagnosed by this compiler is silently relabelled `server`.
The application can explicitly supply a server dialect only under its own contract.

`server` sources are opaque string metadata. They are never compiled or scanned as
regex, including empty/long sources; the application owns their backend syntax,
limits and meaning. A declared server pattern always creates an obligation when
applicable, never a locally certified match.

## Results and precedence

The result precedence is **definition-error > invalid > pending > valid**.

- `definition-error` retains the existing fatal `DefinitionDiagnostic[]` with source
  `definition`. Malformed pattern metadata/declarations use `constraint`. Definition
  errors prevent reliable validation and do not expose a guessed parsed value/check.
- `invalid` retains mandatory local issues. A supported pattern mismatch adds local
  code `pattern` after Unicode, length and ENUM membership checks.
- `pending` means every applicable local check passed but at least one server-pattern
  obligation remains. It is not equivalent to valid or backend acceptance.
- `valid` means all applicable local checks passed with no deferred obligation.

New public `DeferredCheck` has immutable `path:ValuePath` and reason `server-pattern`.
The pending branch requires a nonempty tuple `checks` and a frozen `parsed:ValueSlot`.
The invalid branch additively exposes optional nonempty `checks`, preserving
obligations even when another mandatory local rule fails. Invalid results without
deferred checks preserve their previous exact shape. Invalid still has no parsed
fallback. No pending result can contain an empty check array.

Nonfatal `PatternDiagnostic` entries have source `pattern`, path, stable code and
safe message. They are distinct from fatal `DefinitionDiagnostic`. Pending and
invalid branches can expose a nonempty `diagnostics` tuple; current deferred pattern
results always include one explanatory diagnostic:

| Code | Meaning |
| --- | --- |
| `pattern-server-only` | explicit server dialect |
| `pattern-unsupported` | outside the approved local syntax |
| `pattern-source-limit` | portable source exceeds 256 units |
| `pattern-prefix-limit` | more than 64 fixed atoms |
| `pattern-repetition-limit` | ordered repetition upper bound exceeds 4096 |
| `pattern-input-limit` | current input exceeds 4096 scalars |

For example, STRING minimum length 5 with value `A` and a server pattern returns
`invalid`, issue `minimum-length`, a retained server-pattern check and a nonfatal
diagnostic. Fixing the length changes that field to pending, not valid. No source,
private value or stable row key is interpolated into messages; paths remain
programmatic typed locations. Envelopes, arrays, entries, parsed slots and detached
path segments are frozen. Caller definitions, patterns, input and choices are not
mutated or frozen.

## Applicability, Unicode and ENUM

Definitions compile independently of presence. A malformed declaration still fails
for optional absence/nullable null. For otherwise admitted definitions, patterns
apply only to present nonnull strings. Optional absence and nullable null remain
valid without pending checks; required absence, prohibited null and non-string
inputs retain their existing local issues with no inapplicable pattern obligation.
Empty and whitespace strings are present values, never guessed absence/null.

Unicode validity is checked independently. Isolated surrogates yield
`invalid-unicode` before matching. Existing server/unsupported obligations remain
attached to those invalid strings. A compiled local pattern adds no server obligation
merely because Unicode itself is invalid. Raw text follows the same supported
checks and remains unchanged; successful pending parsing returns a new lexical slot.

ENUM catalogue validity, exact membership, length rules and choice order are
unchanged. A matching pattern cannot admit an undeclared value; a declared choice
can fail the pattern. Membership/length errors retain any server check. Absence,
null and a declared empty-string choice remain distinct.

## Deferred lifetime, STATE and evidence

Checks describe only the current validation result's input and definition snapshot.
The application owns associating them with current field definitions/revisions,
revalidating after edits and obtaining authoritative server confirmation. Results
do not automatically resolve, survive replacement as acknowledgements, trigger HTTP
or establish backend acceptance. Neither the check type nor this increment adds a
save/session/reconciliation protocol. STATE's snapshots, revision, row keys and
dirty comparison are untouched. Clean/pending, dirty/pending and clean/dirty-invalid
conditions are tested independently.

Pure tests cover compilation, matching, quoting/classes, exact anchors, limits,
Unicode, malformed/unsupported classification, precedence, retained obligations,
immutable private-path evidence and all eleven-type/STATE regressions. A security
test replaces RegExp construction, `.exec` and `.test` with throwing guards while
validating supported and malicious-looking sources; timing alone is not the proof.

The installed-APF FORM/STATE validation testbed adds a supported STRING pattern and
an explicit server-only field. Desktop/mobile tests show local match/mismatch,
pending status distinct from valid, length error plus retained obligation,
correction, lexical persistence, feedback/diagnostic association and theme changes.
Returning to clean leaves the server field pending. No server response or save
button is invented. VALID-009 local matching and deferral are demonstrated; backend
pattern equivalence, confirmation, full raw/absence editors, document aggregation
and successful server-confirmed saving remain open.
