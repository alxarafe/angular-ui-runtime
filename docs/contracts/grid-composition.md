# Reusable grid composition (AUR-GRID-001)

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
hidden-column error reveal and parent-save blocking remain pending. All STATE
requirements remain pending. A future AUR-STATE-001 session may consume `fieldChange`
and `collectionChange` together, apply effective updates and coordinate one parent
save/discard boundary. No independent row save or backend-generated identity policy
is defined here.
