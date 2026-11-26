# Reusable grid composition (AUR-GRID-001)

AUR-EDITOR-BINDINGS-001 now connects these implemented public APIs through
[document editor bindings](editor-bindings.md). That contract supersedes historical
statements below that form/grid session integration and validation feedback are
entirely pending. It adds opt-in lossless editing channels, derived contexts and
keyed reveal without replacing the existing state/validation engines. Full catalogue,
consumer and visual acceptance remain separate.

The core public APF entry exports standalone `ListGrid` (`aur-list-grid`) and
`DetailGrid` (`aur-detail-grid`). These hosts render semantic tables and neutral
intents; applications supply effective values and capabilities through immutable
input updates. No document session, backend, navigation, authorization, validation,
dirty tracking, defaults, save/discard or persistence is implemented.

## List API

`ListGrid.context: ListGridContext` contains a nonempty `id` and accessible `label`,
ordered `GridColumn[]`, ordered `GridRow[]`, optional `selectable` and `emptyLabel`.
Each column has stable `id`, label and `field` (an immediate property name, not a
query language). Each row has stable nonempty `key`, accessible `label` and
`values: Readonly<Record<string, FieldValue>>`. Labels may repeat; keys may not.
Identities must be unique among simultaneously mounted grids.

Selection uses an explicit native button and emits `rowSelected: string`, the
stable row key. Lists never edit rows. An empty list still renders its caption,
column headers and explicit empty message. Null displays an em dash; booleans
display their exact textual representation. Empty strings remain empty strings.

## Detail API

`DetailGrid.context: DetailGridContext` adds typed collection `path: ValuePath`,
`ordered`, `readOnly`, optional `disabled`, and explicit `allowAdd`, `allowRemove`,
`allowReorder`. The additional component `readOnly` input composes with the context.
Effective collection/cell flags suppress even synthetic renderer and action events.
There is no inferred application permission policy.

`DetailGridColumn` adds either a base `artifact` (including canonical
`field.INTEGER`) or `{ kind: 'control', controlId }`, using the same mutually
exclusive renderer selection rules as forms. `DetailGridRow.contexts` optionally
supplies per-property renderer options: disabled/readOnly, choices, optional-control
request and accessible feedback IDs. The host supplies cell DOM ID, accessible label
(column plus row label) and exact value. It reuses the form field outlet and existing
`ThemeResolver.resolve`/`resolveControl`, without another renderer registry.

`gridChange: DetailGridChange` is a frozen discriminated union. Every intent includes
`collectionId` and a deeply frozen typed `collectionPath`:

The output deliberately avoids the native DOM `change` name: bubbling renderer
events must never be mistaken for collection intents.

| kind | Additional data | Meaning |
| --- | --- | --- |
| `cell` | `key`, `field`, complete `path`, exact `value` | Request a cell edit. Path appends `{kind:'row',key}` and `{kind:'property',name:field}`. |
| `add-row` | none | Application creates the key, row and defaults. |
| `remove-row` | `key` | Request removal by stable identity. |
| `move-row` | `key`, `before: string \| null` | Move before the keyed row, or to the end when null. Only emitted for ordered, reorder-enabled collections. |

Native move-up/down buttons implement this convention without drag-and-drop or
custom spreadsheet keyboard handling. Indexes locate adjacent targets only; they
are never row identities or event targets. The application accepts/rejects intents
and supplies replacement rows. The hosts never mutate inputs, optimistically reorder
or create a row. Duplicate row contents with different keys are valid.

```html
<aur-list-grid [context]="list" (rowSelected)="selectKey($event)" />
<aur-detail-grid [context]="details" (gridChange)="applyCollectionIntent($event)" />
```

Malformed identities, paths, duplicate keys/columns/property references, unknown
cell context properties, missing cell values and non-FieldValue values reject.
Collection paths must start and end with properties; row segments carry nonempty
keys and follow properties. Neither dotted traversal nor index addressing exists.
Unknown imperative edit/remove/move targets reject rather than guessing.

## Form integration

`FormDefinition.collections?: readonly FormCollection[]` is an independent catalogue
of `{id,path,excluded?}`. Existing fields/actions/inputs/outputs are unchanged.
`LayoutGroup.collections?: readonly ValuePath[]` adds placement beside existing
field references; fields precede collections within a group. Zero, one or many
collections may occupy any tab/section/group. No first collection is privileged.

`FormComposition.collectionContexts` maps collection IDs to `DetailGridContext`.
Every eligible collection requires a matching identity and path. Excluded entries
need no context. `collectionChange` forwards neutral grid intents to the same
parent boundary as `fieldChange`. Form read-only also suppresses collection edits.

`composeForm` adds `ComposedGroup.collections` and `unplacedCollections` to its frozen
result. First valid placement wins, preserving catalogue/traversal order. Eligible
unplaced collections appear once after field fallback, outside tabs. Excluded
collections never reappear. Collection-only groups stay visible. Unknown, duplicate
and excluded references produce frozen `unknown-collection`, `duplicate-collection`
and `excluded-collection` diagnostics. As with fields, these are programmatic only:
technical paths and protected references never enter diagnostic DOM or ARIA content.
Malformed paths and duplicate catalogue identities/paths throw.

## Themes, accessibility and exact values

Optional `ThemeComponents.listGrid` and `.detailGrid` are projecting presentation
frames with the same `{id,label}` context/one catch-all projection contract as
`FormPresentation`. Hosts own tables, captions, headers, controls and all events.
The existing registry validates these ports, and the resolver falls directly from
active theme to application default to the core frame. Fourteen mandatory artifacts
remain unchanged; no theme package dependency is added. Unchanged resolved component
types retain their instances. Frame replacement retains projected views; renderer
replacement restores scoped logical focus without overriding a user focus move.

Tables have captions and scoped column headers; editable controls have column/row
labels. Both grid types share the same internal row-label disambiguation.
List selection buttons, detail cells and detail row actions include row labels.
When row labels repeat, these accessible names append a presentation-only ` (row N)` suffix using the
current one-based position. If that name collides with another supplied label, the
suffix repeats until distinct. Unique labels retain their existing names. These
ordinals update after reordering and row collection changes; selection and editing
intents continue to target stable keys exclusively,
and keys or other application metadata are not added to accessible names.
A focusable, named horizontal scroll region keeps wide tables reachable at mobile
sizes. `GridRow.message` is a
plain application-provided row feedback message, associated with cell wrapper groups.
Optional `FieldRendererContext.describedBy: readonly string[]` associates external
feedback with the host wrapper and is also available to renderers. These are minimal
future error hooks, not error classification, summaries or a validator.

Exact values remain `string | boolean | null`. INTEGER/DECIMAL strings never pass
through Number, parseFloat or native numeric conversion. Invalid-looking drafts
such as `-` and `1e-` remain unchanged. Values, row keys and order live in application
inputs and survive theme changes. No normalization, semantic range checks or
presence envelope is introduced.

## Evidence and remaining acceptance

`tests/grid.test.mjs` covers admission, exact scalars, immutable keyed intents,
capability suppression, index shifts, placement and theme fallback.
`tests/fixtures/grid-components.ts` pins public type boundaries. The installed APF
testbed scenario `/default-theme/?scenario=grid` supplies a neutral header and two
collections using only public exports. `tests/browser/specs/grid.spec.mjs` covers
lists, application-owned updates, multiple tabs, collection-only groups, fallback,
protected references, optional cells, five packaged themes and frame replacement,
focus, synthetic events and desktop/mobile scrolling. Captures are retained at
`artifacts/testbed/grids/`; they are review candidates, not approved release baselines.

GRID-001 and GRID-002 are partially met at the full 1.0 acceptance level: presentation
and keyed editing intents are implemented; aggregate saving and cancel/discard
require future STATE/application integration. GRID-003 remains partial: responsive
scrolling and accessible feedback hooks exist, but field/row/aggregate validation,
hidden-column error reveal and parent-save blocking remain pending. The [immutable editing core](document-state.md) implements tested portions of
STATE-001/STATE-002; validation and STATE-003–STATE-006 remain pending. A future AUR-STATE-001 session may consume `fieldChange`
and `collectionChange` together, apply effective updates and coordinate one parent
save/discard boundary. No independent row save or backend-generated identity policy
is defined here.

## Neutral list interaction ports (AUR-LIST-PORTS-001)

### Audit and scope

The baseline `ListGrid` already supplied keyed rows, duplicate-label disambiguation,
exact read-only cells, a named horizontal scroll region, `rowSelected`, and retained
theme frames. ERBAS's read-only reference files `resource-screen.ts`,
`resource-screen.html`, `models.ts` and `resource-ui.spec.ts` show additional checkbox
selection, primary/secondary sorting, search/filter inputs and offset paging. Its
selection uses row references and clears on page load; query application interprets
metadata types, nulls, AND operators and sort syntax, then fetches records. Those
policies and the tested HTTP offset/limit protocol belong to ERBAS/adapters.

The demonstrated AUR gaps were controlled multiple-key selection and list-local
query/pager presentation. This increment adds those ports to the existing `ListGrid`;
it does not replace ResourceScreen or import its metadata, scalar decoder, max
selection rule, transport, authorization, action targets or query dialect. Existing
consumers and `ListGridContext` literals need no changes. `DetailGrid` is unchanged.

### Controlled selection and interaction locks

Optional `[selectedKeys]: readonly string[]` enables a checkbox column in addition
to any legacy single-selection buttons. Omit the input to retain the old layout.
An empty array enables multiple selection with nothing selected. Keys are the same
opaque, nonempty application identities as `GridRow.key`; duplicate selected keys
reject. Row labels may repeat and use the existing presentation-only accessible
suffixes; labels never become event identities.

`selectionChange: ListSelectionChange` emits frozen `{key, selected: boolean}` for
an explicit change on a current-page row. It never also emits `rowSelected`. The
legacy selection button continues to emit exactly one opaque key through
`rowSelected`, independently of multiple selection. Unchanged/unknown imperative
targets do not emit. Applications accept or reject each intent and supply replacement
`selectedKeys`; the checkbox restores the supplied state if the owner does not echo
a change. No internal selected-row store or optimistic application update exists.

Keys outside the current page remain in the supplied selection, with a readable
selected/outside-page count. Page/context changes never clear, prune or select keys
and emit no selection intents. There is no automatic select-all, selection limit,
range selection, bulk action policy or persistence of row objects.

New `[disabled]`, `[busy]` and `[readOnly]` boolean inputs default to false and block
all list interaction intents, including synthetic events and legacy activation.
Busy renders a loading status and aria-busy while retaining the supplied rows and
controls. Readonly is a presentation interaction lock, not an authorization or row
editing policy. Text query inputs stay readonly while busy/readonly; checkbox,
choice and button controls use their existing native disabled semantics. Disabling
a focused native control can move focus according to browser behavior.

### Pager

Optional `[paging]: ListPaging` supplies:

```ts
const paging: ListPaging = {
  offset: 0, pageSize: 25, total: 102, previous: false, next: true,
};
```

Offsets/totals must be nonnegative safe integers; pageSize must be a positive safe
integer. `total` may be absent, including on an empty page. `previous`/`next` are
explicit application availability flags. Previous also requires offset > 0; Next
also respects a known total and safe offset arithmetic. No inference is made from
current row count: a short or empty page can still have an available next page.
An empty known-zero-total page has no next page. Out-of-range offsets are retained
so applications can provide corrected paging after deletions or stale responses.

`pageChange: ListPageChange` emits frozen `{direction, offset, pageSize}`, with
`direction: 'previous' | 'next'` (the existing choice paging vocabulary), the requested
offset and supplied size. Previous clamps only its requested offset to zero; Next
adds pageSize. The component never changes its current page, fetches rows, resets a
query or clears selection. Applications supply the resulting page and handle pending
requests, errors, cancellation and stale response ordering. First/last boundaries
are covered by the previous/next controls; arbitrary page jumps and page-size
choosers are not justified by the current fixture and remain unimplemented.

### Query presentation, not a query model

Optional `[query]: ListQuery` supplies an ordered `inputs: readonly ListQueryInput[]`
and optional `applyLabel`. Each input has a unique stable `id`, accessible `label`
and exact string `value`, optional disabled/readOnly flags and optional plain-text
`message`. These IDs identify presentation inputs, not backend properties or paths.
Omit an input to omit a capability. Applications can supply independent primary and
secondary sort inputs or separate filter field/operator/value controls as needed.
AUR does not impose semantic roles or construct an expression tree.

An input without `choices` reuses the existing themed STRING renderer. An input with
`choices: readonly ChoiceOption[]` reuses the existing ENUM renderer and opaque
value/label options used by selectors. Values are unique strings; labels may repeat.
The current value must be explicitly supplied in choices, including a default/none
option if desired. No first choice, nullable placeholder, null/absence buttons or
paged-selector UI is invented. The internal form outlet mounts these scalar artifacts
directly, retaining its existing theme/focus mechanism without creating a form or
another document editing state. Third-party ENUM renderers must honor the existing
documentInput placeholder and edit restrictions contract.

```ts
const query: ListQuery = {
  inputs: [
    { id: 'search', label: 'Search', value: '  exact text  ' },
    { id: 'primary', label: 'Primary sort', value: '', choices: [
      { value: '', label: 'Default order' },
      { value: 'sort-token', label: 'Name ascending' },
    ] },
    { id: 'predicate', label: 'Filter text', value: '1e-' },
  ],
};
```

`queryChange: ListQueryChange` emits frozen `{id,value}` per actual user edit.
Applications echo accepted edits into their query input snapshots; strings retain
whitespace, empty text, numeric-looking drafts, opaque tokens and Unicode exactly.
There is no Number/boolean/date conversion, trimming, backend operator mapping,
implicit null rule or validation. Native single-line text controls retain their
usual browser text-entry behavior. Unknown choices, non-string values and blocked
input edits do not emit. Supplied messages are display evidence, not AUR validation.

Only an explicit Apply query button activation or `applyQuery()` call emits
`queryApply: readonly ListQueryChange[]`, an immutable snapshot of all supplied
input IDs/values, including readonly/disabled inputs. The application decides which
values participate in a request. Editing, mounting, context refresh and theme changes
do not apply anything. Keyboard users Tab to Apply and activate with Enter/Space;
there is no implicit text-input submission or debounce. No query intent automatically
requests a new page or changes selected keys.

```html
<aur-list-grid [context]="list" [selectedKeys]="selectedKeys"
  [paging]="paging" [query]="query" [busy]="loading"
  (rowSelected)="openKey($event)" (selectionChange)="acceptSelection($event)"
  (pageChange)="requestPage($event)" (queryChange)="updateQueryDraft($event)"
  (queryApply)="applyApplicationQuery($event)" />
```

### Acceptance and limits

Query views track stable input IDs; table views track stable row keys/column IDs.
The existing retained projection/frame mechanism preserves nodes and focus through
all five reference themes, structural grid frame replacement and unrelated context
updates. Changing logical identities, input renderer kinds or removing a page row
is an application lifecycle change; focus is not transferred automatically to a
different row when the focused row leaves a page. Selection keys remain owner-held.
Query labels wrap and wide tables remain inside the named keyboard-scrollable region.

`tests/list-ports.test.mjs` and compile-time fixtures cover controlled/legacy channels,
selection across pages, malformed data, immutable intents, offset boundaries/unknown
totals, safe arithmetic, locks, exact text and explicit application. Installed APF
`list-ports.spec.mjs` covers rejected/accepted checkbox intents, repeated labels,
shared-key DOM retention across pages, empty pages, query drafts and application,
synthetic suppression, no fetch/XHR, keyboard controls/scrolling, long labels,
all five themes plus structural grid frames, High Contrast and desktop/mobile layouts.
Inspect `/default-theme/?scenario=list-ports` in the private testbed. Existing list,
form, grid, editor and selector tests continue to cover legacy consumers.

Remaining MVP boundaries are deliberate: applications own query interpretation,
filter validation/AND/null/operator semantics, sorting priorities, selected-key
persistence, response acceptance and business actions. This is not complete ERBAS
adoption, a data source/query engine, a general filter builder, virtualized table,
select-all model, arbitrary pager or accessibility certification in other browsers
and assistive technologies. No reference repository or wire contract is changed.
