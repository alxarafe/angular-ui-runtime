# Reusable form composition (AUR-FORM-001)

AUR-GRID-001 additively implements the collection extension described in
[grid composition](grid-composition.md): `FormDefinition.collections`,
`LayoutGroup.collections`, `collectionContexts` and `collectionChange`, plus
composed/fallback collection results. Historical future-grid statements below
describe the FORM-001 baseline and are superseded by that contract. Existing
field/action placement and outputs remain compatible. The same projecting frame
port now also admits optional `listGrid` and `detailGrid` presentations.

Implemented first increment, not full UI Runtime 1.0 FORM/STATE/GRID acceptance.
The public standalone `FormComposition` component (`aur-form`) and pure
`composeForm()` function live in the core APF package. The testbed only supplies
synthetic inputs and observes public events.

## Boundaries and public inputs

- `FormDefinition` is an effective catalogue with form ID/label, ordered field
  descriptors and optional ordered `ContextAction` entries. `FormFieldDefinition` is a discriminated union of the existing `FormField`
  interface and `OptionalControlFormField`. Both have an ID, typed `ValuePath` and
  optional explicit `excluded` flag. Legacy fields retain `artifact` and optionally
  `kind: 'artifact'`; optional fields require `kind: 'control'` and `controlId`.
  The two mechanisms are mutually exclusive, including explicitly undefined extra
  mechanism properties at runtime. The legacy interface remains extendable.
- `FormFieldContexts` is a separate renderer-context map keyed by field ID. Values,
  labels, edit flags and choices belong to the application, not the form definition.
  Excluded fields need no context. Eligible fields require valid contexts with
  distinct DOM IDs. Context values remain exact `FieldValue` strings/booleans/null.
- `FormLayout` describes ordered tabs, sections, groups and field paths. Root, tab
  and section action references contain IDs. Extra labels/enabled flags on a
  reference never override the authoritative catalogue. The design proposal's
  `ContextAction` references are structurally assignable to the smaller ID port.
- `readOnly` suppresses all field edits in addition to individual context flags.
  It does not invent action policy: applications supply each action's enabled state.

All inputs are readonly snapshots; supply new references when changing them. Form
and renderer DOM IDs must be unique among mounted forms. Paths use property names
and stable row keys, never array indexes or dotted-string traversal. The host
compares paths as typed tuples; it does not dereference or mutate a document tree.

```ts
import { FormComposition, type FormDefinition, type FormFieldDefinition, type FormFieldContexts } from '@alxarafe/ui-runtime';

const definition: FormDefinition = {
  id: 'editor', label: 'Editor',
  fields: [{ id: 'title', path: [{ kind: 'property', name: 'title' }], artifact: 'field.STRING' }],
  actions: [{ id: 'inspect', label: 'Inspect', enabled: true }],
};
const contexts: FormFieldContexts = {
  title: { id: 'editor-title', label: 'Title', value: 'Application-owned text' },
};
// Import FormComposition in a standalone consumer's imports.
```

```html
<aur-form [definition]="definition" [contexts]="contexts"
  (fieldChange)="applyFieldIntent($event)" (actionSelected)="handleActionId($event)" />
```

`fieldChange` emits `{ id, path, value }`. The application updates its own contexts;
the host never silently stores a second value. Disabled/read-only contexts suppress
forwarding even if a renderer emits. `actionSelected` emits an opaque string ID,
never HTTP, routing, authentication or an executable business callback. Buttons are
`type="button"`; native form submission is prevented and has no save meaning.

## Deterministic placement

`composeForm(definition, layout?)` returns `FormCompositionResult`: ordered composed
tabs/sections/groups, unplaced eligible fields, root actions and diagnostics. Result
containers, paths and derived entries are frozen; input objects are not mutated.
Without a layout, fields appear in catalogue order in a labelled simple fieldset,
and effective actions appear at root. Empty layouts retain this fallback.

For explicit layouts, traversal follows input order; the first valid field placement
wins. Unknown paths, duplicates and excluded references produce programmatic diagnostics
and are skipped. The component renders no diagnostic notification, codes, IDs, paths
or excluded/unauthorized references, including hidden content and ARIA attributes.
Consumers and QA can inspect `composition().diagnostics`; they must keep protected
metadata out of their own user-facing views. Every eligible omitted field appears once in the always-accessible
“Additional fields” fieldset outside the tabs. Excluded fields are never resurrected.
Missing references cannot claim a placement or suppress fallback.

Actions use the same first-valid rule, visiting root, then each tab's actions and
section actions in order. Eligible unplaced actions are appended at root in catalogue
order. Unknown/duplicate action references diagnose. Applications omit unauthorized
actions from the catalogue; layout metadata cannot recreate them.

Malformed definitions, duplicate catalogue IDs/field paths, duplicate container IDs
within a parent, invalid renderer bindings and inconsistent collapse settings reject.
Container IDs are scoped by parent; DOM IDs encode the full form/container tuple.
Unknown references are recoverable diagnostics, not malformed-definition exceptions.

## Accessible visual state and integration boundary

Tabs use labelled tablist/tab/tabpanel relationships, roving tabindex, automatic
activation with wrapping Left/Right and Home/End, plus native click/Enter/Space.
Sections expose labelled headings and collapse buttons with expanded/controls state.
Inactive panels and collapsed sections use `hidden`, keeping views mounted. Empty
tabs/sections/groups remain named and show an empty message. Action-only containers
remain reachable. The root form has an accessible name.

The host owns only `FormViewState`: selected tab and explicit section-collapse
choices. These survive theme changes. Optional `[viewState]` enables controlled
application state; the application must echo `viewStateChange` into that input.
Without it, the instance keeps local visual state. Unknown selected tabs fall back
to the first tab; unknown collapse references have no effect. Changing the logical
form/document identity is an application lifecycle decision: remount or explicitly
reset controlled visual state as appropriate.

`revealField(path): boolean` is a neutral integration boundary: it selects the
containing tab, expands its section and focuses the eligible input after rendering.
It returns false for unknown/excluded fields. It neither constructs error summaries
nor validates data. A future validation/document host may call it for issue paths;
no temporary validation, dirty, save/discard or grid engine is included here.

## Existing theme engine, additive form port

`ThemeDefinition.components?: Partial<ThemeComponents>` currently admits only `form`.
`ThemeResolver.resolveComponent('form')` resolves active override → application
`default` override → core default frame. `ThemeRegistry` validates standalone compiled
components with the `context` input and exactly one catch-all projection, and freezes
the optional map. The same provider composition, theme selection and resolver serve
this port, field rendering and existing artifacts; no second theme registry exists.
Old definitions still register without changes, including all five packaged themes.
The fourteen base artifacts and their complete-default/fallback rules are unchanged.

`FormPresentation` receives a dedicated `{ id, label }` object and projects
host-owned content. The full catalogue, including excluded references, is never
forwarded to frame presentation inputs.
This deliberately refines D5's unpublished whole-document form port: visual frames
cannot own field views, data or tab/collapse state. The unpublished document-aware
`FormComponent` proposal is not exported or treated as implemented. Other proposed
component keys (menus/listGrid/detailGrid) remain unimplemented and are rejected.

Legacy field renderers use the existing `resolve(artifact)` contract. Optional
fields use `resolveControl(controlId, request)` in the same resolver, taking the
instance request exclusively from `FieldRendererContext.control`. One reactive
binding selects the component and supplies its effective request to the mounted
renderer. If omitted, the existing registered legacy default request is used and
is also bound to the renderer. Ordered active-theme alternatives still precede
default-theme representations. Unknown IDs, incompatible semantics and requests
with no compatible representation throw; no base artifact is silently substituted.
The host does not normalize/coerce exact values or introduce semantic validation.

Changes to the context/request or descriptor are reactive. A changed component
restores scoped logical focus; a changed request selecting the same component only
updates its context, retaining the native node. Disabled/read-only suppression
continues across both mechanisms. Definitions/layouts and contexts remain separate.
For example, a field may now be declared as:

```ts
const optionalField: FormFieldDefinition = {
  id: 'quality', path: [{ kind: 'property', name: 'quality' }],
  kind: 'control', controlId: 'rating',
};
// contexts.quality.control supplies its own finite domain and presentation options.
```

Existing `FormField` literals and extensions remain valid. Code consuming composed
field lists must narrow `field.kind === 'control'` before accessing the optional ID;
base `artifact` is available in the other branch. No required artifact is added.
A frame replacement retains the content views. Field renderer replacement maps focus
within the affected field; combined frame/field replacement restores the original
logical DOM identity within the retained form. Restoration never overrides focus
already moved elsewhere. CSS-only changes retain component/native node identity.
The default frame composes neutral form markup and styling; themes may wrap it with
compatible presentation. A deliberately inaccessible custom frame is not made
accessible by reflection, so real theme/browser acceptance is still required.

## Future multiple detail collections (not implemented)

Future form/document composition must support zero, one or multiple independently
identified detail collections. No first-detail or single-detail slot is privileged.
Each collection needs a stable identity and typed `ValuePath`. Different collections
may occupy different tabs, sections or groups, and each may have its own columns,
rows, effective permissions and editing capabilities.

Collections belonging to one logical document may share one parent editing session
and save operation; this does not promise backend transaction atomicity. Independent
resources may retain independent lifecycles. AUR-GRID-001 will implement collection
rendering/editing; AUR-STATE-001 will provide the shared document-state boundary.
No collection placement member, public placement union, grid widget, persistence or
state engine is added here. Future work must extend the existing neutral layout/path
boundary compatibly after implementation evidence, not reinterpret a field path as
an implicit first collection or freeze an untested collection-placement schema.

## Evidence and remaining scope

`tests/form.test.mjs` covers placement, exclusions, action policy, paths, invalid
catalogues and registry/resolver integration. `tests/fixtures/form-components.ts`
compiles valid/invalid ports and proposed-path/layout compatibility.
`tests/browser/specs/form.spec.mjs` mounts installed APF components at both viewports:
absent layouts, programmatic diagnostics and DOM non-disclosure, all action scopes, empty/action-only containers, tab
keyboard behavior, collapse, read-only suppression, external reveal, controlled
visual state, exact values, five unchanged themes and simultaneous frame/field focus
replacement. Corrective tests also cover optional fields with independent domains/
presentation, exact large strings, boolean/null values, compatible alternatives and
reactive request-driven renderer replacement. Captures are under `artifacts/testbed/forms/`, pending human approval.

Inspect `/default-theme/?scenario=form` with `./bin/testbed`. This is a technical
scenario in the existing private fixture, not a new main-menu demo or a replacement
for the agreed future basic/header-details/extensions forms. No reference repository,
HTTP endpoint, document persistence, business rule, editable grid, version or package
publication changes are part of AUR-FORM-001. Full field validation, help/error
wrappers and summaries, immutable-on-update policy, document editing state, grids,
consumer adoption and comprehensive accessibility approval remain future work.
