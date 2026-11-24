# UI Runtime 1.0 mandatory acceptance matrix

Normative companion to the [functional contract](ui-runtime-v1.md). All rows are
mandatory for 1.0.0, including every listed subcase, one canonical INTEGER artifact
with resolved capacity/constraints, and eleven semantic types. IDs are stable;
future work may append finer-grained cases without renumbering these requirements. Locations marked planned need not
exist yet. Status describes implementation and required QA coverage, not a test result.

`implemented` means present in the inspected baseline with existing coverage;
`partial` means only some behavior exists; `missing` means no library implementation.
Source references in the contract establish design provenance only. Existing tests
are not proof of future suites passing. Browser evidence is limited to the
synthetic foundation in E-QA-001. Approved
visual baselines and cross-consumer evidence do not yet exist. These checks do not
satisfy the 1.0 release gate.
Task-level execution of today's checks is reported with the local commit; it must
not be interpreted as a successful 1.0 acceptance run.

| ID | Precise expected behavior | Boundary and failure cases | Verification type | Test location (planned unless existing) | Current status | Evidence / gap |
| --- | --- | --- | --- | --- | --- | --- |
| THEME-001 | Preserve registry validation, immutable sorted snapshots and standalone bindings. | Missing default/artifact; duplicates; malformed IDs; invalid components. | unit, integration | tests/theme.test.mjs | implemented | Existing registry tests; no browser claim. |
| THEME-002 | Resolve sparse/CSS-only overrides directly to default; unknown activation resets; providers isolate state. | Empty override; all artifacts; unknown ID; two injectors. | unit | tests/theme.test.mjs | implemented | Existing resolution/isolation tests. |
| THEME-003 | Every effective theme covers structure, navigation, 11 fields, forms, tables and accessibility. | Partial override; missing specialized table/navigation; reference themes. | browser, visual | tests/browser/themes/ | partial | Artifact completeness probes and synthetic shell/navigation/panel browser smoke exist (E-QA-001); full functional/reference themes remain unverified. |
| THEME-004 | Switching theme preserves edits, errors, row identity/order, saving state and logical focus. | Dirty invalid field; focused replaced control; in-flight save. | browser | tests/browser/specs/smoke.spec.mjs; planned tests/browser/themes/state.spec.ts | missing | E-QA-001 retains fixture-owned scalar values only; no document-state/error/row/save proof. |
| THEME-005 | Keep application identities separate; version any incompatible artifact/default obligations. | CSS-only application identity; old complete default after artifact addition. | integration, consumer | tests/contracts/theme-compatibility/ | partial | Only generic default exported today; evolution/consumer proof absent. Design/type evidence: E-DESIGN-001 only. |
| FIELD-001 | Support all 11 types listed in contract with exact scalar semantics. | Each type; boolean/null; unsupported type; base64/enum. | unit, browser | tests/contracts/fields/; tests/browser/fields/ | partial | 11 artifact keys and scalar probes exist; widgets absent. Design/type evidence: E-DESIGN-001 only. |
| FIELD-002 | Preserve exact integers, decimals and temporal precision through UI and emitted result. | INTEGER capacity extremes; >2^53; long decimals; seven fractional seconds; offsets. | unit, browser, consumer | tests/contracts/exact-values/; tests/browser/fields/ | partial | String emission probes and exact decimal-text browser input/output exist (E-QA-001); validation, other semantic types and transport proof remain absent. Design/type evidence: E-DESIGN-001 only. |
| FIELD-003 | Separate definition, presence/raw edit, validation and presentation; retain invalid raw input. | Absent vs null; incomplete sign/decimal; invalid BOOLEAN edit envelope. | unit, browser | tests/contracts/editing/; tests/browser/fields/ | missing | No behavioral evidence yet. Design/type evidence: E-DESIGN-001 only. |
| FIELD-004 | Preserve context/valueChange and optional flags/choices compatibly; no edits from disabled/read-only. | Existing renderer compiles; null; additive errors; mode switch. | integration, browser | tests/contracts/renderer-compatibility/; tests/browser/fields/ | partial | Context/binding probes and synthetic labelled, disabled/read-only browser controls exist (E-QA-001); compatibility evolution remains unverified. Design/type evidence: E-DESIGN-001 only. |
| VALID-001 | Enforce exact INTEGER ranges from effective `(bits, signed)` capacity intersected with declared inclusive/exclusive bounds. | 8/16/32/64 signed and unsigned min/max, min−1/max+1, zero, negative unsigned, unsigned 64 maximum, above safe integer, exponent/fraction. | unit, browser | tests/validation.test.mjs; tests/fixtures/validation.type-test.ts; tests/browser/specs/validation.spec.mjs | implemented | E-VALID-001: tested local INTEGER subcases, complete capacity pairs, exact grammar/arithmetic, bounds and correction. No dictionary inference or backend parity claim. |
| VALID-002 | Intersect intrinsic bounds with declared inclusive/exclusive minimum and maximum. | Equality; contradictory limits; extreme decimals; negative operands. | unit | tests/validation.test.mjs; tests/decimal-validation.test.mjs | implemented | E-VALID-001 and E-VALID-DECIMAL-001 cover local INTEGER capacity intersections and exact DECIMAL intervals, including exclusive equality, contradictory bounds, negative fractions and wide exponents. External backend/profile parity remains open. |
| VALID-003 | Validate exact decimal precision, normalized scale and positive multipleOf. | Trailing zeros; 12.3400/1000/0.0012; exponent profile; fractional divisibility; zero divisor; NaN/infinity. | unit, consumer | tests/decimal-validation.test.mjs; tests/browser/specs/validation.spec.mjs; external consumer evidence pending | implemented | E-VALID-DECIMAL-001 demonstrates exact local precision/scale, grammar and fractional divisibility with bounded arithmetic. Backend profile and external consumer conformance remain open; installed APF builds do not establish parity. |
| VALID-004 | Required checks presence independently of nullability and nonblank. | Absent/default; explicit null; empty/whitespace; all flag combinations; update omission. | unit, consumer | tests/validation.test.mjs; tests/decimal-validation.test.mjs; tests/scalar-validation.test.mjs; tests/temporal-uuid-validation.test.mjs; consumer evidence pending | partial | Local tests cover all required/nullable combinations across eleven types. Empty/whitespace remain present and follow type-specific rules. Defaults, omission, editor envelope integration and external consumer conformance remain pending. |
| VALID-005 | Length counts Unicode scalar values with no implicit trim/normalization. | Min/max ±1; astral char=1; combining sequence=2; isolated surrogate rejected. | unit, consumer | tests/scalar-validation.test.mjs; tests/browser/specs/scalar-validation.spec.mjs; external consumer evidence pending | partial | E-VALID-SCALAR-001 implements tested local STRING/TEXT/ENUM length and Unicode semantics, including long text without the numeric work cap. External consumer/backend parity and full editor round trips remain open. |
| VALID-006 | Validate BOOLEAN, exact enum membership and base64 profile. | String true; numeric boolean; undeclared/empty enum; malformed base64/null. | unit, browser | tests/scalar-validation.test.mjs; tests/browser/specs/scalar-validation.spec.mjs | implemented | E-VALID-SCALAR-001 demonstrates local strict booleans, exact ordered enum choices and canonical standard Base64 including unused pad bits. Browser evidence uses explicit raw-BOOLEAN/BINARY text adapters; no backend parity or complete editor capability is claimed. |
| VALID-007 | Validate real Gregorian DATE, TIME precision/profile and explicit-offset DATETIME losslessly. | Leap years; invalid day; 24:00; missing offset; >7 TIME fractions; year bounds. | unit, consumer | tests/temporal-uuid-validation.test.mjs; tests/browser/specs/temporal-uuid-validation.spec.mjs; external consumer evidence pending | implemented | E-VALID-TEMPORAL-001 demonstrates local Gregorian/clock checks, maximum fraction policy, exact instant bounds, ±14:00 offsets and local/UTC year boundaries. Source references inform the profile; external temporal/backend parity remains open. |
| VALID-008 | Validate canonical UUID under declared casing policy without invented version restrictions. | Malformed groups; case policy; valid variant/version texts; nullability. | unit, consumer | tests/temporal-uuid-validation.test.mjs; tests/browser/specs/temporal-uuid-validation.spec.mjs; external consumer evidence pending | implemented | E-VALID-TEMPORAL-001 covers exact canonical grammar, lower/either casing, mixed case, all version/variant nibbles, presence/nullability and lexical preservation. No generation, normalization or external consumer parity is claimed. |
| VALID-009 | Execute only supported safe bounded patterns; show unsupported patterns as server-only pending. | Unsafe repetition; incompatible dialect/flags; anchoring; Unicode; time limit. | unit, integration | tests/pattern-validation.test.mjs; tests/browser/specs/pattern-validation.spec.mjs; tests/fixtures/validation.type-test.ts | implemented | E-VALID-PATTERN-001 demonstrates direct bounded matching, exact anchors, immutable compilation, fatal malformed portable declarations, nonfatal deferred diagnostics and retained checks on invalid fields. External backend equivalence and actual server confirmation remain open. |
| VALID-010 | Invalid drafts remain editable with meaningful associated errors and cannot save successfully. | Invalid hidden-tab field; server rejection; unresolved server-only check. | browser, integration | tests/browser/specs/validation.spec.mjs; tests/browser/specs/scalar-validation.spec.mjs; tests/browser/specs/temporal-uuid-validation.spec.mjs; tests/browser/specs/pattern-validation.spec.mjs; tests/document-validation.test.mjs; tests/browser/specs/document-validation.spec.mjs; submission evidence pending | partial | Field evidence demonstrates focused feedback, distinct pending status, correction, retained deferred obligations and drafts across themes. E-VALID-AGG-001 adds application-owned document summaries, stable row-key paths and retained sibling checks. Complete editors, hidden-tab error reveal, actual server confirmation/error mapping and save blocking remain pending. |
| VALID-011 | Diagnose invalid definitions and map constraints explicitly; backend retains domain authority. | Negative lengths; unsupported combinations; step mismatch; oversized digit/exponent input; permission/business rejection. | unit, consumer | tests/validation.test.mjs; tests/decimal-validation.test.mjs; tests/scalar-validation.test.mjs; tests/temporal-uuid-validation.test.mjs; tests/pattern-validation.test.mjs; tests/document-validation.test.mjs; adapter/consumer evidence pending | partial | Field evidence covers definition/constraint/work-limit diagnostics, invalid lengths/catalogues/profiles, temporal precision/bounds and separate fatal/nonfatal pattern diagnostics. E-VALID-AGG-001 adds structural plan diagnostics and collected fatal sibling diagnostics. Unsupported profiles, adapter mapping, backend conformance, authoritative server checks and business rejection remain pending. |
| MENU-001 | Named menus have unique identity separate from kind and placement; unlimited same-kind menus. | Zero/one/many; two primary, secondary and account menus; duplicate IDs. | unit, browser | tests/contracts/menus/; tests/browser/menus/ | missing | No behavioral evidence yet. Design/type evidence: E-DESIGN-001 only. |
| MENU-002 | Render each valid nonempty menu/item once in input order; diagnose cycles/duplicate item IDs. | Nested children; equal labels; duplicate placement; empty menu. | unit, browser | tests/contracts/menus/; tests/browser/menus/ | missing | No evidence yet. |
| MENU-003 | Provide labelled keyboard-accessible default/overflow for every unspecialized placement. | Many menus; unsupported placement; mobile; open/close focus restoration. | browser, visual | tests/browser/menus/; tests/visual/menus/ | missing | No evidence yet. |
| MENU-004 | Adapters own effective authorization/routing/actions; shell extensions are separate. | Unauthorized omission by adapter; disabled action; current route; slot collision; native/SPA link activation. | unit, integration, consumer, browser | tests/link-activation.test.mjs; tests/browser/specs/navigation.spec.mjs; planned tests/contracts/navigation-adapter/ | partial | E-NAVIGATION-001 proves optional synchronous link interception in installed APF consumers; full authorization/adapters, multi-menu and cross-consumer evidence remain pending. |
| FORM-001 | Support simple default and ordered tabs/sections/groups/field placement/context actions. | Absent layout; duplicate placement; unknown refs; action-only containers; empty groups. | unit, browser | tests/contracts/layout/; tests/browser/forms/ | partial | E-FORM-001 implements public neutral composition, ordered containers, actions and diagnostics; full validation-aware form acceptance remains pending. |
| FORM-002 | Provide fallback for eligible unplaced fields/actions without resurrecting explicit exclusions. | Omitted required field; excluded field; unauthorized action; deterministic ordering. | unit, integration | tests/contracts/layout/ | partial | E-FORM-001 verifies deterministic eligible field/action fallback, exclusions and effective action policy. Full consumer acceptance remains pending. |
| FORM-003 | Read-only/edit modes and layout changes preserve data semantics and edits. | Immutable update; tab switch; collapse; theme change; focused error reveal. | browser | tests/browser/forms/ | partial | E-FORM-001 verifies view lifetime, visual state, read-only suppression and logical focus/reveal; validation, immutable-update and document lifecycle remain pending. |
| GRID-001 | Separate read-only lists from parent-owned editable detail collections. | Read-only cell edit attempt; empty collection; aggregate save without row CRUD. | integration, browser | tests/grid.test.mjs; tests/browser/specs/grid.spec.mjs | partial | E-GRID-001: separate hosts, empty states and suppression; aggregate saving remains STATE/application work. |
| GRID-002 | Add/edit/remove and declared reorder use stable temporary keys and parent state. | New unsaved rows; duplicate values; index shifts; delete then reorder; cancel. | unit, browser | tests/grid.test.mjs; tests/browser/specs/grid.spec.mjs | partial | E-GRID-001: immutable keyed intents and application-owned updates; cancel/discard remains pending. |
| GRID-003 | Field, row and aggregate errors block successful parent save and remain accessible. | Invalid nested row; removed row errors; hidden column; narrow scrolling. | browser, visual | tests/browser/specs/grid.spec.mjs; artifacts/testbed/grids/ | partial | E-GRID-001: responsive scrolling and feedback hooks only; validation, aggregate errors and successful-save blocking remain pending. |
| STATE-001 | Original snapshot and effective edits yield independent dirty/valid state, clearing on reversion. | Revert exact value; lexical numeric equivalent; null vs absence; invalid raw edit. | unit | tests/state.test.mjs | partial | E-STATE-CORE-001: frozen accepted/current trees, derived dirty, exact numeric equality, absence/raw slots and reversion. Semantic validity and validation aggregation remain pending. |
| STATE-002 | Nested add/remove/reorder participate in dirty state and restore to clean on full reversion. | Add then remove; reorder then restore; nested invalid field. | unit, browser | tests/state.test.mjs; tests/browser/specs/state.spec.mjs | partial | E-STATE-CORE-001: nested keyed operations, ordered sequence/unordered multiset equality, reversion and two-collection parent integration across themes. Nested validation and full lifecycle remain pending. |
| STATE-003 | Saving guards duplicates and reconciles only acknowledged snapshot; errors retain edits. | Later edits during save; id/version-only response; regenerated row IDs; retry/conflict. | unit, integration, browser | tests/state/save/; tests/browser/state/ | missing | No behavioral evidence yet. Design/type evidence: E-DESIGN-001 only. |
| STATE-004 | Confirm discard with cancel preserving edits and confirm restoring accepted snapshot. | Clean no prompt; dirty invalid form; nested edits; focus on cancellation. | browser | tests/browser/state/discard.spec.ts | missing | No evidence yet. |
| STATE-005 | Protect Angular navigation and application-triggered destructive state replacement. | Back/route change; logout; refresh; record switch; cancelled programmatic action. | integration, browser | tests/browser/state/navigation.spec.ts | missing | No evidence yet. |
| STATE-006 | Register unload protection only while dirty and document browser limitations. | Clean/unmounted listener; browser suppressed prompt; mobile lifecycle. | browser | tests/browser/state/unload.spec.ts | missing | No evidence yet; prompt display cannot be guaranteed. |
| ADAPTER-001 | Keep transport, business, auth, persistence, defaults and backend metadata outside library. | Metadata CRUD flat PATCH vs aggregate replacement; private endpoints/types leaking exports. | integration, consumer | tests/contracts/adapter-boundary/; consumer evidence | partial | Current public API is independent; future adapter integration evidence absent. Design/type evidence: E-DESIGN-001 only. |
| ADAPTER-002 | Metadata CRUD integration preserves published metadata/scalars/CRUD semantics. | Immutable patch; nullable clear; absent defaults; lossless JSON; server errors. | consumer | separate metadata CRUD evidence manifest | missing | No integration executed in this task. |
| ADAPTER-003 | Complex document integration edits header/ordered lines and handles optimistic version conflicts. | Add/remove/reorder; stale version retains draft; id/version success; regenerated IDs. | consumer | separate complex document evidence manifest | missing | Historical backend/design inspection only; no library-backed complex document screen proof. |
| VISUAL-001 | Test definition→browser→interaction→validation→emitted result for every type and complex scenario. | Invalid intermediate input; successful correction; all reference themes. | browser | tests/browser/specs/smoke.spec.mjs; planned tests/browser/fields/ and tests/browser/forms/ | partial | E-QA-001 renders/interacts/emits through installed 0.2.0 contracts; no semantic validation, all-type or complex-form lifecycle. |
| VISUAL-002 | Version screenshot baselines for every reference theme at desktop and narrow/mobile sizes. | 1280×800; 390×844; long labels; tables; overflow; errors. | visual | tests/visual/baselines/; tests/visual/ | missing | E-QA-001 captures synthetic themes at both sizes; no approved/version-controlled reference baselines or visual comparison suite. |
| VISUAL-003 | Explicitly review initial baselines and actual layout; equality alone is insufficient. | Clipping/hiding/overlap; broken initial baseline; intentional scroll vs inaccessible cells. | visual | tests/visual/reviews/ | missing | No approved review evidence yet. |
| VISUAL-004 | Verify keyboard/focus, labels/control associations and visible/announced errors. | Tabs; overflow; dialogs; focused replaced control; inactive-section errors. | browser, visual | tests/browser/specs/smoke.spec.mjs; planned tests/browser/accessibility/ and tests/visual/ | partial | E-QA-001 checks synthetic labels, keyboard controls, focus and viewport reachability; error accessibility and full audit remain absent. |
| VISUAL-005 | Exercise dirty theme switching, multiple menu fallback and complex editable tables per theme. | CSS-only vs structural theme; invalid row; narrow viewport; save/discard. | browser, visual | tests/browser/scenarios/; tests/visual/ | missing | No evidence yet. |
| PACKAGE-001 | Future apps/testbed consumes built APF via public entry only and is excluded from npm. | Source aliases/private imports; tarball development leakage; deterministic fixture data. | integration | apps/testbed/; scripts/testbed.mjs; scripts/pack.mjs; tests/testbed-boundary.test.mjs | implemented | E-QA-001: isolated installed tarball, public-import boundary test, no TS aliases, package content/development-dependency exclusions pass. |
| PACKAGE-002 | Testbed supports all deterministic field/menu/form/grid scenarios, browser runs and manual inspection in Docker. | Each reference theme; fixed locale/fonts/timezone; no host Node requirement. | browser, integration | apps/testbed/; bin/check; tests/browser/ | partial | E-QA-001: Docker browser foundation and manual preview exist; all-type/menu/form/grid and reference-theme scenarios remain absent. |
| PACKAGE-003 | Validate lockfile install, strict TS/Angular, production APF, exports/peers and package contents. | Bad exports; bundled Angular; missing declarations/license; dev-file leakage. | integration | bin/check; scripts/build.mjs; scripts/pack.mjs | implemented | Existing check pipeline; task execution recorded in local commit report. |
| PACKAGE-004 | Disposable Angular consumer builds installed tarball without private source access or reference mutation. | Clean consumer install; peer resolution; missing public symbols. | consumer | scripts/consumer.mjs; tests/consumer/ | implemented | Existing disposable consumer pipeline; no application integration claim. |
| RELEASE-001 | Single bin/check aggregates separate mandatory suites and validates cross-repository evidence. | Missing browser/visual suite or evidence fails gate; no silent skip. | integration | bin/check; planned release evidence validator | partial | Check includes bootstrap/theme/package/consumer and synthetic Chromium smoke (E-QA-001); visual regression and cross-repository evidence gates remain absent. |
| RELEASE-002 | Require reproducible metadata CRUD and complex document evidence pinned to RC tarball/hash and consumer revisions. | Stale evidence; missing commands/lockfiles/logs; build-only evidence. | consumer | planned release evidence manifest; separate consumer repositories | missing | No release integration evidence yet. |
| RELEASE-003 | Require approved visual references; baseline/test weakening needs explicit review and justification. | Unreviewed baseline refresh; passing broken baseline; removed failure assertion. | visual, integration | tests/visual/reviews/; planned release checklist | missing | No release review evidence yet. |
| RELEASE-004 | Release candidate precedes stable; all mandatory rows pass and blocking defects resolve before 1.0.0. | Missing requirement/evidence; open blocker; stable without RC; current check mistaken for approval. | integration, consumer | planned release checklist/evidence manifest | missing | 1.0 release gate not satisfied; no publication authorized. |
| RELEASE-005 | Review public API compatibility, versioned changes, migration docs and contract consistency. | Existing renderer consumer breaks; undocumented artifact expansion; inaccurate docs. | integration, consumer | tests/contracts/public-api/; planned release checklist | partial | Current API/source inspected; future 1.0 compatibility and release review absent. Design/type evidence: E-DESIGN-001 only. |

## Evidence required to close a row

Record the requirement IDs, implementation revision, exact Docker command,
environment/browser version, test results and retained logs/artifacts. Visual rows
also need baseline revision and reviewer approval; consumer rows need consumer
revision, dependency lockfiles and tested RC tarball digest. Failures and pending
cases remain explicit. A passing unit check cannot close browser/visual/consumer
requirements. Release review must check every row and all subcases, not merely the
number of green suites. Automation and evidence locations beyond the explicitly
implemented foundation
require separate implementation authorization; planned locations remain unimplemented.

## E-DESIGN-001: architecture and compile-only evidence

[AUR-DESIGN-001](../design/ui-runtime-v1-api.md) defines proposed interfaces and
compatibility decisions; [declarations](../design/ui-runtime-v1.types.ts) and
[compile-only assertions](../../tests/fixtures/design-contracts.type-test.ts) are
included in the existing ngc test compilation. They check catalogue/legacy artifact
parity, old context/theme assignability, exact-value exclusions, presence and keyed
paths, validation-result distinctions, nested document shapes and save payloads.
The safe-pattern subset and theme extension policy are design decisions, not
implemented behavior. Implementation statuses above are unchanged. No parser,
validation engine, editing lifecycle, component binding, browser, visual or consumer
compliance is established by these type checks. Runtime evidence gaps remain open.

## E-QA-001: installed-package browser foundation

[QA workflow and human-review procedure](../qa/testbed.md), `scripts/testbed.mjs`,
`tests/testbed-boundary.test.mjs` and `tests/browser/specs/smoke.spec.mjs` establish
only the 0.2.0 infrastructure slice. `./bin/check` builds/installs the real APF tarball,
preserves the separate testbed dependency lock, compiles Angular and runs three
Chromium scenarios at each of 1280×800 and 390×844. They cover registration,
synthetic default/alternative overrides, unknown-ID fallback, scalar input/output
retention, labels, keyboard focus/activation, viewport reachability and browser
console/page/request failures. Package checks exclude the QA app and tooling.
The independent disposable consumer and its lock checks remain mandatory.

Results, archive digest, actual browser version and candidate screenshots are
written under `artifacts/testbed/` by each run. The exact Playwright/image pins are
version-controlled; screenshots are generated evidence, not approved or committed
baselines. Both fixture themes are synthetic, including the one named default:
**no production/reference theme visual acceptance is established**. Human
review is pending; no automatic approval follows from passing smoke tests. Semantic
validation, typed menus, forms, grids, document state, all-reference-theme coverage,
complete accessibility/visual regression and consumer integration remain open.

## E-THEME-CONTRACT-001: independent theme package design

[AUR-THEME-CONTRACT-001](theme-package-v1.md) specifies package metadata,
compatibility, protected complete default, sparse fallback, requested/effective
selection diagnostics and installation/lifecycle obligations. It distinguishes
application bundles, independently distributed pre-start packages and future
unknown-package runtime installation. Only existing registration/selection is
implemented; live catalog mutation, package admission/loading and detailed results
remain future requirements. Pre-mount rejection is distinct from post-mount Angular
failures, for which automatic recovery is not guaranteed.

This is documentary evidence for THEME-001 through THEME-005, ADAPTER-001,
VISUAL-001 through VISUAL-005, PACKAGE-003/004 and RELEASE-005; it closes no row and
changes none of the 53 IDs, implementation statuses or existing evidence. Future
verification must cover manifest/peer rejection, integrity/load diagnostics,
protected-default lifecycle, active uninstall/replace, sparse omission without
warnings, state/focus preservation and the distinct physical-removal boundaries.
No model C loader or remote plugin architecture is implemented or selected.

## E-THEME-PORTS-001: independent structural composition

[Structural ports](theme-composition-v1.md), `tests/structure.test.mjs`, compiled
type probes and `tests/browser/specs/composition.spec.mjs` cover opt-in independent
shell/navigation/panel bindings, owned views, named-region fallback, navigation
intent and retained-node focus in synthetic installed-package compositions. The
original 0.2.0 disposable consumer is unchanged. This supplements THEME-001/002/005
and ADAPTER-001 evidence; it does not close THEME-003/004, MENU, FORM, GRID, STATE or
full VISUAL requirements. All 53 IDs, statuses and prior evidence remain unchanged;
real theme extraction and approved visual references remain pending.

## E-NAVIGATION-001 — Neutral native/SPA links (alpha.3)

These stable subcases refine MENU-004 without renumbering the 53 mandatory IDs.
They cover the existing single-tree port, not the future 1.0 menu engine. Evidence:
`tests/link-activation.test.mjs`, compiled types/ports in `tests/fixtures/structure-components.ts`,
`tests/structure.test.mjs`, and `tests/browser/specs/navigation.spec.mjs` using six
installed APF archives in the Docker Angular testbed at both standard viewports.

| Subcase | Required behavior and evidence |
| --- | --- |
| MENU-004-LINK-001 | No callback/observing callback leaves real href navigation native; no action emission. Query, fragment and external destinations are exercised. |
| MENU-004-LINK-002 | Synchronous cancellation affects the DOM event; consumer-owned history/Back/Forward, Enter and rejection preserve document/edits. Late cancellation is ineffective. |
| MENU-004-LINK-003 | Ctrl/Meta/Shift/Alt, middle/context gestures, target and download stay native with no interception or duplicate request. Linux Chromium exercises Meta; physical macOS/system-menu UX is not certified. |
| MENU-004-LINK-004 | Current/disabled state, group hierarchy/order, labels and Tab/Shift+Tab retain native semantics; action-only entries remain distinct. |
| MENU-004-LINK-005 | Repeated five-theme switches forward exactly one request, preserve application-owned values/DOM/focus and use no router imports. |
| MENU-004-LINK-006 | Legacy ports remain valid without the optional callback; explicit interception requires compiled capability. Exact alpha.3 peers and isolated public APF installations are checked. |

Generated captures in `artifacts/testbed/navigation/` remain pending human review.
No approved visual baseline, complete accessibility audit, permission engine or
real consumer-repository integration is asserted. MENU-001..003 and visual review
requirements remain open; this evidence does not close the full MENU-004 gate.

## E-EXTENSIBILITY-002-R1 — instance-aware optional controls

Corrective revision 001 supplies additive finite-domain/presentation requests in the
existing registry/resolver, preserving fourteen-key registration, legacy calls and
active-theme alternative priority. Engine/boundary evidence is in
`tests/optional-controls.test.mjs` and `tests/rating-configuration.test.mjs`;
`tests/browser/specs/rating.spec.mjs` exercises simultaneous scales, explicit null,
nonnullable fields, blocked events, pointer/keyboard interaction and scoped focus
in installed APF QA at both viewports. See the [contract](optional-controls.md).
This is partial THEME/FIELD compatibility evidence, not completion of field
validation, document state, forms, grids, consumer adoption or visual acceptance.
Captures remain pending human approval; mandatory 1.0 statuses are unchanged.

## E-FORM-001 — public reusable form composition

`composeForm` and `FormComposition` implement the first neutral FORM increment.
`tests/form.test.mjs` and `tests/fixtures/form-components.ts` provide placement,
invalid-input, path/type, renderer-context and same-registry presentation evidence.
`tests/browser/specs/form.spec.mjs` verifies installed public APF behavior at both
viewports, including empty/action-only containers, all action scopes, keyboard tabs,
collapse, fallback/exclusions, read-only events, controlled visual state, reveal and
combined frame/field focus replacement. All five existing theme packages participate
without changes. See the [implemented contract](form-composition.md).

FORM-001..003 remain partial: complete validation/help/error summaries, immutable
adapter policy and document lifecycle acceptance are not implemented. No GRID/STATE
requirement is closed. Captures under `artifacts/testbed/forms/` are candidates,
not human-approved baselines or a comprehensive accessibility audit.


## E-FORM-001-R1 — optional controls and diagnostic non-disclosure

The corrective increment retains legacy form field interfaces and admits a mutually
exclusive optional-control variant through FormFieldDefinition. Unit/type tests in
`tests/form.test.mjs` and `tests/fixtures/form-components.ts` cover admission,
legacy/default bindings, exact values, independent instance requests, ordered active
alternatives and incompatible/unknown rejection. Browser tests in
`tests/browser/specs/form.spec.mjs` cover actual packaged mounting, boolean/null and
large exact strings, reactive domain/presentation changes, renderer/focus retention,
blocked events and all five existing themes. Programmatic diagnostics stay frozen
and include protected references; full DOM/attribute scans verify they are not rendered.

FORM remains partial. The documented zero/one/multiple detail-collection invariants
are future AUR-GRID-001/AUR-STATE-001 requirements, not implementation or acceptance
of grids, editing sessions, persistence or shared saving. No new collection-placement
API is published. Captures remain candidates pending human review.

## E-INTEGER-001 — one canonical INTEGER artifact

AUR-INTEGER-001 aligns the unreleased AUR catalogue with the effective integer metadata
contract candidate. Seven mandatory identifiers (`field.INT8`, `field.UINT8`,
`field.INT16`, `field.UINT16`, `field.INT32`, `field.UINT32`, `field.INT64`) are
replaced by one `field.INTEGER`; no alias or compatibility layer is retained. The
mandatory set is fourteen artifacts: three structural and eleven field artifacts.

The presentation layer does not infer capacity or signedness from the artifact ID.
The consuming application and its adapters supply effective `bits`, `signed`,
`minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum` and `multipleOf`
metadata from the ARP contract. AUR does not implement the ARP dictionary engine or
infer constraints. Rendering an INTEGER and transporting its exact string are not
numeric validation.

`tests/browser/specs/default-theme.spec.mjs` keeps one canonical renderer contract
with table-driven exact-value coverage: negative and positive values, zero, signed
and unsigned 8/16/32-bit boundaries, signed 64-bit minimum/maximum, the unsigned
64-bit maximum `18446744073709551615`, values above the JavaScript safe integer
limit, invalid-looking raw strings and null, plus disabled/read-only event
suppression. `packages/themes/default/tests/default.test.mjs` adds equivalent
compile-free renderer assertions. These tests verify lossless UI transport only;
they make no numeric validation claim. `tests/form.test.mjs` proves the existing
artifact-based form definition accepts `field.INTEGER` and rejects every obsolete
identifier. VALID-001..002 remain missing until a separately authorized validator
implements resolved-capacity and constraint checks with exact arithmetic. This
historical gap is addressed for INTEGER by E-VALID-001 below; DECIMAL remains pending.

## E-GRID-001 — reusable lists and parent-owned detail intents

[Grid composition](grid-composition.md) specifies the published API and exact
boundary. Separate standalone list/detail hosts own semantic tables and accessible
actions. Details reuse form field renderers and the existing theme resolver;
optional `listGrid`/`detailGrid` frames preserve fourteen mandatory artifacts.
Forms place zero/one/multiple collections by typed path, with deterministic fallback
and protected diagnostics. A neutral header/two-collection scenario lives only in
the existing private installed-package testbed.

Unit/contract evidence: `tests/grid.test.mjs`, `tests/fixtures/grid-components.ts`.
Consumer evidence: `tests/consumer/src/main.ts` and the disposable testbed build.
Browser evidence: `tests/browser/specs/grid.spec.mjs`, desktop/mobile Chromium through
`./bin/check`, including five theme packages, frame/renderer focus changes, exact
drafts, stable keys after deletion, independent collections, fallback, synthetic
suppression and horizontal scrolling. Captures: `artifacts/testbed/grids/`.

GRID-001/002 remain partial at the full acceptance level because aggregate save
and cancel/discard require STATE/application integration. GRID-003 has presentation
and feedback hooks only; E-VALID-AGG-001 now supplies field and structural document
aggregation separately, but grid-level error presentation, hidden column handling and
parent-save blocking remain pending. STATE-001..006 remain missing. Screenshot
inspection is task-level QA, not approved/versioned visual baselines or a full
accessibility audit. No external consumer repository or backend integration is claimed.

## E-STATE-CORE-001 — immutable editing core

[AUR-STATE-001-CORE](document-state.md) implements only neutral immutable document
editing and derived dirty state. Pure unit coverage includes defensive snapshots,
exact bounded numeric comparison, absence/raw input, nested/multiple collections,
duplicate multiplicity, permissions, stale targets, revision safety and explicit
in-memory reset. Installed APF browser coverage uses the public FORM/GRID components
with one header and two collections at desktop/mobile sizes across theme changes.
STATE-001 and STATE-002 remain partial. E-VALID-AGG-001 derives semantic document
validity from `state.current` through a separate immutable plan, but that result is
not stored in STATE, does not subscribe to revisions and does not by itself satisfy
the remaining STATE acceptance requirements. STATE-003 through STATE-006 remain
pending. In-memory reset is not confirmation, navigation protection, saving or
reconciliation.

## E-VALID-001 — local exact INTEGER and presence validation

[AUR-VALID-001](integer-validation.md) supplies one framework-independent field
boundary with immutable parsed, invalid and definition-error results. Pure tests
cover all signed/unsigned capacities, exact grammar and arithmetic, presence/null
combinations, inclusive/exclusive intersections, positive divisibility, malformed
definitions, oversized inputs, full keyed paths and STATE compatibility. Compile
contracts exclude unsupported types, partial capacities and Number field values.
Installed-APF browser evidence covers invalid editable INTEGER text, application
feedback, capacity overflow and correction across the five themes plus a structural
frame at desktop/mobile sizes. Local success is not backend acceptance. No external
consumer parity, DECIMAL, aggregate validation, hidden-error workflow or save blocking
is claimed. VALID-003/005–009 remain pending; VALID-002/004/010/011 remain partial.

## E-VALID-DECIMAL-001 — exact local DECIMAL validation

[AUR-VALID-002/003](decimal-validation.md) extends the existing validation boundary,
preserving INTEGER interfaces, diagnostics, presence/nullability and STATE equality.
Independent unit examples cover normalized dimensions, signs/zeros, inclusive and
exclusive intervals, malformed definitions, work limits and exact fractional
divisibility. Fixed-seed generated rational arithmetic provides 256 additional
comparison/divisibility cases. Installed-APF desktop/mobile evidence demonstrates
exact values above 2^53, incomplete drafts, scale/multipleOf feedback, corrections,
theme persistence and dirty/valid independence. Existing INTEGER/STATE regressions
remain mandatory. Only local VALID-002/003 behavior is claimed. Backend parity and
external consumer conformance, other semantic types, document aggregation and save
blocking remain open. Unrelated acceptance statuses are unchanged.

## E-VALID-SCALAR-001 — local text, BOOLEAN, ENUM and BINARY validation

[AUR-VALID-004](scalar-validation.md) extends the same immutable field boundary with
five implemented definitions and shared text-length constraints. Pure tests cover
all presence/nullability combinations, Unicode scalar counts and isolated surrogates,
exact lexical preservation, strict booleans, ordered/unique enum catalogues and
canonical standard RFC 4648 Base64 including all final-sextet pad-bit cases. Invalid
definitions and pattern-bearing constraints fail before absence/null acceptance.
Long inputs demonstrate that numeric work limits are not universal storage limits.
Full nested paths, message privacy, result immutability and STATE independence are
tested alongside numeric regressions. Installed-APF desktop/mobile tests use the
existing FORM/STATE fixture, application feedback and explicit raw-BOOLEAN/BINARY
text adapters across the five themes plus a structural frame. ENUM empty choice and
null remain distinct. This is local evidence only: FIELD-003 status is unchanged;
VALID-007/008/009, external consumer parity, aggregate validation and save workflows
remain pending.

## E-VALID-TEMPORAL-001 — UUID and lossless local temporal profiles

[AUR-VALID-005](temporal-uuid-validation.md) adds four definitions to the same field
boundary, preserving the seven previous types and STATE's lexical dirty policy.
Pure evidence covers Gregorian month/leap/year boundaries, exact clock fractions,
instant equivalence across offsets, rollover, one-tick bounds, profile/definition
diagnostics and immutable keyed paths. Independent anchors and 128 deterministic
clock/offset samples test exact BigInt arithmetic without JavaScript Date. UUID
tests cover casing and canonical shape without version/variant invention. Installed
APF browser tests use public exact-text temporal adapters and the UUID artifact,
show invalid/corrected drafts, seven fractional digits, explicit offsets, associated
feedback and theme persistence at both viewports. Only local VALID-007/008 behavior
is implemented. FIELD-001/002/003, VALID-004/010/011 retain editor, transport,
consumer/adapter, hidden-error, aggregation and save gaps; VALID-009 remains pending.

## E-VALID-PATTERN-001 — bounded local patterns and deferred obligations

[AUR-VALID-009](pattern-validation.md) extends the same field API with explicit
patterns only on STRING/TEXT/ENUM. Unit coverage includes portable literals/classes/
bounded final repetition, exact end anchoring, quoted punctuation, malformed versus
unsupported sources, source/prefix/repetition/input limits, scalar Unicode and
retained deferred checks alongside length/membership errors. Programs/results/paths
are frozen. A guarded test forbids RegExp construction/exec/test while processing
supported and malicious-looking patterns; bounded execution is not asserted only
by timing. All eleven validators and STATE regressions still run, with unchanged
no-pattern shapes. Installed APF desktop/mobile tests distinguish valid, invalid and
pending fields, preserve lexical input and diagnostics across themes, and leave the
server-only field pending even after clean reversion. No HTTP, backend equivalence
or confirmation/save workflow is claimed. FIELD-003 remains incomplete and
VALID-010/011 remain partial while editor, aggregation and server-confirmed saving
requirements are open.

## E-VALID-AGG-001 — recursive document validation aggregation

[AUR-VALID-AGG-001](document-validation.md) publishes `validateDocument` and a
declarative object/field/collection plan. It reuses `validateField` and the existing
immutable `DocumentObject`/`DocumentState` snapshots. Unit evidence covers empty
documents, one/multiple valid and invalid fields, pending and invalid siblings,
fatal field definitions with retained sibling evidence, nested objects, zero/one/
multiple collections, different row schemas, nested collections, keyed reordering,
addition/deletion, duplicate values in separate rows, deterministic sorted property
traversal, all eleven semantic types, local and server-only patterns, invalid raw
drafts, missing/unknown definitions, kind mismatches, malformed plans and row
schemas, cycles detected through empty collections, shared acyclic row schemas,
semantic definition errors inside empty and populated collections without per-row
duplicates, schema paths without invented row keys, excessive depth, malformed
field/equality/input/object/collection/row members, frozen detached results,
caller-definition immutability, message privacy and STATE independence. Type
contracts exclude `DocumentState` as a request document, scalar/heterogeneous row
schemas, unsupported plan kinds and mutable result paths.

Installed-APF browser evidence uses one parent `DocumentState` with a header, a
nested object, two independently identified detail collections and an application-
owned summary. Desktop/mobile tests show an initially pending clean document, an
invalid nested row issue with a stable keyed path, an independently invalid header
field, a retained server-pattern check, row add/remove/reorder with unchanged path
identity, validation changing independently from dirty state, and preservation of
drafts/diagnostics across five packaged themes plus a structural frame.

Only framework-independent local aggregation and structural plan diagnostics are
claimed. Hidden-tab error reveal/focus, application root/row business issues,
heterogeneous row schemas, server error mapping, persistence, submission,
confirmation, reconciliation, navigation protection, mutable caches and save
blocking are not implemented. VALID-010/011 remain partial; GRID-003 and
STATE-001/002 gain related evidence but remain partial/pending for their other
requirements.
