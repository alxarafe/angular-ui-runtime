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
Each collection may also supply `fields`, a per-property presentation map (for
example `{status: {choices: ['', 'OPEN']}}`). These options reuse the field context
ports for choices, feedback IDs and edit restrictions; they cannot supply identity,
labels, values, document inputs or session-derived DATE constraints. Session-derived identity, input and inherited
restrictions remain authoritative. Choices are supplied by the consumer, not inferred
from validation plans or metadata.
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
work unchanged. Apart from ENUM below, the bridge currently uses neutral
text/checkbox controls rather than semantic-specific widgets; it is not full FIELD
catalogue widget acceptance.
Theme CSS and structural frames remain effective. Non-ENUM legacy field renderers
are not asked to represent states their scalar port cannot express. No new mandatory
theme artifact or peer dependency is introduced.

### Lossless ENUM selection (AUR-EDITOR-ENUM-001)

For `field.ENUM`, the bridge delegates choice selection to the active theme's
existing ENUM artifact using `FieldRendererContext.choices`. A recognized string
is selected exactly, including empty strings, whitespace and distinct Unicode
sequences. Selection uses catalogue indexes rather than parsing option values;
no normalization or scalar conversion occurs. One explicit selection emits one
`FormFieldEdit` or keyed `DetailGridEdit`, without a legacy change event.

The reference ENUM renderer understands the existing optional `documentInput`
context: its disabled placeholder distinguishes absent, null, raw draft and unknown
value states from declared choices. It never chooses the first declared value or
emits an edit during rendering/refresh. The bridge projects unrecognized inputs to
the chooser placeholder only; the session retains the original input. A separate
labelled draft textbox displays unknown values (including invalid scalar types)
and raw drafts. Typing explicitly produces raw text; even raw text matching a choice
remains raw until the user selects a choice. Unset, Set null and Empty text remain
separate explicit intents, even when invalid under the current validation plan.
Unknown values can be corrected either by typing a draft or selecting a declared
choice. Read-only/disabled fields suppress all editing channels, including synthetic
events. The chooser and draft share field feedback associations and invalid state.

Default, Alternative, Cyberpunk, Vintage and High Contrast reuse the existing
ENUM artifact and CSS; High Contrast retains its larger inherited typography and
controls. Select DOM/focus and raw draft focus survive their theme changes. No
new renderer registry, state tree or validation engine is introduced. Legacy
ENUM consumers without `documentInput` retain the existing `Not set`/null and
scalar `valueChange` behavior. Third-party ENUM overrides still use the existing
field port and must respect the lossless placeholder, feedback and permission
context to provide equivalent presentation; the bridge owns the outward lossless
event channel. This increment does not redesign optional controls or complete the
remaining semantic widget catalogue.

### Paged choice selection

Artifact fields may opt into `context.selector` using the public
[neutral paged choice selector](choice-selector.md). Header and collection `fields`
presentation options accept this port. Lossless and scalar edits retain their
existing separate channels; new `fieldPage`/`collectionPage` outputs carry neutral
page directions with field paths and stable row keys, without mutating the session.
Applications own option loading, current labels, wire conversion and stale-response
acceptance. Optional-control compatibility guards are unchanged.

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
The editor scenario also exercises ENUM choice/state preservation, invalid draft
correction, event counts, permissions, associated feedback, keyed row edits and
theme focus retention at both widths. Unit/type probes cover the optional collection
presentation map and its session-owned input boundary.

This increment does not establish full FIELD/FORM/GRID/VISUAL acceptance. Remaining
gaps include semantic widget completeness, optional-control lossless capabilities,
help/touched policies, hidden-column reveal, independent consumer/backend conformance,
other browsers/assistive technology and human visual/accessibility certification.

## Reusable summary and focus interaction (AUR-FEEDBACK-001)

The audit found that `EditorFeedback`, field messages, validation, document sessions
and keyed form/grid reveal already existed. The only summary was application markup
in the QA editor, with no shared error/deferred grouping or first-focusable-error
interaction. The boolean from form reveal reported recognition/scheduling, not
successful DOM focus; disabled and unknown descendant targets could not reliably
be skipped. This increment fills those presentation/focus gaps without another
validator, document state model, message decoder or dialog framework.

`FeedbackSummary` (`aur-feedback-summary`) consumes the existing readonly
`EditorFeedback[]` through `[feedback]`. All non-deferred entries (`local`,
`definition`, `server`) appear under Errors in input order, including multiple
messages for the same path and root errors. Deferred entries have a separate
Deferred checks section; they never become errors or a success indication.
Messages render as Angular text, never HTML. The summary does not infer authorization
or filter protected messages: the application supplies only appropriate feedback.

```html
<aur-feedback-summary [feedback]="editor.feedback" [reveal]="reveal"
  [labelPath]="labelFeedbackPath" />
<aur-form [definition]="definition" [contexts]="editor.contexts"
  [collectionContexts]="editor.collectionContexts" />
```

```ts
import { type FeedbackReveal, type ValuePath } from '@alxarafe/ui-runtime';
// form is the application's viewChild(FormComposition) query.
readonly reveal: FeedbackReveal = path => new Promise(resolve => {
  const form = this.form();
  if (form) form.revealPath(path, resolve);
  else resolve(false);
});
readonly labelFeedbackPath = (path: ValuePath): string => /* application label */ '';
```

`[label]` defaults to Document feedback. Optional `[labelPath]` supplies accessible
application labels; the default uses Document for root feedback and does not expose
property names or opaque row keys. Without `[reveal]`, the component is a read-only
summary. `FeedbackReveal` accepts a typed path and returns `boolean | Promise<boolean>`:
true means focus actually reached the target. Applications can adapt other public
focus ports; do not return true merely because navigation was scheduled.

The native Focus first error button and public `focusFirstInvalid(): Promise<boolean>`
try non-root error paths in order, once per distinct path, until one focuses. Root
errors remain readable text rather than disabled pseudo-links. Deferred checks are
excluded from first-error navigation but can be explicitly revealed. Individual
path buttons and `focusFeedback(item)` attempt only that entry. Unknown, excluded,
removed, disabled or otherwise unfocusable targets return false, preserving the
initiator's focus and announcing a polite status when no target is found. Rejected
callbacks report a generic reveal failure, without displaying exception details.
Only a supplied entry can be activated. Pending requests ignore repeated activation;
replaced feedback, changed reveal ports, destruction or independently moved focus
stop subsequent attempts. Arbitrary application reveal callbacks must themselves
respect owner lifetime and focus changes while awaiting their own work.

`focus(): boolean` is an explicit application return target: it focuses the named
summary region. Rendering or refreshing feedback never moves focus, marks touched,
edits data or submits. The summary uses native type=button controls, semantic lists,
named error/deferred sections, a named focusable region and a polite result status.
It inherits typography/colors and provides visible focus and wrapping. Place it in
existing theme content (for example `aur-theme-panel`) for themed typography,
including High Contrast. No theme artifact, registry or dependency is added.

`FormComposition.revealPath(path, completed?)` adds an optional completion callback.
Its existing immediate boolean still means the path was recognized for scheduling;
`completed(focused)` runs exactly once with the actual focus result, or false for
unrecognized paths, destruction before rendering or focus moved elsewhere meanwhile.
Inactive tabs and collapsed sections still open through existing visual state.
Controlled visual state must be echoed by the application; if the target remains
hidden, completion is false. `DetailGrid.revealPath` now verifies actual focus,
including disabled controls, and row reveal tries columns in order until a control
focuses. Collection reveal uses the existing scroll region. Unsupported/root paths
never invent a field. Header/collection fallback and legacy reveal calls remain valid.
Malformed typed paths still reject under the existing path contract.

### Discard confirmation audit

`DocumentSession.requestDiscard` already accepts asynchronous `ConfirmDiscard`,
protects locked/reentrant/stale requests and delegates UI to the application.
`NavigationProtection` and `protectBeforeUnload` remain unchanged. No missing MVP
capability requires a new shared dialog primitive: the installed editor fixture now
uses native `dialog.showModal()` for modality, initial focus and keyboard containment,
handles Escape as cancellation, resolves the existing confirmation promise and
returns focus to the connected invoker. Applications own dialog text, styling,
lifetime, cancellation and routing. This is QA evidence, not a new public dialog API.

`tests/feedback.test.mjs` and compile-time fixtures cover grouping, all sources,
multiple messages, first-invalid skipping/deduplication, failed callbacks, concurrent
requests, refresh/destruction and focus return. Installed APF Chromium
`feedback.spec.mjs` exercises root/field/collection/keyed-row/cell errors, unknown and
disabled paths, separate deferred checks, keyboard activation, inactive tabs/collapse,
actual focus completion, no duplicate actions or edits, moved focus and destruction,
five themes plus structural frames, High Contrast and desktop/mobile layouts.
`editor.spec.mjs` consumes the shared summary and verifies native discard keyboard
containment, Escape, promise cancellation/confirmation and focus return. Remaining
MVP limits include application-specific labels/policy, arbitrary component focus ports,
hidden columns, non-Chromium/assistive-technology certification and human visual review.

### Lossless multiline TEXT (AUR-EDITOR-TEXT-001)

Lossless `field.TEXT` uses a labelled native textarea in both header fields and
keyed detail cells. Each explicit input event emits one raw `EditingInput` through
the existing field/grid intent adapter into `DocumentSession`; it emits no legacy
scalar event. LF line breaks, Unicode sequences and surrounding spaces are retained
exactly. Absent, null, empty value and empty raw text remain distinct session slots.
Rendering and context/theme refreshes do not edit the session. The textarea retains
DOM identity and focus across ordinary context updates and all five reference themes.
Readonly/disabled guards, feedback associations, invalid state and visible focus use
the existing bridge behavior. STRING and other scalar controls remain unchanged.

Native textarea DOM values normalize CR and CRLF to LF. Rendering does not normalize
the application/session value; an explicit input event records the native DOM value.
Exact preservation of original CR/CRLF spelling after a user edit is not provided.
No rich text, autosizing, semantic widget catalogue expansion or legacy renderer
behavior change is included. Installed APF Chromium tests cover header/keyed-cell
editing, event counts, states, restrictions and retained focus at desktop/mobile
widths across all five themes; non-Chromium and assistive-technology certification
remain outside this evidence.

### Lossless DATE interaction (AUR-EDITOR-DATE-001)

Lossless `field.DATE` keeps the existing labelled text input and adds a separately
labelled native date selection input. Both derive from the same session slot;
there is no second draft. The text input remains available for invalid/incomplete
text, unsupported scalar values, surrounding spaces and empty drafts. Rendering
never emits an edit or changes absent, null, empty value or raw distinctions.

The native control projects only exact `yyyy-MM-dd` Gregorian dates in years
0001–9999, using the existing temporal parser. Invalid or unsupported values leave
that control blank while the text input and session retain the original input.
One explicit native input event with a representable date emits one raw
`EditingInput`; the native change event emits nothing. Empty/incomplete native
events are ignored because the browser cannot distinguish them safely from clearing
an invalid draft. Use the text input or the explicit Unset, Set null and Empty text
buttons for those intents. No today's-date default, rollover, JavaScript Date,
timezone or locale conversion is applied to document data.

The existing validator owns Gregorian validity and declared inclusive/exclusive
bounds. A representable native selection may still violate declared bounds and
then receives the existing feedback. `bindDocumentEditor` projects DATE constraints
from the matching validation-plan field into `FieldRendererContext.dateConstraints`,
including fields below keyed collection rows. Direct context owners may supply the
same existing `DateFieldDefinition['constraints']` type. Native min/max use these
bounds, falling back independently to 0001-01-01 and 9999-12-31 when absent.
Exclusive bounds become the next/previous Gregorian day using the shared temporal
helpers. An interval with no representable dates gives the native control an empty
(reversed) range; invalid bound text falls back to the intrinsic endpoint while
validator diagnostics remain authoritative. Changing constraints updates attributes
and feedback without clamping or editing the stored value. Both inputs share
readonly/disabled guards, invalid state, feedback associations and visible focus.
Header and keyed detail-cell edits use the existing lossless intent adapters into
`DocumentSession`, without legacy scalar events. Both controls retain DOM identity
and focus through ordinary context and theme updates.

Installed APF Chromium tests cover text drafts, leap/non-leap dates, lexical/state
retention, native input/change event counts, bounds feedback, restrictions, keyed
cells and focus across five themes at desktop/mobile sizes. STRING, TEXT and ENUM
regressions remain covered by the existing editor suite. Native picker appearance,
locale-dependent display and popup interaction are browser-owned; automated evidence
covers the native input's value/event interface, not OS calendar-popup operation.
Non-Chromium and assistive-technology certification remain unverified. Native partial
segments are not durable drafts; use the text input for incomplete editing.

### Lossless TIME interaction (AUR-EDITOR-FIELDS-001)

`field.TIME` retains the same authoritative text path for `HH:mm:ss` and optional
fractions of one through seven digits. Original lexical width, incomplete drafts,
unsupported scalar slots and invalid values remain session-owned. The existing
TIME definition and validator own precision, clock validity and inclusive/exclusive
bounds. Rendering, theme changes and metadata refreshes never edit the document.

`bindDocumentEditor` derives `FieldRendererContext.timeDefinition` from the matching
header or keyed-row validation plan. Direct context owners may supply the existing
`TimeFieldDefinition` type. Only an admitted whole-second definition
(`fractionalDigits: 0`) enables a separately labelled native time assistant.
Native `step=1` and min/max hints use that exact grid; exclusive endpoints advance
by one second without rounding or clamping any stored value. A malformed or empty
definition interval disables the assistant rather than inventing usable bounds.
Fields permitting fractions stay text-only: native assistance for fractional
precision and lexical width is deliberately not claimed.

One explicit native input selection emits one raw intent. A native `HH:mm` choice
explicitly selects `HH:mm:00`; this maps native minute syntax to the existing
required-seconds contract and never rewrites an existing draft during rendering.
Native empty, malformed, fractional or blocked events emit nothing and restore the
same DOM input from the current document projection. Native change events emit
nothing. Native choices outside declared bounds retain their exact selected time
and receive ordinary validation feedback. Use text or the existing explicit state
buttons for empty drafts, absence and null. No timezone or Date conversion is used.

Whole-second selection, ignored events, all fractional widths, constraints, keyed
cells, permissions, feedback, single-channel events and DOM/focus across five themes
are covered by unit and installed-APF Chromium desktop/mobile tests. Native picker
popup behavior, other browsers and assistive-technology certification remain outside
this evidence. DATE behavior and its regression tests are unchanged.

### Lossless offset DATETIME (AUR-EDITOR-FIELDS-001)

`field.DATETIME` uses the existing lossless text input, in headers and keyed detail
cells. It preserves `Z`, explicit positive/negative offsets (including signed zero),
fraction widths of one through seven digits, trailing zeros and original lexical
form. Partial offsets, missing zones, invalid clocks, unsupported scalar slots and
empty drafts stay editable and remain unchanged in the session. Only an explicit
text input emits a raw intent; there is no legacy scalar event or second draft.

The existing offset-instant validator remains authoritative for declared precision,
offset/year limits and inclusive/exclusive instant comparisons. Equal instants with
different spellings remain distinct editing values; exact 100 ns bounds do not
rewrite either spelling. Metadata, feedback and theme refreshes do not mutate state
or steal focus. DATETIME deliberately has no native assistant: `datetime-local`
does not represent offsets, and no native control is asserted to preserve this
complete contract. No implicit local/UTC conversion, timezone inference or Date API
is introduced. The text editor capability is complete for the supported profile;
native offset-aware assistance remains unavailable.

Focused units and installed-APF Chromium desktop/mobile tests cover offset and
fraction spelling, invalid drafts, exact bounds, metadata changes, permissions,
associated feedback, keyed reorder, single-channel events and focus/DOM identity
across five themes. Other browsers and assistive-technology certification remain
outside this evidence.
