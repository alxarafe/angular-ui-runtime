# Optional controls (AUR-EXTENSIBILITY-002, corrective revision 001)

The existing registry/resolver supports optional controls without changing the
20 `ThemeArtifact` identifiers, complete-default rule or `resolve()` behavior.
No optional control is required in any theme. This refines the closed registration
catalogue in UI Runtime 1.0 THEME; the proposed form/menu/grid layer remains pending.

## Identity, field domain, presentation and capability

These are separate contracts:

- `OptionalControlDefinition.id` identifies a control and its ordered alternatives.
  Its `domain.semantic` is the shared meaning, not merely a primitive type. Its
  finite `domain.values` supplies the **legacy default request**.
- `ControlRequest.domain` is the effective domain of one field. Explicit requests
  may contain values outside the registered legacy default, but must keep the
  requested control's semantic token. Register once, resolve independently per field.
- `ControlRequest.presentation` contains flat, instance-owned visual options
  (`string | number | boolean`). Exact scores and constraints remain strings;
  small visual counters such as star count may use numbers. Unknown or unsupported
  options must be rejected or make the representation incompatible.
- `OptionalControlRenderer.domain` is its static capability for requests without
  presentation options. Optional `capabilities(request)` returns the effective
  domain for that configuration, or `undefined` to skip that representation. A
  static renderer cannot silently ignore nonempty presentation options.

Existing `provideThemeRuntime(themes, definitions?)`, `new ThemeRegistry(themes,
definitions?)`, theme `controls` maps and `resolveControl(id)` calls remain valid.
The additive call `resolveControl(id, request)` uses the same registry and selection.
`FieldRendererContext.control?: ControlRequest` optionally carries the same request
into a renderer. Legacy renderers need no changes. The host must pass the request
used for resolution; the resolver does not mount components or bind their inputs.

For example, with one registered `rating` control and compatible theme capabilities:

```ts
const request = (maximum: number, stars: number, nullable: boolean): ControlRequest => ({
  domain: {
    semantic: 'qa-discrete-rating',
    values: [ ...(nullable ? [null] : []),
      ...Array.from({ length: maximum + 1 }, (_, position) => String(position)) ],
  },
  presentation: { minimum: '0', maximum: String(maximum), step: '1', stars },
});
const quality = request(5, 5, true);
const satisfaction = request(10, 5, false);
const service = request(10, 10, true);
resolver.resolveControl('rating', quality);
resolver.resolveControl('rating', satisfaction);
resolver.resolveControl('rating', service);
// Each field passes its own request as context.control when mounting its result.
```

Here numbers build only a small finite list of visual positions; exact application
scores never round-trip through Number. This example does not define integer ranges
or a backend metadata vocabulary in the library.

## Resolution and validation

Resolution returns `{ component, control, theme }`. It visits the requested ID then
ordered depth-first alternatives (first visit wins), first in the active theme,
then in default. An active-theme alternative precedes the requested default renderer.
There is no inherited non-default theme chain. Each candidate must share the semantic
token, and its effective capability must cover **every exact field value**, including
null where requested. Legacy calls additionally retain the original definition-domain
coverage rule. Explicit requests use the candidate definition for semantic identity,
not as a global restriction on all instances.

Unknown IDs, duplicate identities, cycles, unknown alternatives, malformed domains,
nonfinite/nested presentation options, invalid capability functions and missing
compiled standalone `context`/`valueChange` bindings are diagnosed. Unknown request
semantics and absence of a compatible representation also diagnose. A malformed
capability result diagnoses; a valid but insufficient result is skipped. Configuration
validators may throw a specific diagnostic; exceptions are not silently swallowed.

Registration captures immutable domain/map/alternative snapshots. Each resolution
passes a frozen request, domain, value list and presentation map to capabilities.
Functions and Angular types remain references. Capabilities are trusted, synchronous,
deterministic declarations: avoid mutable captured instance configuration. They must
honor applicable editing operations, including explicit null selection when admitted.
Reflection verifies names, not payloads or behavior; browser testing remains necessary.
No resolution cache or global field configuration is introduced.

## Exact finite domains and extension boundary

Only **nonempty finite unique lists** of `FieldValue` are implemented. Null, zero
and empty string differ; equality is lexical (`'1'` differs from `'1.0'`). No rounding,
normalization or value transformation occurs. Semantic token governance belongs to
the caller. The engine cannot infer business meaning from matching strings.

Intervals and open domains are outside this increment. A viable future additive
extension is a discriminated domain descriptor plus exact inclusion checking in the
same resolver/capability boundary, retaining this finite shape and legacy calls.
That requires a separately reviewed contract and bounded exact arithmetic; do not
encode intervals as presentation options and claim the engine validates them.
Current QA constructs finite integer lists before calling the public API.

## Multi-instance repository QA

`/?scenario=rating` remains one technical scenario using installed APF exports.
It shows Quality (0–5 / five stars), Satisfaction (0–10 / five stars with halves),
Service (0–10 / ten stars), an incompatible three-star request, an exact large-integer
request and a negative-minimum/step-2 request, simultaneously under one control ID.
No URL parameter determines their configuration. The three-star instance falls back
to numeric without changing the others. Large integers also use string-valued numeric
options rather than a native range. The scale helper bounds input length to 128
characters and interval count to 100; it rejects inconsistent bounds, nonpositive or
nondividing steps and invalid star counts. These are QA limits, not public numeric
validation or published widgets.

Stars are **visual feedback for a native range**, not clickable star buttons.
Use the range with pointer/arrow keys; a labelled component-owned “No rating” button
emits null when allowed. Nonnullable fields omit that operation in both representations.
Numeric options use positional DOM tokens, preserving null, empty string and exact
score identity without sentinel collisions. Disabled/read-only score and clear
handlers suppress events. Range capability permits only whole/half stars and small
exact integer scores (±1,000,000); incompatibility falls back without rounding.

Each outlet scopes focus capture/restoration to its own DOM, restores only after
replacement when focus belonged to it, and avoids stealing subsequent user focus.
Alt+T switches the theme while leaving focus in place; clicking theme buttons leaves
focus on the button. Values, event counters, QA dirty flags and synthetic errors are
fixture-owned. This is not document validation, dirty reconciliation or saving.

Engine/boundary tests are in `tests/optional-controls.test.mjs` and
`tests/rating-configuration.test.mjs`; browser tests are in
`tests/browser/specs/rating.spec.mjs` at both viewports. Captures under
`artifacts/testbed/rating/` are candidates, pending human approval. Full accessibility
conformance and the future three-form testbed, forms, grids and manuals remain pending.
