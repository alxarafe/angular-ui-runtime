# Reusable form composition (AUR-FORM-001)

Implemented first increment, not full UI Runtime 1.0 FORM/STATE/GRID acceptance.
The public standalone `FormComposition` component (`aur-form`) and pure
`composeForm()` function live in the core APF package. The testbed only supplies
synthetic inputs and observes public events.

## Boundaries and public inputs

- `FormDefinition` is an effective catalogue with form ID/label, ordered field
  descriptors and optional ordered `ContextAction` entries. A `FormField` has an
  ID, `ValuePath`, base `FieldArtifact` and optional explicit `excluded` flag.
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
import { FormComposition, type FormDefinition, type FormFieldContexts } from '@alxarafe/ui-runtime';

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
wins. Unknown paths, duplicates and excluded references produce visible diagnostics
and are skipped. Every eligible omitted field appears once in the always-accessible
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
The twenty base artifacts and their complete-default/fallback rules are unchanged.

`FormPresentation` receives only `{ id, label }` and projects host-owned content.
This deliberately refines D5's unpublished whole-document form port: visual frames
cannot own field views, data or tab/collapse state. The unpublished document-aware
`FormComponent` proposal is not exported or treated as implemented. Other proposed
component keys (menus/listGrid/detailGrid) remain unimplemented and are rejected.

Base field renderers are resolved through the existing `resolve(artifact)` contract.
Form field selection does not yet provide an optional-control ID binding; optional
control resolution remains available independently through its existing public API.
A frame replacement retains the content views. Field renderer replacement maps focus
within the affected field; combined frame/field replacement restores the original
logical DOM identity within the retained form. Restoration never overrides focus
already moved elsewhere. CSS-only changes retain component/native node identity.
The default frame composes neutral form markup and styling; themes may wrap it with
compatible presentation. A deliberately inaccessible custom frame is not made
accessible by reflection, so real theme/browser acceptance is still required.

## Evidence and remaining scope

`tests/form.test.mjs` covers placement, exclusions, action policy, paths, invalid
catalogues and registry/resolver integration. `tests/fixtures/form-components.ts`
compiles valid/invalid ports and proposed-path/layout compatibility.
`tests/browser/specs/form.spec.mjs` mounts installed APF components at both viewports:
absent layouts, diagnostics, all action scopes, empty/action-only containers, tab
keyboard behavior, collapse, read-only suppression, external reveal, controlled
visual state, exact values, five unchanged themes and simultaneous frame/field focus
replacement. Captures are under `artifacts/testbed/forms/`, pending human approval.

Inspect `/default-theme/?scenario=form` with `./bin/testbed`. This is a technical
scenario in the existing private fixture, not a new main-menu demo or a replacement
for the agreed future basic/header-details/extensions forms. No reference repository,
HTTP endpoint, document persistence, business rule, editable grid, version or package
publication changes are part of AUR-FORM-001. Full field validation, help/error
wrappers and summaries, immutable-on-update policy, document editing state, grids,
consumer adoption and comprehensive accessibility approval remain future work.
