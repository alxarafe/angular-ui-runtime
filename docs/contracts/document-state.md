# Immutable document editing core (AUR-STATE-001-CORE)

This increment exports framework-independent functions and readonly data types from
`@alxarafe/ui-runtime`. The state modules have no Angular runtime dependencies.
They own accepted and current values, editing operations, revision and derived dirty
state only. They do not implement validation, persistence, reconciliation, undo,
navigation protection or user-confirmed discard.

## Model and public API

`DocumentNode` is a recursive union of `DocumentField`, `DocumentObject` and
`DocumentCollection`. Objects have fixed, named `properties`; collections have
`DocumentRow[]`, each with a nonempty unique `key` and an object `value`. Nested
objects and collections use the existing `ValuePath`: property segments traverse
objects and row segments select stable keys. Positions never identify rows.

A field contains `equality: FieldEquality` and `input: EditingInput`:

- `ValueSlot` is `{kind:'absent'}` or `{kind:'value', value: FieldValue}`.
- `EditingInput` additionally admits `{kind:'raw', text:string}`.
- `FieldValue` remains exactly `string | boolean | null`. Neither an absent slot
  nor a raw draft is coerced into a scalar value.
- Equality is explicitly `{type:'exact'}`, `{type:'INTEGER'}` or
  `{type:'DECIMAL', allowExponent:boolean}`. These describe comparison only, not
  a second field definition/constraint or validation engine. All other semantic
  types, including temporal values, use exact lexical equality in this increment.

Every node may carry effective `readOnly` and `disabled` flags. They block edits
through that node, including nested descendants. Collections also require explicit
`ordered`, `allowAdd`, `allowRemove` and `allowReorder` booleans. Structural operations
check the collection's capabilities; per-field flags prohibit field changes, not
removal of an otherwise removable containing row. Applications supply effective
permissions and keep rendering contexts aligned with them; this is not an
application authorization engine.

`createDocumentState(document, initialRevision = 0)` defensively snapshots the tree
into independent, deeply frozen `original` and `current` documents. The original
may contain absent/value slots but not raw drafts. Structural admission does not
certify numeric syntax or semantic validity. Accepted values remain the caller's
responsibility. All metadata, property maps, rows, arrays and inputs are copied.
Plain objects only, cycles, malformed nodes/flags/keys and unknown model members
are rejected. Nesting is bounded to 128 edges. Empty objects/collections are valid.

`DocumentState` exposes only `original`, `current`, `revision` and `dirty`. State
instances are opaque at runtime: operations require a state returned by this core,
not a reconstructed object or JSON copy. Create a new state from an explicitly
accepted document when initializing another editing lifetime. No save or validation
state, touched flags or speculative session facade is published.

`applyDocumentChange(state, change)` returns a new frozen state with the same
original document. It admits these `DocumentChange` variants:

| kind | Data | Effect |
| --- | --- | --- |
| `field` | `path`, `input` | Replace a field's absent/value/raw input. |
| `add-row` | collection `path`, prepared `row` | Append a defensively copied row; caller supplies key, values and comparison/capability metadata. |
| `remove-row` | collection `path`, `key` | Remove exactly the keyed row. |
| `move-row` | collection `path`, `key`, `before: string \| null` | Move before an existing key or to the end. Requires an ordered, reorder-enabled collection. |

A move before itself is a permitted no-op. Unknown properties, malformed paths,
stale keys, duplicate/missing keys, wrong node targets, missing prepared rows and
prohibited operations throw without altering any previous state or advancing its
revision. An add request never invents a row or defaults. Inserted object shapes
and their effective metadata are application-prepared, not inferred from existing
rows. The core is a neutral tree, not a schema validator.

`resetDocumentState(state)` explicitly restores the accepted snapshot, including
its keys, ordering and lexical inputs. It is an in-memory primitive, **not** a
user-confirmed discard workflow. Calling code must obtain whatever authorization
its future lifecycle requires. Original and current may share frozen subtrees after
operations/reset; no mutable objects are shared with caller input.

The revision counts successful operations, including clean lexical edits, no-ops
and resets. The optional starting revision must be a nonnegative safe integer.
Advancing beyond `Number.MAX_SAFE_INTEGER` throws, including on reset. Revisions
are local counters, not server versions. There is no history or mutable dirty flag.

## Exact equality and dirty state

Dirty is derived from a recursive effective-content comparison of original/current:

- Absence, null, empty string, whitespace and booleans/text are distinct.
- Raw drafts retain their exact text and remain distinct from scalar slots,
  including mathematically equivalent text. No last-parsed-value fallback exists.
- Numeric value slots compare by exact mathematical value when both lexical forms
  can be safely interpreted under the same explicit comparison semantics. The
  current spelling is retained; comparison never normalizes the stored draft.
- Uninterpretable numeric values use exact lexical identity only. Different unsafe
  or invalid spellings are never assumed equivalent. Unchanged invalid text can be
  clean without being valid. Dirty and validity are independent.
- Ordered collections compare effective row contents in sequence. Unordered
  collections compare multisets, preserving duplicate multiplicity. Their array
  permutations alone do not dirty the document, but imperative moves are rejected
  for unordered collections. A caller can restore effective contents through
  remove/add operations with new UI keys.
- UI row keys and capabilities are not data equality inputs. Application identities
  that matter semantically must be included as field values. Equal row contents
  can exchange keys without dirtying data. Fields' comparison semantics and a
  collection's orderedness must agree for equality.

`exactNumericEqual(left, right, NumericSemantics): boolean | undefined` is reusable
by future validation work. `undefined` means syntax or work bounds prevent safe
interpretation, never success/validity. INTEGER accepts an optional sign and decimal
digits only. DECIMAL accepts an optional sign, integer digits, optional fractional
part with at least one digit, and an optional signed exponent only when enabled.
Examples: `+001` equals `1`; `12.3400` equals `1234e-2` with exponents enabled.
`.5`, `1.`, whitespace, infinity, NaN and incomplete exponents are unsupported.

[DECIMAL validation](decimal-validation.md) now reuses the same internal normalized
numeric parser and exact comparison as STATE equality. Its constraints and bounded
divisibility arithmetic do not change equality semantics or stored editing values.

The helper bounds each lexical input to 4,096 UTF-16 units and exponent text to six
characters with absolute exponent at most 4,096. It compares normalized coefficient
text and a bounded BigInt exponent without expanding powers or passing field values
through JavaScript Number/floating point. These are conservative work bounds, not
precision, scale, range or validity constraints. The unordered multiset comparison
is quadratic in row count; this increment makes no large-document performance
claim. There is no temporal/timezone normalization or calendar validation.

## FORM/GRID integration and future consumers

Existing components and events remain unchanged. A parent can wrap a
`FormFieldChange` or `DetailGridChange` cell value into a value slot:

```ts
state = applyDocumentChange(state, {
  kind: 'field', path: intent.path,
  input: { kind: 'value', value: intent.value },
});
```

Adapt remove/move using `collectionPath`, `key` and `before`. Adapt add only after
preparing a complete row. The current FORM/GRID scalar channel retains incomplete
numeric strings as values; it does not acquire an implicit raw/presence channel.
Callers using the explicit raw operation supply `{kind:'raw',text}` themselves.
Legacy renderer projection of absence/raw requires an explicit application mapping;
the core never substitutes null. Identity/path matching at an application event
boundary remains the parent's responsibility; core operations enforce actual tree
paths and capabilities rather than trusting a renderer's enabled state.

The installed-APF testbed `/default-theme/?scenario=state` uses one parent signal
holding `DocumentState`, one header and two independently editable detail collections
inside the public `FormComposition`. It projects scalar slots into renderer contexts
and adapts FORM/GRID events without modifying their contracts. State stays outside
visual components and survives five packaged themes and a structural grid frame.

Future VALID work can consume the same field inputs and typed paths, reuse bounded
numeric equality and attach validation results separately. No `valid:true` default
is present. Save/reconciliation must explicitly establish an authoritative accepted
tree, map keys and address revisions; none of those transitions exists here. Reset
alone does not satisfy STATE-004 confirmation requirements.

AUR-VALID-001 now supplies [local INTEGER validation](integer-validation.md) over
these inputs and paths without changing STATE. The remaining validation catalogue
and document-wide aggregation are still pending.

[AUR-VALID-004](scalar-validation.md) adds STRING/TEXT/BOOLEAN/ENUM/BINARY validation
without altering this model or its exact lexical equality. It does not normalize
text, coerce booleans or install validation state on the document.

[AUR-VALID-005](temporal-uuid-validation.md) compares temporal bounds as exact days,
clocks or instants without changing STATE equality. Different lexical offsets or
fraction spellings can remain dirty even when they satisfy the same instant bounds.

[AUR-VALID-009](pattern-validation.md) also permits clean/pending and dirty/pending
field results. Deferred checks belong to validation results and their consuming
application, not to STATE snapshots, revision tracking or the dirty comparison.

[AUR-VALID-AGG-001](document-validation.md) derives an immutable document-level
validation result from a separately supplied plan and, normally, `DocumentState.current`.
It never reads `original`, never mutates or freezes the supplied tree/plan and never
stores validity, diagnostics or deferred checks on `DocumentState`. Revision, dirty
state, row keys and row order are unchanged. Revalidation is explicit: a later call
with the current snapshot replaces the application's previous result; there is no
cache or STATE subscription. Clean/valid, clean/pending, clean/invalid, dirty/valid,
dirty/pending and dirty/invalid remain independent combinations. Root/row business
issues, submission, server confirmation and reconciliation remain future work.

`tests/state.test.mjs` covers immutable snapshots, exact equality, nested edits,
multiple collections, multiset permutations, key stability, permissions, rejection,
revision safety and reset. `tests/document-validation.test.mjs` additionally proves
that document validation leaves current/original snapshots, rows, revision and dirty
state untouched. `tests/browser/specs/state.spec.mjs` covers the installed public
components at desktop/mobile sizes, dirty invalid-looking numeric drafts, reordering
both collections, semantic reversion, add/remove and theme switching. Only tested
parts of STATE-001/STATE-002 are claimed; STATE-003–STATE-006 and the remaining
document-validation acceptance requirements remain pending.

## Operational save lifecycle (AUR-STATE-SAVE-001)

`DocumentSession` coordinates one editing lifetime over the existing immutable
`DocumentState` and `validateDocument`. It is framework-independent, performs no I/O
and owns no backend IDs, versions, authorization, defaults or persistence policy.
It introduces no second document tree or validation engine. Earlier sections describe
the original core increment; the lifecycle below supersedes their save-related gaps.

### Public API and ownership

```ts
const session = new DocumentSession(createDocumentState(acceptedDocument));
session.change({ kind: 'field', path, input: { kind: 'value', value: exactText } });
const result = session.submit(plan);
if (result.kind === 'ready') {
    const submission = result.submission;
    // The application dispatches its own command from submission.document.
    // After an authoritative response and UI-key mapping:
    session.resolve(submission, {
        kind: 'accepted', document: authoritativeDocument, checksConfirmed: true,
    });
}
```

The class exposes readonly getters `state`, `save` and `locked`, and methods
`change`, `submit`, `resolve` and `recover`. The session is the mutable coordinator;
its document states, submissions, validation evidence, outcomes exposed through
`save` and rejection feedback are immutable snapshots. Retain it outside replaceable
views and update application signals after each operation. Bind `locked` to renderer
and collection capabilities so the UI reflects the same lock enforced by `change`.

All edits within this lifetime must go through `change`, which delegates directly
to `applyDocumentChange`. The standalone STATE primitives remain unchanged and do
not acquire a global lock. Calling a standalone primitive on a retained snapshot
creates a different state; it cannot replace the session's private state. The protection increment below adds confirmed discard and a leave boundary;
there is no unrestricted state-replacement method on this coordinator.
Constructing a session requires an actual state admitted by the existing STATE core,
not a spread/JSON reconstruction. A new session denotes a new lifetime.

`submit(plan): DocumentSubmitResult` validates the exact current snapshot internally,
using the current plan and the existing aggregation API. It never trusts an old or
caller-constructed validation result. `blocked` returns its frozen validation evidence
for invalid values/definitions, with no attempt, lock, edit or revision change.
`ready` exposes a frozen `DocumentSubmission` with `id`, submitted local `revision`,
complete parsed `document` and the full immutable `validation` result. Parsed slots
replace valid raw slots only in the submission; the editing draft remains untouched.
Absence/null, exact numeric/temporal text, typed field paths, nested keyed collection
order and deferred checks are preserved. The local revision is not a server version.

IDs distinguish session/attempt pairs in this loaded runtime. The submission object
itself is the opaque in-memory response token; pass that same object back. Do not
reconstruct tokens by ID or serialize them as persistence identities. No global or
durable request-ID service is promised. Attempts do not advance the document revision.
A revision with no remaining safe increment is rejected before an operation can be sent.

### States and outcomes

| Current state / operation | Result |
| --- | --- |
| `idle`, valid or pending `submit` | `saving`; immutable attempt created. |
| Any locked state, edit or duplicate submit | Throws without changing draft, revision or active attempt. |
| `saving`, `rejected` with reason `validation`, `transport` or `conflict` | `idle` with frozen rejection feedback; retain the exact original/current state object, revision and keys. |
| Active attempt, `accepted` with complete mapped document | New deeply frozen original/current snapshots, clean dirty comparison, revision +1, `idle`; clear previous feedback. |
| Active attempt, `committed` | `reconciling`; retain draft and lock while the adapter reads authoritative values. |
| Active attempt, `uncertain` | `recovery`; retain draft and lock, never resubmit automatically. |
| Partial, malformed, raw-input or unmapped accepted tree | `recovery` with `invalid-acceptance`; retain the existing state. |
| Accepted tree without explicit confirmation of outstanding checks | `recovery` with `unconfirmed-checks`. |
| Readback failure/rejection after committed or uncertain outcome | `recovery` with `reconciliation-failed`; never unlock for blind retry. |
| Stale, forged, foreign-session or completed token | `resolve`/`recover` return false before inspecting the payload; no change. |

`resolve(submission, outcome)` returns true when a response belongs to the active
attempt, including when an inadequate acceptance moves to recovery. True is not a
persistence-success flag; inspect `save`. Only an authoritative accepted snapshot
can complete the lifecycle. `recover(submission, document, checksConfirmed = false)`
is explicit adapter-managed readback from `reconciling` or `recovery`; the same
acceptance checks apply, and repeated inadequate recovery retains the lock.

A definite `transport` rejection means the adapter knows the write did not commit.
Timeouts, lost responses and possibly committed operations must use `uncertain`.
After `committed`/`uncertain`, a transport failure means failed readback, not permission
to send the original operation again. The coordinator neither retries nor calls HTTP.
Even a numerically unchanged submitted document may need recovery: `state.dirty` is
only effective-content equality, never evidence of persistence success. Overall
completion requires `save.kind === 'idle'` without a rejection. Pending evidence on
an old submission remains pending forever; the adapter explicitly acknowledges
all its deferred checks using `checksConfirmed: true` when providing acceptance.
Local validity alone is never server confirmation.

### Authoritative documents, identity and feedback

Acceptance requires a complete structurally admitted object with no raw inputs.
An ID/version-only response is insufficient. The adapter must read back or safely
reconstruct the authoritative document according to its own protocol. The accepted
tree must have the submitted property names, node kinds, comparison semantics,
collection orderedness and exactly the same UI row keys within each collection,
including nested rows. Row values and authoritative ordering may change; capabilities
may reflect updated effective policy. No field, row or unknown structural shape is
guessed, merged or silently discarded. A changed schema or row membership needs an
explicit new editing lifetime after application-managed readback.

When persistence IDs regenerate, adapters map accepted rows to the submitted stable
UI keys before calling AUR. The library compares by these keys, never by index,
server ID or value similarity. A server ID with domain meaning remains a field value.
New original/current trees are independent defensive copies; mutating an adapter's
response after reconciliation cannot change accepted data or earlier snapshots.
AUR structurally admits authoritative values; the adapter asserts their authority,
and local revalidation remains explicit rather than inventing a backend validator.

`DocumentSaveIssue` holds an application code/message and typed `ValuePath`, including
root (`[]`), row and field paths. `rejected` feedback is copied and frozen and never
modifies validation evidence or edits. Display it in application-owned accessible
feedback; sanitize application messages and avoid protected-data disclosure. An
explicit successful edit clears old rejection feedback; the application revalidates
and remaps server issues as needed. No error-mapping plugin or business-rule engine
is introduced. Touched state and focus remain application/view responsibilities.

Unit tests in `tests/document-session.test.mjs` and compile-time API assertions cover
transitions, exact values, raw/absent/null inputs, locks, duplicate submissions,
immutable snapshots, nested/reordered collections, conflicts, stale/session tokens,
inadequate acceptance and recovery. The installed APF scenario
`/default-theme/?scenario=document-save` and Chromium `document-save.spec.mjs` cover
manual synthetic-adapter responses at desktop/mobile sizes and preservation during
five packaged themes plus a structural frame. This implements the generic STATE-003
lock-and-reconcile behavior; external adapter conformance, full visual/accessibility
review, touched/error integration and STATE-004–STATE-006 remain outside this increment.

## Discard and navigation protection (AUR-STATE-PROTECTION-001)

This increment supersedes the discard/navigation gaps recorded above. It extends
`DocumentSession`, reusing `resetDocumentState`; it introduces no second state engine.

- `requestDiscard(reason: string, confirm: ConfirmDiscard): Promise<DiscardResult>`
  returns `allowed`, `cancelled`, `blocked` or `stale`. A clean idle session allows
  immediately without prompting or advancing revision. Dirty sessions pass a frozen
  `DiscardRequest` (`revision`, `reason`) to the application asynchronous dialog.
  Only literal `true` confirms; cancellation leaves the entire state and feedback
  untouched. Confirmation restores the latest authoritative accepted snapshot,
  including nested keys/order, clears save feedback and increments revision once.
- Saving, reconciling and recovery block even a clean document. After confirmation,
  both snapshot identity/revision and lifecycle generation must still match. Edits,
  acceptance and even a save/rejection cycle invalidate an earlier confirmation.
  A concurrent request returns `blocked`, without another dialog or shared permission.
  Dialog rejection propagates to the caller, preserving state and releasing the gate.
- `new NavigationProtection(session, confirm).requestLeave(reason): Promise<boolean>`
  returns true only for `allowed`. Route, Back and destructive application adapters
  await it before executing their action. All instances share the session's gate.
  Cancellation does not change views or focus in the library. The application owns
  accessible dialog focus capture/restoration and must defer navigation (or restore
  history after a popstate); this API does not itself intercept browser Back.
- `requiresProtection` is dirty OR locked. `subscribe(listener)` observes completed
  transitions and returns an idempotent unsubscribe function. It does not immediately
  emit. Observers should read state, not initiate further transitions. Observer errors
  are isolated from the completed operation; applications own reporting those errors.

```ts
const protection = new NavigationProtection(session, applicationConfirmDiscard);
if (await protection.requestLeave('record-switch')) {
    // Perform the application-owned replacement only after permission.
}
// Explicit browser owner setup; pass undefined during SSR.
const cleanup = protectBeforeUnload(session, browserWindow);
// Call cleanup() when this owner is destroyed.
```

`protectBeforeUnload(session, target?)` installs no globals implicitly. The optional
`BeforeUnloadTarget` is a minimal add/remove listener port; omitting it is SSR-safe.
It synchronously registers only while dirty or locked, including clean uncertain
saves, and removes the listener on clean idle transitions or explicit cleanup.
Cleanup is idempotent and unsubscribes from future session transitions. The handler
uses preventDefault and returnValue, never an asynchronous custom dialog. Browsers
control native prompt text and may suppress prompts (including without prior user
activation and on mobile lifecycle termination). Native prompts and recovery cannot
be guaranteed; this API provides no persistence or durable recovery mechanism.

`tests/document-protection.test.mjs` covers raw invalid drafts, nested removals,
accepted snapshot restoration, cancellation, stale confirmations, concurrent requests,
save/recovery locks, SSR, listener registration and cleanup. The installed public APF
scenario `?scenario=document-protection` uses synthetic route/Back/programmatic
adapters, with desktop/mobile Chromium tests for retained drafts/focus, stale dialog
responses and synchronous unload cancellation/cleanup. These are synthetic decision
adapters, not real Angular Router/history interception or guaranteed native prompts.
