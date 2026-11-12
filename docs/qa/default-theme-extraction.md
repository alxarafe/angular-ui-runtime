# Independent default theme extraction evidence

Follow-up: [AUR-THEME-EXTRACT-002](optional-theme-extraction.md) adds four separate
optional packages and extends the installed default testbed. The evidence/scope
below records the original extraction, not retroactive visual approval.

AUR-THEME-EXTRACT-001 extracts only the default theme. Alternative, Cyberpunk,
Vintage and High Contrast remain in ERBAS. No consumer repository was modified.

## Package and runtime boundary

`packages/themes/default/` is a separately compiled APF source package with its own
entry point, tsconfigs, license, attribution, source hashes, manifest and CSS.
It exports one complete `DEFAULT_THEME` with the reserved identity `default` and
exactly 20 artifact bindings. Eight field component implementations cover the
17 semantic mappings. `DEFAULT_ARTIFACTS` and the visual component classes are
also public; there is no application service, HTTP model or theme loader.

Core `@alxarafe/ui-runtime` remains a separate archive. It gains no implementation,
dependency on this theme or consumer-specific source. The theme imports only public
runtime ports and Angular Core. Angular/runtime are peers; tslib is its only
runtime dependency. No dependency versions or dependency locks are changed.

This is the private `0.0.0-experimental.0` theme, tested against runtime code at
`23e3bf40bf4c3dbad034d3deb71b3358075f51b3`, including the merged structural ports.
The local runtime archive still identifies as 0.2.0. That version coordinate
alone does not establish compatibility: the older 0.2.0 artifact used by ERBAS
lacks these ports and is unsupported. Theme builds explicitly check required
exports. Exact tested runtime/theme archive digests are recorded in generated
evidence. Coordinated release versions and peer ranges remain an explicit
prerequisite to any external distribution; publication is not authorized.

## Reproduce

Use the pinned ephemeral Docker toolchain, never host Node/npm/Angular:

```sh
./bin/test
./bin/check
./bin/theme-default
git diff --check
```

The full check retains strict TypeScript/tests, core production APF verification
and the unchanged disposable legacy consumer. Packing additionally builds/tests
the theme in a separate temporary workspace with a fresh locked toolchain and
an installed runtime tarball, without core source files or TS aliases. The
theme-only command repeats that isolated build using the existing runtime archive.
No ERBAS checkout, source fetch or unmerged QA branch participates.

The testbed performs its independent locked install, adds both generated archives
and checks that existing locked versions/sources/integrities are unchanged. Only
the explicitly requested runtime and default-theme packages may be added. Both
packages resolve from that workspace's node_modules. The original testbed and its
eight browser cases remain; a separate Angular configuration/entry/style bundle
serves `/default-theme/` for two additional Chromium cases. It imports the theme's
public entry and stylesheet export. The original synthetic fixture CSS does not
load on the extracted-theme page.

`./bin/testbed` exposes a local preview; open `/default-theme/`. Testbed-only
controls/data/evidence and all generated output remain outside both npm archives.
Private package contents are checked for ESM/declarations, exported CSS/manifest,
license/provenance, peer externalization and absence of tests/source/dev tooling.

## Coverage and limits

Unit/type checks cover the existing engine, complete compiled default, public
bindings, sparse/unknown fallback, exact string/null emission, ENUM index semantics
and blocked changes. Source boundary checks reject consumer/private imports and
resource/login styles. Dependency lock preservation retains its previous negative
tests and adds explicit two-archive coverage.

At 1280×800 and 390×844, Chromium checks all 17 actual renderer mappings and
application-observed results for BOOLEAN, STRING/TEXT, every integer width,
DECIMAL, UUID, DATE, TIME, DATETIME and ENUM. BINARY is output-only: its changed
value is supplied by the application and displayed, not emitted by an invented
file editor. Tests include null/indeterminate BOOLEAN, null-to-empty display with
no spurious emission, exact large numeric strings, seven-digit DATETIME, native
millisecond TIME and exact-text seven-digit TIME. ENUM null, declared empty string
and literal `Not set` remain distinct. Disabled/read-only native attributes and
mutation guards are checked across all editable mappings.

Native hrefs, nested navigation, disabled entries and action intent stay
application-owned. Shell/panel, all nine named regions and catch-all are exercised.
Sparse CSS fallback and an independently authored synthetic shell override retain
field values, app-owned DOM editing state and projected tools. The same registry/
resolver is used, with all omitted artifacts resolving directly to default.
Tests check labels, Tab/Enter, visible focus, retained-node focus after replacement,
horizontal reachability, and hit-testing each essential control for coverage.
Console/page/request/HTTP errors fail the browser case.

These are presentation tests, not the future 1.0 validation or document engine.
No decimal/integer/calendar/UUID validator, dirty/save/discard state, multi-menu
model, forms, grids, transport or backend integration is implemented. Native DATE
intermediate editing remains browser-controlled. Unsupported high-precision TIME
uses text deliberately; no format validation is claimed. Only Chromium is tested.

## Compare with ERBAS

The immutable implementation reference is ERBAS Client
`8d1573c315e03a6edbc92bd7b3d41d851bd54ab9`, default theme sources and artifact mapping.
PROVENANCE.json stores original file hashes; NOTICE lists adaptations under
Apache-2.0. AUR-QA-002 captures at application commit `8d1573c...` plus its recorded
dirty QA source hash are historical comparison candidates, not approved baselines
or build inputs. Its unmerged local task branch is not a dependency.

| Area | Retained / intentional difference |
| --- | --- |
| Palette and typography | Original light background/surface, text/border/accent/link/focus tokens and system typography. Theme styling is scoped instead of styling body/global controls. |
| Workspace | Original generic 15rem sidebar, 12rem intermediate sidebar, mobile stacking and 1–2rem content spacing. Login-specific and resource-screen layout selectors are excluded. |
| Fields | Original native controls, labels, exact text-number and DATETIME behavior, disabled/read-only guards and shared mappings. Generic field spacing/width are now attached to package-owned classes. |
| ENUM | Intentional correction: selected index distinguishes null from declared empty string; the latter gets an explicit accessible option label. |
| TIME | Native control retained for representable precision; more than three fractional digits use exact text to avoid invisible truncation/empty native display. |
| Navigation | Neutral native href/action tree replaces RouterLink/applicationRoute. Nested lists sit within one named navigation landmark. Applications now own current-state computation and router adaptation. |
| Slots | Public named-region projection replaces consumer extension injection. Contribution registration/order/state remain outside the theme. |
| Floating actions | Deliberately in normal flow, aligned at the content end. This avoids the fixed mobile overlay observed in historical QA. No important control is covered to imitate a visual reference. |
| Resource UI | Resource tables, forms, filters, login and business selectors stay with the application. This extraction is not a replacement for ERBAS's full application stylesheet. |

Different synthetic content, new projection wrappers and removal of resource styles
mean pixel equality would be misleading. Compare generic shell dimensions, palette,
control appearance and responsive placement, then review intentional differences
above. No production-theme visual approval follows from passing tests.

## Evidence and human review

Generated files outside both distributions:

- `artifacts/alxarafe-ui-runtime-0.2.0.tgz` and
  `artifacts/alxarafe-ui-theme-default-0.0.0-experimental.0.tgz`.
- `artifacts/theme-default-build.json`: package contents/digest, exact runtime
  digest, source commit/status/theme-source hash, locked toolchain hash and commands.
- `artifacts/testbed/build-evidence.json`: both installed package identities,
  digests, paths and preserved dependency count.
- `artifacts/testbed/results.json`, `report/`, and failure `test-results/`.
- `artifacts/testbed/default-theme/{desktop,mobile}/{viewport.png,full-page.png,evidence.json}`:
  actual Chromium/Playwright versions, viewport, package/runtime provenance and
  candidate captures explicitly marked pending human visual approval.

Archive the entire evidence set with commit/source identity before another run,
because these paths are overwritten. A pre-commit run records its base commit and
dirty source identity honestly; do not rewrite it to pretend it tested a later
commit. Re-run from a clean revision for future distribution evidence.

Review both viewport/full-page images against the historical ERBAS default
captures and the original templates/CSS. Inspect labels, focus, long exact values,
disabled/read-only fields, mobile layout, scrolling and every region/action.
Confirm no clipping/occlusion, including the former floating area. Record reviewer,
date, revisions/digests, browser, image paths, findings and explicit acceptance or
rejection. Initial status remains **pending human review**; no automatic baseline
approval or baseline equality test is introduced. Any discovered functional/layout
defect must remain recorded and be corrected/retested rather than hidden.

Remaining migration obstacles: coordinate public versions; review/approve visual
references; adapt ERBAS's router and extension templates; keep resource/login CSS in
the consumer; and adopt this installed package there in a separately authorized
task. The four other themes and all pending 1.0 capabilities remain out of scope.
