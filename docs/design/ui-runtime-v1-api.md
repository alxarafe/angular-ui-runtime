# UI Runtime 1.0 API and internal contract design

AUR-EDITOR-BINDINGS-001 now publishes [document editor bindings](../contracts/editor-bindings.md)
over the existing session/validation/form/grid APIs. `FieldRendererContext.documentInput`
opts artifact fields into a lossless core bridge and separate typed edit events;
it does not publish the historical `FieldEdit` proposal or change scalar valueChange.
Current projection, accessible feedback and keyed reveal supersede integration gaps
recorded below. Optional-control lossless capability and complete widget/consumer
acceptance remain future work.

AUR-MENU-001 publishes `MenuDefinition`, `MenuItem`, `MenuKind`, `MenuPlacement`,
`MenuSelection`, native-link callback types, placement diagnostics, `snapshotMenus`
and `composeMenus` through the existing shell's opt-in typed-menu mode. The
[operational menu contract](../contracts/menus.md) supersedes the provisional menu
interfaces below: published items use optional `disabled` rather than required
`enabled`; placements use `region` rather than `regionId`. Existing named shell
selectors express placement capability; no `ThemeComponents.menus` entry or second
registry is required. Host-owned default views and overflow retain ownership across
theme replacement. Mandatory artifacts and legacy navigation bindings stay unchanged.

AUR-STATE-SAVE-001 publishes `DocumentSession`, wrapping the existing immutable
STATE core and `validateDocument`. Its [operational contract](../contracts/document-state.md#operational-save-lifecycle-aur-state-save-001)
is authoritative over the older generic session/submission proposals below.
It implements locked editing, validated exact immutable submissions, attempt/local
revision identity, definite rejection/conflict retention, complete authoritative
acceptance with adapter-mapped UI keys, and locked reconciliation/recovery for
committed or uncertain outcomes. Pending checks need explicit adapter confirmation.
It adds no HTTP, version storage or business rules.

AUR-STATE-PROTECTION-001 now publishes `DiscardRequest`, `ConfirmDiscard`,
`DiscardResult`, `DocumentSession.requestDiscard`, `requiresProtection`, `subscribe`,
`NavigationProtection.requestLeave` and the explicit `protectBeforeUnload` browser
port (`BeforeUnloadTarget`). The [protection contract](../contracts/document-state.md#discard-and-navigation-protection-aur-state-protection-001)
supersedes the provisional discard/navigation API below. Confirmed discard reuses
the existing reset primitive, guarded by snapshot/lifecycle identity and save locks.
Concurrent requests are denied, not coalesced into multiple action permissions.
Applications own routing, dialog focus and owner cleanup; no Router dependency or
implicit global listener is introduced.

AUR-VALID-AGG-001 publishes [framework-independent document validation aggregation](../contracts/document-validation.md).
`validateDocument` adds a purpose-built request/result contract and a declarative
object/field/collection plan without changing `DocumentField` or `validateField`.
It reuses typed `ValuePath` stable row keys, retains per-field evidence and applies
`definition-error > invalid > pending > valid` precedence. The aggregate result is
deeply frozen and detached; STATE snapshots, revision, dirty state and row identity
are never modified. Explicit revalidation replaces any previous result. The proposed
session/submission/reconciliation interfaces and application-owned root/row issues
below remain historical proposals; the current save API is described above.
Heterogeneous row schemas are not implemented.

AUR-VALID-009 implements [safe pattern validation and deferred checks](../contracts/pattern-validation.md)
in the existing boundary. Pending is distinct from valid; invalid results retain
deferred obligations additively. Nonfatal pattern execution diagnostics are separate
from fatal definition diagnostics. The malformed-source policy is refined below.

AUR-VALID-005 implements the remaining four [UUID/temporal profiles](../contracts/temporal-uuid-validation.md)
in `validateField`. The eleven-type definition union is now supported only under
the published field profiles; patterns and document-wide validation remain pending.
Temporal bounds compare exact instants/clocks while STATE equality remains lexical.

AUR-VALID-004 adds [local scalar validation](../contracts/scalar-validation.md) for
STRING, TEXT, BOOLEAN, ENUM and BINARY to the same boundary. Seven definitions are
now implemented; temporal/UUID definitions and pattern execution remain unpublished.
Runtime pattern-bearing text constraints explicitly diagnose unsupported validation.

AUR-VALID-002/003 extends `validateField` with [exact DECIMAL validation](../contracts/decimal-validation.md).
The implemented request definition union contains INTEGER and DECIMAL only; decimal
grammar/normalization/comparison are shared with STATE. The provisional broader
catalogue below remains unpublished. INTEGER behavior and result branches are preserved.

AUR-VALID-001 publishes the [local INTEGER validation boundary](../contracts/integer-validation.md).
`validateField` accepts only `IntegerFieldDefinition`, existing `EditingInput` and
`ValuePath`. It returns immutable parsed/invalid/definition-error results. Capacity
requires a complete pair when present. The broader proposed eleven-type definitions,
pending obligations and aggregate validation below remain unpublished.

AUR-STATE-001-CORE publishes the smaller [immutable editing core](../contracts/document-state.md).
It refines the proposed generic tree into one absent/value/raw document model with
explicit comparison semantics and effective capabilities. Original/current snapshots,
neutral operations and derived dirty state are implemented. Proposed FieldEdit
remains unpublished and validation state stays separate; historical session interfaces are
superseded by the operational DocumentSession described above.
The core has no `valid` default; save coordination is a separate wrapper over it.

AUR-GRID-001 now publishes the refined host-owned grid interfaces in
[grid composition](../contracts/grid-composition.md). `ListGrid` and `DetailGrid`
are independent hosts; optional theme grid components are projecting presentation
frames, not document-aware grid replacements. Add requests carry no invented row.
The proposed document/session-aware ports and `DocumentChange` below remain
unpublished. The compile-only theme map follows the implemented frame contracts.

Additive follow-up: [AUR-THEME-PORTS-001](../contracts/theme-composition-v1.md)
implements independent shell/navigation/panel composition for the legacy artifact
layer. It does not publish or redesign this document's proposed menu/form/grid API.

Breaking catalogue update: AUR-INTEGER-001 replaces the seven obsolete integer
artifacts with one `field.INTEGER`, leaving fourteen mandatory artifacts. The
design types below no longer encode intrinsic widths; effective capacity and
constraints remain application-supplied metadata.

AUR-DESIGN-001 · 2026-11-11 · Design baseline:
`cdb830d1aab39338874d18a0e4d958b00d72f5bb` (remote main verified).

This design refines the approved [functional contract](../contracts/ui-runtime-v1.md)
and [acceptance matrix](../contracts/ui-runtime-v1-acceptance.md). It introduces
no runtime implementation, public export, version change or consumer migration.
The complete proposed TypeScript declarations are in
[ui-runtime-v1.types.ts](ui-runtime-v1.types.ts). They are authoritative for this
design; snippets below are explanatory extracts, not a second definition source.
Declarations are compiled by the existing Docker test workflow but excluded from
the production library and npm package. No application should import them.

## Decisions and publication readiness

| Decision | Choice | Publication status |
| --- | --- | --- |
| D1: scalar and renderer compatibility | Keep existing FieldValue/context/valueChange; add only optional context information and an opt-in editing event capability. | Existing public API remains published and unchanged. New capability/context additions need outlet and browser validation. |
| D2: field validation | One local field validation boundary, discriminated definitions, exact text constraints and explicit absence/raw editing. No transport validator in widgets. | SemanticType, bounds, field definitions, paths and issue shapes are candidates for publication after implementation/consumer validation; none exported now. |
| D3: patterns | Small portable ASCII subset with direct bounded scanning; every other backend regex stays server-only. No arbitrary JS RegExp execution. | Policy decided here; implementation, parity and adversarial runtime proof required. |
| D4: editing document | One recursive field/object/collection tree; accepted and editing payloads share the shape. Stable UI row keys. Lock editing during save. | Internal prototype contracts; validate flat and aggregate reconciliation before publishing a session facade. |
| D5: themes | Keep the existing 14 artifact keys and complete-default obligations. Optional new component map in the same registry/resolver, with library defaults. | Proposed extension only; future implementation must validate bindings and compatibility. |
| D6: menus | One ordered data source; primary/secondary/account kinds; identities independent of kind and placement; host-owned overflow. | Definitions are publication candidates; placement/component ports remain provisional until browser proof. |
| D7: composition | Keep ordered tabs/sections/groups and projection semantics; separate list and detail grids; callbacks/commands carry no HTTP. | Layout and component ports require implementation validation. |

“Candidate” means sufficiently specified to guide implementation, not ready to
ship without tests. No new interface is approved for immediate public export.
Avoid a generic plugin system, transport abstraction, observable event bus, backend
schema language or undo/history engine. Angular signals can later expose immutable
snapshots; the domain contracts do not require signals, RxJS or Angular Forms.

## Source review and reusable code

The current theme definitions/runtime and renderer context were read before this
design. Theme registration already freezes snapshots, validates standalone/binding
metadata, resolves sparse overrides directly to default and isolates providers.
Keep that implementation rather than create parallel selection or theme registries.

Historical reuse analysis and immutable source revisions are retained in
[engineering provenance](../history/engineering-provenance.md). They are design
evidence, not normative dependencies on external applications.

Preserve semantic/artifact catalogue parity, guarded exact-string events, Angular
inputBinding/outputBinding, replacement only on component type changes and embedded
view ownership outside replaceable shells. Extend logical focus and raw editing
with browser proof. Empty enum strings must remain distinct from null.

Use one exact validator; retain integer grammar/ranges and Unicode scalar counting.
Lossless JSON remains adapter-owned. Changed-effective-value submission must compare
original/current values, not rely on a changed set. Preserve first valid layout
placement, ordered hierarchy, fallback and keyboard tabs with neutral references.
Extension slots and legacy navigation bindings are not typed menu storage.
Adapters map required, length, bounds, precision/scale and unsigned explicitly;
`step` and `multipleOf` are equivalent only when semantics agree. No external
component DTO or backend validation algorithm becomes a public library contract.

## Fields, input and validation boundary

`SemanticType` derives the 11 types from `FieldArtifact`. `IntegerType` is the one
canonical `INTEGER`; it does not encode a width or signedness. Effective integer
capacity (`bits` 8/16/32/64 and `signed`) and exact constraints come from the
consuming application and its metadata adapters; `IntegerCapacity` and
`ResolvedIntegerRange` are data shapes, not an inference engine. Obsolete seven-type
integer identifiers are absent. `FieldDefinition` is a discriminated union. BOOLEAN
has no numeric constraints; INTEGER accepts optional effective capacity plus exact
bounds/multipleOf; DECIMAL adds precision/scale and exponent policy; STRING/TEXT and
ENUM accept scalar-length and pattern constraints; ENUM requires choices; temporal
fields accept exact temporal range bounds. UUID/date/time/binary
specify profiles rather than arbitrary format names.
FractionalDigits is an integer 0..7 initially; other profiles need separate review.
Read-only is effective state supplied by the adapter; immutable-on-update and
default application are adapter policies, not intrinsic field rules.

```ts
// Extracts; see the compiled declarations for the complete interfaces.
type ValueSlot =
  | { readonly kind: 'absent' }
  | { readonly kind: 'value'; readonly value: FieldValue };
type EditingInput = ValueSlot | { readonly kind: 'raw'; readonly text: string };
```

`ExactText` deliberately aliases string, not a misleading “validated” brand.
Definitions and values need runtime validation after decoding; TypeScript cannot
prove numeric syntax, range, positive limits, unique IDs or applicable constraints.
Constraint counters (length, precision, scale) and local revision counters may use
safe integer Numbers; exact data/bounds/multipleOf never do. Reject invalid,
nonfinite or unsafe counters as definition issues instead of rounding them.

A value slot is a parsed candidate, not a validity certificate. Required checks
absence, nullable checks explicit null. Raw text can be syntactically incomplete;
its last valid parsed value must never be substituted during submission. A numeric
renderer may keep '-' in the legacy string value; the new editing channel explicitly
represents raw input for all controls. Invalid BOOLEAN text belongs in raw input,
not in an implicitly widened scalar union. Missing optional fields are represented
as absent slots, not dropped UI controls or undefined/null coercion.

There is one future `ValidateField` boundary. FieldValidation has parsed presence
for valid/pending outcomes and nonempty issues for invalid outcomes.
FieldEdit.validation uses FieldValidation: valid and pending field edits require
their parsed ValueSlot, while invalid field edits expose issues without a parsed
success result. DocumentSnapshot.validation retains aggregate ValidationResult.
Pending means locally parsed with deferred server checks; it is not confirmed
validity. Aggregate
ValidationResult uses invalid before pending before valid. Keep deferred checks per
field so fixing a different error does not lose server-only obligations.

ValidationIssue paths use property names and stable row keys. Empty path identifies
the document, a path ending in row identifies row errors, and a field path identifies
a control. Never use array indexes or dotted strings that confuse property names
with traversal. Issues carry local stable codes or namespaced application codes,
source and human-readable message. Applications translate/localize backend errors;
unknown paths become visible document errors rather than disappearing. The issue
union ties source to its code namespace; decoded issues still need runtime
validation and safe plain-text rendering.

### One exact validation pipeline, implemented later

1. Validate the definition and resource limits, then presence/nullability/type.
2. Parse integers with the exact base-ten grammar/range approach using BigInt.
   Compare the contract's signed/unsigned intrinsic limits and intersect declared
   inclusive/exclusive bounds; reject fractional/exponent integer input.
3. Parse decimal text into an exact integer coefficient and bounded exponent/scale.
   Normalize fractional trailing zeros for equality/precision checks without
   rewriting the raw input. Compare aligned exact values and test multipleOf by
   integer arithmetic. Reuse one exact arithmetic implementation for all numeric
   constraints; do not use parseFloat or create adapter-specific validators.
   No decimal dependency is chosen before correctness/size review. The approved
   12.3400, 1000 and 0.0012 precision/scale examples remain mandatory.
4. Count Unicode scalar values, reject isolated surrogates; no normalization or
   trimming. Test combining/supplementary characters against backend fixtures.
5. Validate real calendar dates, local time, explicit-offset instants, UUID, enum
   and base64 profiles. Do not round-trip through Date or browser valueAsNumber.
6. Compare temporal bounds losslessly in the declared profile (instant comparison
   across offsets, not lexical offset-text order). Apply the supported pattern
   policy below and return errors/deferred checks.

Backend authority remains unchanged. The adapter supplies transport limits (the reference
profile uses 4,096 digits/scale magnitude) before costly arithmetic. Shared library
implementation must bound parsing work and reject or visibly defer unsupported
profiles; numeric dependency and detailed limit API remain internal implementation
choices. No runtime validator, arithmetic routine or copied backend algorithm is
introduced by this task.

### Safe-pattern policy: portable-ascii-v1

Choose a deliberately small language suitable for code fields, not a generic regex
engine: strict whole-input `^...$`, a fixed prefix of printable ASCII literals or
positive ASCII character classes, followed optionally by one final character class
with `{m,n}`. Fixed atoms consume exactly one scalar each. Character classes accept
literal ASCII characters and ascending ASCII ranges; no negation/intersection.
Escapes only quote otherwise reserved ASCII punctuation. No groups, alternation,
lookaround, backreferences, dot, shorthand classes, flags, `*`, `+`, `?` or nested
quantifiers. Require 0 ≤ m ≤ n ≤ 4096, source length ≤256 and fixed prefix ≤64 atoms.
A final repeated class can consume only the suffix, so matching is a bounded direct
scan with no backtracking or dynamic RegExp. Exact end means no trailing newline.
Examples: `^[A-Z][A-Z0-9_]{0,29}$` is supported; `^(a+)+$`, `\p{L}+`, unanchored
expressions and ambiguous regex dialects are server-only.

The adapter marks a source portable only after proving whole-input/ASCII semantics
match its backend (some regex `$` operators accept a final newline). The implemented
compiler independently checks this subset. AUR-VALID-009 refines the earlier
“unsupported/malformed sources defer” wording: malformed metadata and confidently
malformed portable fragments (unclosed positive classes, descending ranges, invalid
escapes or broken/reversed bounded counts) are fatal definition errors. Sources
outside the grammar or local work profile defer with a nonfatal diagnostic and
server-pattern check; they are not passed to a general regex parser to certify
the remainder. This conservative classification does not silently reinterpret a
malformed portable declaration as another dialect. The exact grammar and precedence
are specified in the [pattern contract](../contracts/pattern-validation.md).
Locally supported mismatch is invalid. Above 4,096 input scalars defer that pattern,
preserving independent local errors and their deferred obligations; do not invent
a global text field limit. Do not execute backend regex in a widget. Local safety
and parser behavior now have bounded/adversarial tests, but backend equivalence and
authoritative confirmation remain separate consumer obligations.

## Renderer compatibility and change notifications

ProposedRendererContext extends the old context using only optional definition,
editing, path and describedBy members. Existing contexts/renderers compile unchanged.
Do not alter `FieldValue`, `FIELD_RENDERER_BINDINGS`, or required context/valueChange
bindings. Definition/editing input carry semantic state while context.value is a
legacy presentation bridge, not a second source of truth.

An EditingRenderer still implements FieldRenderer (including valueChange) and
additionally exposes editChange. A new outlet detects that output in Angular
compiled metadata and subscribes to exactly one channel. Modern renderers emit
editing intent and may emit legacy projection for an old outlet; the new outlet
ignores that legacy output. Legacy renderers emit valueChange and the outlet wraps
it in a value slot. Neither renderer channel performs HTTP or accepts edits while
disabled/read-only. Old outlets do not bind editChange, so advanced raw/presence
capabilities require the new outlet; no claim of full 1.0 behavior in old consumers.

If both context.editing and context.value exist, editing wins. Absent/raw input
that an old renderer cannot faithfully represent must use the new default renderer
or a compatible adapter wrapper at the outlet; retain draft state outside it and
show associated errors at the field host. Never coerce absent into an actual null
save. Capability checks and the accessible legacy wrapper need implementation and
browser proof before publication. Focus/help/error DOM ownership stays at that host.

## Document state, collections and saving

`DocumentNode<T>` has field, object and collection branches. Accepted/original trees
use ValueSlot; current trees use FieldEdit (including immutable field definitions).
Objects use fixed property names; collection rows have stable, nonempty UI keys
unique within a collection, values are objects and may contain nested collections.
Rows are held in sequence; ordered controls whether reordering affects semantics.
No server IDs, versions, API records or business operations are required by this tree.
All accepted/current snapshots must be immutable copies; readonly types alone cannot
freeze or validate a decoded object. Definitions may share immutable references.

Maintain one source of editing truth; dirty, validation summaries and save state
are derived/controlled snapshots, not independently mutable public booleans.
Compare original and parsed current slots by semantic type: exact numeric equality,
exact text/boolean/null/presence equality, and declared lossless temporal normalization.
Invalid changed raw input is dirty; preserve raw input independently from accepted
values. Removed rows compare against the original; add then remove clears dirtiness;
restoring row values/order clears it. UI keys identify controls/errors, not data:
changing a key alone must not dirty
a document. Ordered collections compare effective row contents in sequence; unordered
collections compare an exact multiset of effective row contents, preserving duplicate
counts. Restoring equal contents/order clears dirtiness even after remove/add. If a
server row identity matters semantically, the adapter includes it as a field value.
Touched/focus/tab changes do not dirty the document.

DocumentChange is the minimal editing command union: field, add-row, remove-row,
move-row (before a key, or null for end). Definitions gate editability and structural
permissions; reject stale paths/keys, duplicate keys and reorder on unordered or
nonreorderable collections without mutating state. An inserted row is application-
prepared with neutral field definitions/default policy. No automatic row CRUD occurs.
ListGridContext is read-only with row selection; DetailGridContext addresses a
collection inside the parent document, exposing effective add/remove/reorder flags.
Parent validation aggregates field, row and root issues; application rules arrive
as application issues without registering a business-validation plugin engine.

### Submit/save protocol

Choose the simplest safe initial concurrency policy: lock editing and structural
changes during saving and reconciliation. No background merging of edits made
in flight, no autosave or undo requirement. This satisfies the contract's explicit
choice of lock-or-retain; later support for concurrent editing would require a
separate design. Other UI navigation still uses the protection boundary.

SubmitResult.ready contains a frozen Submission with a unique attempt ID, local
revision, exact parsed values and deferred checks. It is readiness for adapter
submission, not backend acceptance. Invalid definitions/values or busy state block
submission; pending server-pattern checks may be sent to the authoritative backend
but remain pending until confirmation. The library never calls HTTP. The adapter
uses the snapshot to derive flat changed-field PATCH or a whole aggregate command,
keeps optimistic concurrency tokens outside the document and maps the outcome back.

| Outcome | Required transition |
| --- | --- |
| Matching accepted result with full normalized accepted tree | Reconcile UI keys, set original/current to accepted values, clear touched/errors/dirty and return idle. Server normalization is explicit, not keystroke coercion. |
| Rejected validation/domain/transport error or conflict | Keep draft and original values, unlock, show mapped path/root errors; conflict is visible and never overwrites automatically. |
| Save committed or outcome uncertain but accepted values cannot be established | unreconciled → reconcile-error; retain draft, show recovery action and block resubmission until adapter resolves outcome/readback. Do not report clean or blindly retry a possibly committed write. |
| Response attempt differs from active submission | Ignore as stale; never reconcile another document/session or clear its edits. |

A successful id/version-only response is insufficient for accepted: adapter reads
back or reconstructs an authoritative full snapshot if its protocol permits that.
If complex document replacement regenerates line IDs, adapter maps new server data to submitted UI
row keys/order and existing field definitions before returning accepted. Unknown
structural fields/rows require an explicit session reinitialization after readback,
not an untyped reconciliation guess; old error paths must be cleared/rebound.
Its totals/business policy and
expectedVersion remain application-owned. A metadata CRUD adapter can build its partial payload by
comparing original and current, skipping immutable/read-only unchanged fields.
A no-op is clean and should not send an empty update unless the adapter protocol
explicitly needs it. Rejected issues clear/revalidate only when their paths change
or an explicit validation retry occurs; never label a backend rejection locally valid.

DiscardRequest captures revision/reason. ConfirmDiscard is the application-supplied
accessible dialog boundary; NavigationProtection.requestLeave is the reusable
async decision used by Angular guard adapters and programmatic application actions.
Clean documents allow immediately; dirty ones require discard/cancel. Recheck revision
and saving state after the dialog resolves; a stale confirmation cannot discard
new edits. While saving/reconcile-error, block destructive leave until the adapter
settles/reconciles or provides an explicit recovery decision; do not race an in-flight
save with reset. Browser beforeunload uses a separate synchronous dirty/busy check,
not an async dialog, and has browser-controlled/sometimes suppressed behavior.
No Router, Window, auth policy or persistence dependency enters the state core.

## Compatible theme evolution and composition

Do not add menus/forms/grids to ThemeArtifact or THEME_ARTIFACTS. That would make
existing complete defaults incomplete and break registration. D5 instead
proposes optional `components?: Partial<ThemeComponents>` on theme definitions and
`resolveComponent(key)` on the existing ThemeResolver. Existing resolve(artifact),
ThemeRegistry rules, ThemeId, CSS class, provider composition and return values stay
unchanged. No second registry or component plugin lookup service is introduced.

Future registration validates/freeze-copies the optional map (known keys, compiled
standalone components, context input and appropriate outputs) in the same registry.
provideThemeRuntime supplies compiled library default implementations for the four
new component keys; application themes are never required to add these entries.
No defaults are shipped by this task. Resolution is current theme component override
→ application default theme component override → library component default.
This is an optional component layer; existing artifacts still use exactly their
current one-hop fallback. New component implementation must not be imported into
an old theme's required override map. Bindings are given by ThemeComponents' four
component ports; registry metadata checks supplement, not replace, TS and browser
validation of actual behavior.

Form/menu/grid defaults compose existing resolved field/navigation/panel artifacts
where compatible. The runtime host owns document session and embedded feature views,
not theme component constructors. Replace only visual instances when the resolved
component changes; CSS-only selection does not recreate content. Reproject owned
views and restore focus by logical field/path after structural replacement. Default
forms supply error summaries and reveal paths even when a theme omits specialization.

### Multiple menus, legacy shells and mandatory fallback

MenuDefinition has an ID, label, kind and ordered items. Multiple same-kind menus
are normal, and menu counts are unbounded by contract. IDs within each menu's whole
item tree are unique; children preserve sequence and cycles are rejected. Branches
can group children with no action; leaves require an action or href at runtime.
An adapter-supplied href permits native link semantics; actions use buttons.
Applications validate target schemes and own routing/interception. Ordinary link
activation that can discard the active document goes through the same leave decision;
modified clicks retain native browser behavior. Disabled entries cannot dispatch. Selection emits menuId/itemId; the application resolves
action/navigation and authorization. No route or permission syntax is imported.

MenuPlacement is a visual region assignment for a menu ID. The host owns placements
and one collection of effective menu data; themes offer regions/presentation,
not replacement menu data. A menu is assigned to at most one mounted region;
unknown/unmounted/conflicting placements go to the accessible default region with
a diagnostic. Input sequence always determines menu/item order. The host renders
unclaimed menus in a labelled keyboard-operable overflow outside replaceable shell
content, and removes the old placement before rendering another. No duplication
between a specialized region and fallback. Visual hiding cannot be detected by
types; browser/visual acceptance must verify visibility and keyboard reachability.

Legacy Shell/Navigation artifacts know a single navigation/items list and
cannot be assumed to expose typed-menu regions. They remain valid unchanged in
legacy mode. New typed-menu mode uses the host-owned default menu component unless
an explicitly capable theme participates; do not also inject the same entries into
the old single-list navigation binding. Applications choose legacy or typed-menu
input per host, with diagnostics if both are supplied. Host fallback does not rely
on a legacy shell honoring a new input. ShellExtensionRegistry remains exclusively
for component slots, and is neither a menu store nor an escape hatch from fallback.

### Forms and grids

FormLayout keeps ordered tabs, sections, groups and contextual actions. ValuePath
references replace application field/HTTP model references. The host resolves these against
the document, places each eligible field/action once and supplies fallback for
unplaced entries; application-excluded fields are not resurrected. Invalid references
produce diagnostics. Selected tab/collapse/focus are UI state held outside replaceable
components. Keep contextual action identity/effective enabled state and emit intent;
authentication/availability/business policy remains in the adapter.

FormComponent and DetailGridComponent emit DocumentChange to the same parent session.
ListGridComponent only selects a row. GridColumn.field initially addresses an immediate
row property; deeper structures use groups/nested collections instead of a new query
language. New component ports and placement mounting details need implementation
validation; no generalized component framework is required.

## Evidence, compatibility risks and remaining questions

[Compile-only assertions](../../tests/fixtures/design-contracts.type-test.ts) check
catalogue parity, exact-value exclusions, parsed/invalid result distinctions,
explicit absence, keyed paths, flat/nested shapes, same-kind menus, complete accepted
save payloads, readonly snapshots and assignability of old/new renderer/theme types.
They also pin the legacy artifact union. `@ts-expect-error` assertions fail compilation
if the invalid assignment becomes accepted. They run through ngc in `./bin/test`
and `./bin/check`; they are not runtime or browser tests and do not prove parser,
regex safety, dirty tracking, bindings, visual correctness or consumer compliance.

The acceptance matrix records this design evidence only, keeping implementation
statuses unchanged. Stable IDs and release gates remain in force.

Material risks requiring later behavioral tests:

- Angular binding reflection does not validate actual event payloads; capability
  discovery and optional context assignability need compiled component/outlet tests.
- Old renderer null/empty handling and browser native date/number controls may lose
  intermediate input; the host wrapper/default renderer must preserve raw state.
- Optional component map and library defaults must remain tree-shakeable and isolated
  per provider composition; no new required peer dependency is introduced here.
- Exact numeric/temporal profiles and portable pattern equivalence need backend
  fixtures; no cross-consumer compatibility is claimed from structural TS tests.
- Aggregate readback failure and regenerated row IDs must not produce duplicate
  saves, stale errors or lost edits.

Unresolved implementation choices: concrete decimal arithmetic reuse/dependency,
resource-limit configuration without public API overgrowth, Angular host/region
mounting and legacy field-wrapper details, browser baseline tooling, and release
manifest/review tooling. None allows relaxing mandatory acceptance. Pattern grammar,
saving lock policy, exact representation, error path identity and unchanged legacy
artifact obligations are decided by this design. A future authorized task may refine
provisional interfaces with recorded compatibility analysis before exporting them.

### Implemented optional-control extension

[AUR-EXTENSIBILITY-002](../contracts/optional-controls.md) implements an additive
finite-domain control map in the existing registry/resolver. It does not implement
or export the proposed ThemeComponents form/menu/grid layer above. Legacy fourteen-key
registration and resolution remain unchanged; optional control fallback searches
compatible active-theme alternatives before default representations.

Corrective revision 001 adds `ControlRequest` and optional renderer capabilities for
per-instance resolution. `FieldRendererContext.control` is optional; old renderers
and `resolveControl(id)` remain valid. A control's registered finite domain is its
legacy default, not a universal field scale. The implemented finite-domain limits,
capability trust boundary and future interval extension point are specified in the
[optional-control contract](../contracts/optional-controls.md).


### AUR-FORM-001: implemented host-owned composition

The [form-composition contract](../contracts/form-composition.md) publishes the first
form host, a pure placement function, separate renderer contexts, ValuePath-compatible
references and visual state/reveal ports. The existing registry/resolver now implements
only the optional `form` component key. It resolves active → application default →
core frame without adding to the fourteen required artifacts.

This refines D5's unpublished form port: `ThemeComponents.form` is a projecting
`FormPresentation`, while the persistent `FormComposition` host owns navigation and
field views. The proposed whole-document `FormComponent` and document changes remain
unpublished. The compile-only design types reference the published presentation port
to retain old/new theme assignability; other proposed component keys remain pending.
Published layout action references need only IDs; effective labels/enabled states
come from the independent application-supplied action catalogue. Existing proposed
ContextAction references remain structurally assignable. No document-state API,
semantic validator or grid proposal is implemented by this increment.


### AUR-FORM-001-R1: optional fields and diagnostic privacy

The [form contract](../contracts/form-composition.md) now admits an additive field
union: legacy artifact fields or discriminated optional-control fields. Selection
and renderer context derive from one effective instance request through the existing
registry/resolver. Legacy FormField remains an interface; composed field lists admit
both variants. Reactive request changes may replace a renderer while retaining
application data and scoped logical focus. No new required artifact is introduced.

Placement diagnostics retain their programmatic frozen structure but are no longer
rendered, including raw IDs, paths, excluded references and ARIA/hidden diagnostic
content. Consumer-owned debug surfaces must likewise avoid protected DOM disclosure.

Future detail composition supports zero/one/multiple independent collection identities
and typed ValuePaths, with no first-detail convention. Collections may be placed in
different tabs, sections or groups; columns, rows, effective permissions and editing
capabilities may differ per collection. One logical document can supply a shared
parent session and save operation across its collections, while independent resources
may retain independent lifecycles. AUR-GRID-001 owns rendering/editing implementation;
AUR-STATE-001 owns the shared state boundary. This is an invariant, not a new collection
placement interface. Preserve an additive path/layout extension point and validate a
concrete placement design through implementation before publishing it. Neither grids,
collection editing, persistence nor document state is implemented by this correction.
