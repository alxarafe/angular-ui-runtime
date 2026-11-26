# Reusable form composition (AUR-FORM-001)

AUR-EDITOR-BINDINGS-001 now connects these implemented public APIs through
[document editor bindings](editor-bindings.md). That contract supersedes historical
statements below that form/grid session integration and validation feedback are
entirely pending. It adds opt-in lossless editing channels, derived contexts and
keyed reveal without replacing the existing state/validation engines. Full catalogue,
consumer and visual acceptance remain separate.

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
Its DOM lookup is explicitly scoped to form-owned field outlets; nested detail
cells with matching column IDs cannot capture a header-field reveal.
It returns false for unknown/excluded fields. It neither constructs error summaries
nor validates data. A future validation/document host may call it for issue paths;
no temporary validation, dirty, save/discard or grid engine is included here.

## Existing theme engine, additive form port

`ThemeDefinition.components?: Partial<ThemeComponents>` admits `form`, `listGrid` and `detailGrid` presentation frames.
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
`FormComponent` proposal is not exported or treated as implemented. The proposed whole-document component keys remain unpublished; typed menus use
the independent opt-in shell contract.

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

## Historical multiple-collection design (implemented by AUR-GRID-001)

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

## Retained application content (AUR-FORM-SLOTS-001)

Import `FormSlot` alongside `FormComposition` to declare locally compiled templates
as direct children of `aur-form`. The optional `LayoutGroup.slots` list contains
`FormSlotReference` objects (`{id: string}`). Slots live within the group's existing
section and tab; no additional composition or theme engine is involved.

```html
<aur-form [definition]="definition" [contexts]="contexts" [layout]="layout"
  [readOnly]="readOnly">
  <ng-template aurFormSlot="extension" let-readOnly="readOnly">
    <app-extension [readOnly]="readOnly" [record]="record"
      (changed)="handleExtensionChange($event)" />
  </ng-template>
</aur-form>
```

```ts
// Inside an existing LayoutSection.groups entry:
const group: LayoutGroup = {
  id: 'extension-group', label: 'Extension', fields: [],
  slots: [{ id: 'extension' }],
};
```

A group renders fields, then collections, then slots, preserving order within each
list. Use consecutive groups to interleave custom content and standard content.
Existing root/tab/section contextual actions retain their positions and policy.
No `FormDefinition` changes are required. Templates are not field descriptors,
collection contexts or document paths; they cannot capture field/collection fallback.

`composeForm(definition, layout?, slotIds?)` accepts the available template identities
as an optional third argument. `FormComposition` derives them from its direct
`FormSlot` children. First valid placement wins across the entire form. Missing
identities diagnose `unknown-slot`; later references diagnose `duplicate-slot`;
both are skipped without user-visible diagnostic markup. Duplicate template
declarations, empty/non-string identities and malformed references reject with an
error. Identities are exact, case-sensitive strings. Declared but unreferenced
and missing templates are not rendered; there is no implicit custom fallback.
Only `ng-template[aurFormSlot]` declarations are supported, not component classes,
HTML strings, backend executable templates or dynamic compilation. Place nested
application components inside a supported template instead.

Each placed template has one Angular embedded view. Tab/section hiding keeps it
mounted; context refreshes update bindings without creating another component.
The existing retained form frame projects these same nodes through theme changes,
including structural frame replacement, preserving local state, DOM identity and
focus on surviving controls. Hidden controls leave the keyboard/accessibility tree;
showing a panel does not automatically return focus to a previously hidden control.
Changing/removing the template, its group/container identities or its placement is
an application lifecycle change and may recreate its view. This guarantee covers
stable layout/template identities, not arbitrary layout rearrangement.

`FormSlotContext` exposes only `readOnly: boolean`, derived from the form input.
Applications explicitly pass it to their components and enforce editing rules.
AUR does not intercept their events, rewrite inputs, disable an entire subtree or
infer document-session flags. Application-owned disabled states, authorization,
inputs/outputs, routing, loading, validation and persistence remain application
responsibilities. Readonly does not disable contextual actions. Existing field and
grid restrictions remain unchanged. Custom controls need their own labels, keyboard
behavior, responsive sizing and theme-compatible styles (prefer inherited typography
and current colors, including High Contrast); AUR provides the retained layout
container, not certification of arbitrary application content.

Unit/type probes cover deterministic placement, unsupported references and legacy
fallbacks. Installed-APF Chromium probes in `form-slots.spec.mjs` cover mixed fields,
grids and custom components, multiple slots, ordering, single construction, retained
state and focus, contextual actions, readonly/disabled application bindings, tab
keyboard navigation, collapse and all five themes plus structural frame replacement
at desktop/mobile widths. Inspect `/default-theme/?scenario=form-slots` in the private
testbed. Existing form/grid/editor suites cover consumers without slots.

## Feedback navigation completion

AUR-FEEDBACK-001 adds an optional callback to `revealPath(path, completed?)` while
preserving its immediate recognition/scheduling boolean. `completed(focused)` reports
actual DOM focus exactly once, including false for unknown/unfocusable targets,
destruction before rendering or independently moved focus. Existing tab expansion,
section collapse state and field/collection fallback remain the sole composition
mechanism. Controlled view state must still be echoed before focus can succeed.
Use the existing typed paths and the public `FeedbackSummary` to navigate the first
focusable error, keeping root messages and deferred checks separate; see the
[summary/focus contract and audit](editor-bindings.md#reusable-summary-and-focus-interaction-aur-feedback-001).
No editing, touched state, validation or submission is triggered by feedback navigation.
