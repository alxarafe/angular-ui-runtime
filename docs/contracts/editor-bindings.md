# Document editor bindings (AUR-EDITOR-BINDINGS-001)

This integration connects the existing `DocumentSession`, `validateDocument`,
`FormComposition` and `DetailGrid`. It does not add another document or validation
engine. Session state remains the sole editing tree. The installed APF scenario
`/default-theme/?scenario=editor` is a private deterministic QA fixture, not a
permanent demonstration application or a consumer/backend integration.

## Derived contexts and intent adapters

`bindDocumentEditor(session, options): DocumentEditorSnapshot` reads only the current
session snapshot and runs the existing `validateDocument({document: current, plan})`.
`DocumentBindingOptions` contains the existing form definition and validation plan,
header presentation options (`fields`, keyed by form field ID), and collection
presentation options (`collections`, keyed by collection ID, with label and columns).
It does not infer definitions, authorization, defaults or business rules.

The result contains `contexts`, `collectionContexts`, `validation` and ordered
`feedback`. Contexts derive values, effective inherited readOnly/disabled flags,
collection capabilities, stable row keys and keyed cell paths from the current
session. The session lock disables header/cell edits and structural operations.
Column fields still address immediate row properties; nested collections use their
own independently identified form collection and full typed `ValuePath`.
Unresolved paths or missing presentation options throw rather than inventing nodes.
Applications must update their effective form catalogue if a referenced parent row
is removed; the fixture demonstrates this for the optional nested collection.

`applyDocumentFieldIntent(session, FormFieldChange | FormFieldEdit)` delegates to
`session.change`. Legacy scalar values become value slots; lossless inputs retain
their exact kind/text/value. `applyDocumentCollectionIntent(session, intent, row?)`
adapts legacy cell/add/remove/move intents and lossless `DetailGridEdit`. It verifies
that cell paths agree with collection path/key/property. Add requires a fully
application-prepared `DocumentRow`; no row key, default or persistence ID is invented.
These helpers accept component-generated intents, not an authorization boundary.
The existing state core validates paths, permissions and all actual mutations.

```ts
const unsubscribe = session.subscribe(() => refreshApplicationSignal());
// Derive again after edits, save outcomes, recovery or discard:
const editor = bindDocumentEditor(session, options);
// Bind editor.contexts and editor.collectionContexts to the existing aur-form.
// Forward fieldEdit and collectionEdit, as well as legacy scalar/structural events:
applyDocumentFieldIntent(session, fieldIntent);
applyDocumentCollectionIntent(session, collectionIntent, preparedRowIfAdding);
// On owner destruction:
unsubscribe();
```

There is no cached or separately mutable document tree. Applications own Angular
signals/subscription lifetime. A snapshot is a readonly derived projection, not
another editing lifetime. New application options/references must be supplied for
presentation or catalogue changes. Standalone session use is unchanged.

## Lossless backward-compatible editing channel

`FieldRendererContext.documentInput?: EditingInput` explicitly opts an artifact field
into the core lossless editing bridge. It takes precedence over legacy `value`.
The required legacy value is only a presentation projection: a raw input projects
its text, and absence projects empty text for compatibility. This **never** writes
empty text, null or absence back to the session without a corresponding user intent.
Presence labels distinguish Absent, Null, Draft and Value. Explicit Unset, Set null
and Empty text buttons choose distinct inputs. Text input emits `{kind:'raw',text}`,
including empty text; it never calls Number/Date parsing or normalizes a draft.
Recognized BOOLEAN slots use a checkbox and emit boolean value slots. Raw or
malformed BOOLEAN text stays text and is validated independently. Invalid null or
absent choices remain representable and can be corrected; constraints gate submission,
not lossless retention. Read-only/disabled controls suppress even synthetic events.

New outputs keep legacy types intact:

- `FormFieldEdit`: `{id,path,input}`; emitted by `FormComposition.fieldEdit`.
- `DetailGridEdit`: `{collectionId,collectionPath,key,field,path,input}`; emitted by
  `DetailGrid.gridEdit` and forwarded by `FormComposition.collectionEdit`.

One edit emits exactly one channel. Opted-in fields do not also emit scalar
`fieldChange`/cell `gridChange`. Structural intents still use the existing channel.
Without `documentInput`, existing renderers, valueChange, contexts and form/grid
scalar event types remain unchanged. Optional-control fields do not currently
support this opt-in bridge and reject it explicitly; legacy optional controls still
work unchanged. The bridge currently uses neutral text/checkbox controls rather
than semantic-specific widgets; it is not full FIELD catalogue widget acceptance.
Theme CSS and structural frames remain effective, but custom legacy field renderers
are not asked to represent states their scalar port cannot express. No new mandatory
theme artifact or peer dependency is introduced.

## Validation, feedback and reveal

`EditorFeedback` keeps typed paths, messages and sources separate: `local`,
`definition`, `deferred`, `server`. Local evidence comes exclusively from the current
validator; rejected path/root feedback comes from the existing session save state.
Pending checks stay pending after normalization or adapter acceptance when the plan
still requires them. Local validity is never a backend acceptance or save-success flag.
Root/row business validation and backend message interpretation remain external.
An explicit session edit clears old save rejection feedback under the existing policy.

`FieldRendererContext.feedback` supplies plain text messages; `invalid` supplies
presentation state. The field outlet renders associated messages with stable IDs,
and the lossless native input uses aria-describedby/aria-invalid. Row messages
aggregate descendant issues and exact row rejections; `DetailGridContext.message`
provides collection feedback associated with the focusable scroll region. Deferred
checks are displayed separately from errors and do not acquire a local success flag.
The fixture renders a document-level feedback summary with typed-path reveal actions.
No transport or business issue plugin is added to the validator.

`FormComposition.revealPath(path)` extends existing `revealField` without changing
its behavior. It opens the owning tab/section and delegates to
`DetailGrid.revealPath` for the longest registered collection path. Keyed cells,
rows and collections are supported; root paths have no field target. A collection
focuses its scroll region; a row focuses its first declared cell; a field focuses
the matching cell DOM ID. DOM queries are scoped and use typed path/key matching,
not CSS interpolation or row indexes. Mounted standalone grids can also reveal
paths directly. Unmounted grids have no DOM target and return false.

## Save, discard and evidence

The fixture uses `session.submit(plan)` and manual synthetic accepted/conflict/
committed responses. Invalid/definition-error documents cannot submit, including
invalid clean accepted baselines; no edits are removed. Saving/reconciling/recovery
locks are those of DocumentSession. Acceptance uses a complete normalized tree with
submitted UI keys; no server IDs or concurrency tokens are invented. Conflict keeps
the complete draft. Confirmed/cancelled discard uses `requestDiscard`; the fixture
owns its accessible dialog and focus restoration.

`tests/editor-bindings.test.mjs` and compile-time contract probes cover projection,
input distinctions, keyed intents, permissions/locks, local/deferred/server separation,
acceptance and discard. Installed public APF Chromium `editor.spec.mjs` covers missing,
null, empty and raw values, exact unsigned 64-bit and decimal text, hidden-tab/collapsed
section reveal, nested rows, associated feedback, structural operations across two
independent detail collections, save locks/rejection/reconciliation, discard and dirty
switching through all five reference themes plus a structural frame at desktop/mobile
widths. Existing legacy form/grid/menu/session tests remain independent.

This increment does not establish full FIELD/FORM/GRID/VISUAL acceptance. Remaining
gaps include semantic widget completeness, optional-control lossless capabilities,
help/touched policies, hidden-column reveal, independent consumer/backend conformance,
other browsers/assistive technology and human visual/accessibility certification.
