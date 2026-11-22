# Optional controls (AUR-EXTENSIBILITY-002)

Implemented extension to the existing theme engine. The twenty `ThemeArtifact`
identifiers, complete-default requirement and legacy `resolve()` behavior remain
unchanged. This explicitly refines the closed registration catalogue described in
UI Runtime 1.0 THEME: additional identifiers belong to `controls`, never `overrides`.
The future form/menu/grid component proposal is still unimplemented and separate.

`provideThemeRuntime(themes, definitions?)` and `new ThemeRegistry(themes,
definitions?)` accept optional `OptionalControlDefinition` entries. Existing calls
remain valid. Definitions contain an application-owned ID, a domain and ordered
alternative IDs. ThemeDefinition gains an optional `controls` map of ID to
`{ component, domain }`. No optional ID is required in any theme, including default.
Unknown IDs, duplicate definitions, cycles, unknown alternative targets, malformed
domains and components without compiled standalone `context`/`valueChange` bindings
are rejected. Registration captures immutable snapshots; Angular component types
are retained by reference. Reflection checks binding names, not event payload types.

`ThemeResolver.resolveControl(id)` returns `{ component, control, theme }`, or throws
an explicit diagnostic when the ID is unknown or no compatible representation exists.
It searches the requested ID followed by ordered depth-first alternatives (first
visit wins), first in the active theme, then in default. Alternatives never inherit
components from other non-default themes. A requested control in default therefore
loses to a compatible alternative in the active theme.

## Exact finite domains

This minimal implementation supports **finite, explicitly enumerated** domains.
`ControlDomain` has a nonempty semantic token and a nonempty unique list of
`FieldValue` values. A token denotes shared meaning, not merely string/boolean type.
The caller owns token governance; the engine cannot infer business semantics.
Alternative definitions and renderer capabilities must have the same token and
contain every requested value, including null when allowed. Equality is lexical:
`'1'` and `'1.0'` differ. No numeric conversion, rounding or value transformation
occurs. Exact large/fractional strings, booleans and null are retained.

Range, decimal and unbounded domain descriptors are **not implemented**. A finite
list can express a discrete scale exactly but should not enumerate an unbounded
numeric domain. Renderer declarations are trusted capability assertions; browser
checks must verify their actual behavior. Resolution does not validate an editing
value or implement field validation, error state, dirty tracking or focus handling.
The owning host keeps that state and restores logical focus when replacing views.

## Repository-only rating probe

Open `/?scenario=rating` through `./bin/testbed`. This internal QA scenario uses
installed APF exports, the same registry/resolver and synthetic themes. It does not
add a user navigation entry or publish widgets. The default representation has
five stars and half-star positions for exact string scores 0–10, step 1. Native
range keyboard interaction supplies an accessible label, bounds and value text;
null is announced as “No rating” and can be set with Clear rating. Disabled and
read-only contexts suppress edits. The alternative theme supplies a numeric selector
with the same domain, including null, rather than assuming a UINT8 semantic type.

QA parameters `minimum`, `maximum` and `step` accept exact integers with positive
step and at most 100 intervals. `stars=10` uses full-star increments for 0–10;
`stars=3` cannot represent every requested score as whole/half stars and resolves
to the numeric selector even in default. Invalid scale configurations diagnose
instead of rounding. Scores outside ±1,000,000 use the exact string-valued
selector to avoid native range precision loss. These are QA configuration conventions, not new public
renderer context properties. The probe preserves fixture-owned value, dirty flag,
synthetic error and logical focus; it is not a document editing engine.

Automated engine coverage is in `tests/optional-controls.test.mjs`. Browser coverage
is in `tests/browser/specs/rating.spec.mjs` at both configured viewports. Candidate
captures are written to `artifacts/testbed/rating/`; passing tests do not approve
visual baselines or establish full accessibility conformance. The future three-form
testbed, manuals, forms, grids and document state remain pending separate increments.
