# UI Runtime 1.0 functional and technical contract

AUR-CONTRACT-001 · Target: `@alxarafe/ui-runtime` 1.0.0 · 2026-11-11.

This is the normative target, not a claim about version 0.2.0. Every mandatory
requirement is traced in the [acceptance matrix](ui-runtime-v1-acceptance.md).
Implementation requires separately authorized tasks. This task adds no widgets,
public exports, testbed or consumer changes. MUST denotes a release requirement.

## Inspected baseline and architectural continuity

The base is main `c1869b2d17a19864ac24ccfb7f593af2de172851`, confirmed against remote
main. The following read-only local reference revisions informed this contract;
source inspection is design evidence, not consumer integration test evidence.

| Repository / revision | Inspected sources and consequence |
| --- | --- |
| angular-ui-runtime / base above | `projects/ui-runtime/src/{public-api.ts,theme/theme-definition.ts,theme/theme-runtime.ts,field-types/renderer-context.ts}`, `tests/theme.test.mjs`, `scripts/{pack,consumer}.mjs`, `bin/run`: preserve the extracted runtime and APF boundary. |
| erbas-client / `8d1573c315e03a6edbc92bd7b3d41d851bd54ab9` | `app/src/app/resource-runtime/{fields.ts,resource-form.ts,resource-layout.ts,models.ts}`, `core-fe/themes/themes.ts`, `core-fe/shell/shell-extensions.ts`: reuse layout projection and renderer concepts; do not extract its HTTP models wholesale. |
| erbas-contract / `9d6f4a3035eee9d1bce074b7521dedd34212d823` | `docs/core/resources-001.md`, `openapi/core/resources/contract.yaml`, `openapi/modules/wms/shared.yaml`: exact scalars, independent presence/nullability and published constraint vocabulary. |
| resource-controller / `e7dd6b0edd88ecc82adb0c55504c15d6e3ad53b2` | `src/Trait/ResourceTrait.php`, especially `convertMetadataToComponents()`: existing propagation of required, length, min/max/step, precision/scale and unsigned informs adapter mapping, not a PHP algorithm to copy. |
| solucar-web / `c9dda6a7e8222ba09506577f7b94fded27deac96` | `src/app/core/navigation/navigation-entry.ts`, `src/app/app.routes.ts`, contact and API structure: permissions, routes and transport are application responsibilities. No proposal UI integration is claimed. |
| alixar / `aed4c0a0cca98c0314eafb96c9bc8d4d56c78744` | `docs/proposals.md`, `docs/design/ALIXAR-COM-001-proposal-order-design.md`: header plus ordered editable lines and expected-version replacement provide an independent aggregate scenario. |

The current package contains theme registration/resolution and renderer bindings,
not complete validation, menus, forms, grids or document state. ERBAS
`scalarInput()` already preserves exact numbers, uses BigInt integer range checks,
checks nullability, simple DATE syntax, enum membership and code-point lengths.
It leaves patterns, exact numeric constraints and business rules to the server;
DATE syntax alone does not validate a calendar. The replacement must close these
client feedback gaps without moving HTTP serialization into renderers.
Resource-controller's PHP metadata names are not a new public metadata contract.
Adapters translate published definitions explicitly; `step` means `multipleOf`
only when their semantics actually agree. Missing metadata must not be invented.

## Theme system (THEME)

Preserve `ThemeRegistry`, `ThemeService`, `ThemeResolver` and `provideThemeRuntime`:
immutable sorted registration snapshots, standalone compiled artifacts, validation
of identities/bindings, a complete `default`, sparse or empty overrides and direct
fallback to default. Unknown activation restores default and returns false;
provider compositions remain isolated. There is no inherited override chain.

Every effective theme MUST provide accessible shell structure, navigation, panels,
all 17 field renderers, simple/complex forms and both list and editable tables,
either directly or through fallback. Future form/table composition must reuse the
engine; adding artifact keys requires a documented compatibility decision because
complete-default registration would otherwise break existing consumers.
Themes may change CSS, composition and placement, never field semantics, available
valid actions or effective authorization. Switching MUST preserve raw edits,
validation, dirty state, collection identity/order and pending-save state. State
must live outside replaceable visual component instances; restore logical focus
if a switch replaces the focused control. Unsaved values must not disappear.

Only `default` is a library theme identity. ERBAS identities default, alternative,
cyberpunk, vintage and high-contrast are the initial reference QA compositions,
not new library enum members or promised packaged brands. Each must be exercised,
including CSS-only and structural overrides. Applications own identities and theme
selection persistence. A theme is conformant only if all mandatory capabilities
remain reachable, including fallback navigation and error-bearing hidden tabs.

## Fields and exact editing values (FIELD)

The semantic catalogue is BOOLEAN, STRING, TEXT, INT8, UINT8, INT16, UINT16, INT32,
UINT32, INT64, DECIMAL, UUID, DATE, TIME, DATETIME, ENUM and BINARY. No backend enum
or database type becomes a public dependency.

Keep four separate concepts:

- Immutable field definition: identity, semantic type, label, constraints, choices,
  independent required/nullable flags and editability.
- Current editing value: presence distinct from explicit null, exact scalar and raw
  in-progress input; invalid text is retained, not coerced to zero, null or NaN.
- Validation state: untouched/touched, pending where applicable, errors with stable
  codes and field/row/document paths; unknown server-only validation is not success.
- Renderer presentation/events: context, focus, accessible feedback and edit intent;
  renderers do not serialize HTTP or decide business validity.

Preserve `FieldValue = string | boolean | null`, `context` input, `valueChange`
output and context id, label, value, disabled, readOnly and choices semantics.
BOOLEAN uses boolean; all other semantic values use strings (including exact
integers/decimals and base64 binary); null stays null. Optional context additions
for definition/error references must be additive. Presence and raw BOOLEAN text,
if needed, belong in an editing envelope outside `FieldValue`. A distinct raw-input
event/envelope must be introduced compatibly or explicitly versioned before use;
never silently widen `valueChange` or reinterpret existing values. Invalid numeric
text can already remain a string. Disabled/read-only controls emit no edits, and
neither flag silently deletes values from document state.

No exact value may round-trip through JavaScript Number, parseFloat, valueAsNumber
or Date conversions that lose fractional seconds/time-zone intent. Use exact
integer/decimal arithmetic and lossless adapter JSON encoding/decoding. Preserve
lexical input while editing; explicit successful normalization may reconcile a
canonical value. Presentation localization must not rewrite the stored value.

## Validation (VALID)

Intrinsic integer limits are inclusive and intersect declared constraints:

| Type | Minimum | Maximum |
| --- | --- | --- |
| INT8 | -128 | 127 |
| UINT8 | 0 | 255 |
| INT16 | -32768 | 32767 |
| UINT16 | 0 | 65535 |
| INT32 | -2147483648 | 2147483647 |
| UINT32 | 0 | 4294967295 |
| INT64 | -9223372036854775808 | 9223372036854775807 |

Integer input uses signed base-ten integer text without fractions or exponents;
unsigned types reject negative values. Canonical submission follows the adapter
contract, without precision loss. DECIMAL accepts a documented exact decimal
syntax, including exponent notation when the adapter supports it; reject NaN and
infinities. Compare exact coefficients/exponents, not binary floating point.

Enforce applicable declared minimum/maximum with independent exclusive flags,
minimum/maximum length, precision, scale, positive multipleOf, enum membership and
formats. Equality at exclusive bounds fails. Multiple-of uses exact divisibility,
including fractional and negative operands. Precision limits total decimal digits
of the normalized value expanded without exponent (excluding sign and leading
zeros; zero has precision one); scale limits fractional digits. Trailing fractional
zeros do not change numeric validity: 12.3400 has precision four and scale two,
1000 has precision four and scale zero, and 0.0012 has precision two and scale four. Adapters must verify backend
agreement and declare any stricter lexical/storage limits. Contradictory bounds,
negative lengths, nonpositive multipleOf or unsupported constraint combinations
produce definition diagnostics, never silently relaxed validation. Adapters must
respect declared input-size/digit/exponent limits before expensive exact arithmetic;
the current ERBAS transport bound is 4,096 digits/scale magnitude, not an invitation
to allocate unbounded input. Oversized drafts retain visible feedback.

Required means property presence after application-supplied default policy, not
nonblank. Nullability independently controls explicit null. Empty and whitespace
strings remain valid unless a separate length/pattern/domain rule rejects them.
An absent optional property differs from null; update omission behavior belongs
to the adapter. No implicit trimming or Unicode normalization. Text length counts
Unicode scalar values/code points, not UTF-16 code units, bytes or grapheme clusters:
`😀` counts one, `e` plus combining acute counts two. Reject isolated surrogates.
This follows backend Unicode scalar-length contracts; adapter conformance must
verify the same counting, including supplementary and combining characters.

DATE is valid Gregorian `yyyy-MM-dd` with real month/day/leap-year checking, years
0001–9999. TIME is local `HH:mm:ss` with zero to seven fractional digits for the
ERBAS profile (canonical output seven); no timezone or invalid 24:00/leap second.
DATETIME represents an instant with an explicit Z or numeric offset and valid
calendar/time; retain fractional precision and offset while editing, normalize
only via a lossless declared adapter rule (ERBAS output UTC). UUID accepts canonical
hyphenated UUID text with declared casing policy (ERBAS canonical output); do not
invent version restrictions. ENUM requires an exact declared string; BINARY
requires valid base64 under its declared profile. STRING/TEXT retain exact Unicode.
BOOLEAN rejects string/number coercion. Other API format profiles require explicit
adapter declarations and matching tests, not browser locale guessing.

Patterns must use an explicitly supported dialect/subset and bounded execution.
Never execute arbitrary backend regex blindly in JavaScript. Unsupported syntax,
flags or unsafe patterns report server-only validation and remain pending for
server confirmation; locally invalid values block submission. Supported patterns
must match backend anchoring and Unicode semantics, with adversarial runtime tests.
Client validation is feedback and a submission guard, never authority for domain
rules, authorization or persistence. Invalid drafts stay visible and editable with
field-associated feedback. Saving may succeed only after all local mandatory
checks pass and the backend confirms; backend errors map to paths or a visible
form summary without losing edits. A server-only check cannot be labelled passed
before that confirmation.

## Typed menus and navigation (MENU)

The future public contract must express ordered collections of named menus, with
stable unique menu identity, accessible label and semantic kind: primary,
secondary, account/user. Multiple menus may share any kind; there is no fixed
maximum count. Identity, purpose and placement are separate. Items have stable
identity within their menu, accessible label, ordered children where present and
an opaque application action/navigation reference. Duplicate identities and cycles
are definition errors. Input sequence defines deterministic menu/sibling order;
no theme-dependent sorting. Empty menus may be omitted with no actionable loss.

The adapter supplies effective authorized entries, enabled/current state and
navigation execution, Angular routing and backend metadata mapping. Themes own
placement. Every nonempty valid menu and item MUST have exactly one rendered
location: specialized placement or a mandatory labelled default/overflow region.
Placement bookkeeping must prevent duplication. Unsupported kinds/placements and
many menus use that fallback, never silent omission. Overflow must be discoverable,
keyboard operable, labelled, expose expanded state, and restore focus on close;
all items remain reachable on narrow screens. Links/buttons use correct native
semantics and groups have accessible names. `ShellExtensionRegistry` stays an
independent slot/component extension facility in consumers, not a second menu
registry, navigation data store or implicit replacement for fallback menus.

## Forms and layouts (FORM)

Reuse ERBAS's useful hierarchy: form → ordered tabs → sections → groups → field
references, with root/tab/section contextual actions and a fallback for eligible
unplaced fields/actions. Keep stable identities, first valid placement once,
deterministic order, collapsible sections and explicit selected tab. Reject
malformed definitions; adapters diagnose unknown references and remove unauthorized
entries. Do not append fields explicitly excluded by an application projection.
Absent layout yields a usable simple form. Empty visual containers may collapse;
actions alone must keep their container reachable. No ERBAS HTTP model is imported.

Support read-only and editable modes, immutable-on-update adapter policy, labels,
help and errors, keyboard tabs and reachable contextual actions. Theme layout
changes never alter values, constraints or action semantics. Switching tabs,
collapsing sections or changing mode/theme preserves editing state. Invalid fields
in inactive tabs/sections get a visible summary and a focus/reveal path.

## Collections and editing lifecycle (GRID, STATE)

Read-only/list grids display application-provided rows and navigation; they are
not editable detail collections. Detail collections participate in one parent
editing document. Support add, edit, remove and ordered reorder when declared,
stable temporary row keys, field and row validation, aggregate errors and parent
dirty/valid state. Removing or moving the wrong row after index changes is
prohibited. Read-only cells cannot emit changes. No independent row CRUD request
is required: adapters may save a complete header/lines aggregate atomically.

Track immutable original accepted values, effective edits, raw invalid input,
touched state and nested collection changes outside visual widgets. Clean/dirty
and valid/invalid are independent axes. Returning a field to its original exact
semantic value clears its dirty state; restoring collection contents/order clears
collection dirtiness. Numeric lexical variants may compare equal exactly;
string whitespace, absence and null remain distinct. Invalid changed raw input
is dirty even if its last parsed value equals the original. Adapter equality must
be explicit for temporal normalization and unordered collections; ordered row
changes matter. UI-only focus/tab changes never dirty data.

Saving marks a submitted snapshot as in flight, prevents duplicate submissions and
defines whether further editing is locked or retained. A success reconciles server
values/identities/version with that snapshot, clears only acknowledged changes
and retains later edits if editing was allowed. Save errors/conflicts preserve
all edits and show actionable feedback; conflicts never overwrite automatically.
A response containing only id/version requires adapter-managed read/reconciliation,
not an assumption that it contains a refreshed document.

Discard requires confirmation when dirty. Cancel keeps state/focus; confirm restores
the original accepted snapshot. Angular navigation guards must protect route
changes/back navigation. Register browser beforeunload protection while dirty,
remove when clean; browsers control wording and may suppress prompts, especially
on mobile, so guaranteed recovery cannot be promised. Application actions such as
logout, record replacement, refresh and programmatic workflow transitions must use
the same discard decision before destroying state. The application owns which
actions can discard; the library provides a consistent protection boundary.

## Independent adapters and reference scenario (ADAPTER)

The library owns generic rendering, exact local validation, layout and editing
mechanics. Applications own API decoding/encoding, defaults, persistence,
concurrency, authorization, navigation, business commands and error translation.
No ERP operations, authentication policy, HTTP assumptions, endpoints, database
models or backend-specific metadata enter the public library.

ERBAS adapts published resource metadata and its existing flat CREATE/PATCH CRUD
protocol; immutable/read-only behavior and lossless numeric JSON remain there.
Solucar/Alixar adapts its own APIs and complex documents independently. Its proposal
draft is a mandatory consumer reference scenario: edit header and ordered lines,
add/remove/reorder rows, validate exact quantities/prices, cancel discard, save a
complete draft with optimistic expectedVersion, handle stale-version conflict
without losing edits, then reconcile successful id/version and refreshed data.
Totals, currency/business policy and permission decisions stay in that application.
Alixar replacement can regenerate line IDs, so temporary UI identity must not
assume persistence identity survives. This scenario is not a built-in Proposal
model; source/backend tests do not establish an existing Solucar proposal screen.

## Browser correctness and local QA testbed (VISUAL, PACKAGE)

Version 1.0 requires evidence for the complete lifecycle: definition → rendered
browser UI → real interaction → validation → emitted result. Type correctness,
component probes or screenshot equality alone cannot demonstrate that lifecycle.

A future `apps/testbed/` is authorized solely as a repository-local, non-distributed
Angular QA fixture. Do not implement it in this task. It MUST install/consume the
built APF package through public exports, never private source paths or TypeScript
aliases into projects/. Include deterministic fields (all types/constraints),
multiple menus/fallback, simple/complex forms, list grids and editable nested tables,
all reference themes, fixed data/fonts/locale/timezone and stable screenshot setup.
It runs in ephemeral Docker through the validation workflow, permits real browser
tests and manual inspection, and is excluded from the npm tarball. It is neither an
ERP nor a production/demo application or replacement for consumer integration.
Disposable package-consumer build validation remains separate and isolated.

Browser suites must cover desktop (at least 1280×800) and narrow/mobile (at least
390×844), every reference theme, keyboard-only operation, visible focus,
label/control associations, announced/visible errors, and focus/reveal across tabs.
Review no clipping, accidental hiding or overlap of content, menus, errors or
actions, including long labels and editable tables with intentional accessible
scrolling. Test theme changes with dirty/invalid values and nested rows; many-menu
fallback and complex form save/discard must work under each theme.

Commit screenshot baselines by theme/viewport/scenario. Initial baselines require
explicit human visual review of actual rendered pages, recorded with reviewer,
revision, browser/environment and rationale. Automated comparisons supplement
interaction assertions and manual layout/accessibility review; baseline equality
cannot certify an initially broken design. Updating baselines or weakening tests
merely to pass is prohibited without explicit review and justification.

## Release gate (RELEASE)

`./bin/check` is the single authoritative local validation entry point. Existing
0.2.0 checks cover reproducible lockfile install, strict TypeScript, compiled theme
probes, production APF build, tarball verification and disposable Angular consumer
build; they do not yet run browser or visual suites. Future 1.0 check must aggregate
separate unit/contract, boundary/invalid-input, Angular compilation, browser
interaction, visual regression, package/public-export/peer-dependency and consumer
build suites. Keep `./bin/test` for automated tests and all work in ephemeral Docker.
Validate no testbed/test/dev dependencies or private paths leak into the tarball;
Angular packages remain peers where required. Review API compatibility, versioned
changes, migration documentation and all public documentation against the package.

Cross-repository ERBAS Client and Solucar integration must have separate reproducible
evidence: consumer revision, runtime tarball version/hash, lockfiles, Docker command,
scenarios, results and logs. `./bin/check` must verify the required evidence manifest
for the release candidate; do not mutate reference checkouts or silently skip absent
proof. Consumer builds alone do not prove interaction or aggregate-save behavior.

A release candidate MUST precede stable. 1.0.0 MUST NOT be published until every
mandatory matrix requirement passes, consumer evidence and approved initial visual
references are present, public API/docs are reviewed and all release-blocking defects
are resolved. Passing today's check is not 1.0 approval. Publication, push, PR, merge
and deployment each require separate explicit authorization.

## Remaining implementation design decisions

Separately authorized implementation must settle the additive editing envelope/error
API, safe pattern dialect/runtime and resource limits, form/table artifact evolution,
testbed browser tooling and pinned baseline environment, and the release evidence
manifest/reviewer workflow. These are implementation choices constrained by this
contract, not optional acceptance requirements. Backend-specific precision/scale,
format and equality profiles must be confirmed with consumer conformance fixtures
before declaring parity; undocumented disagreement blocks the relevant requirement.
