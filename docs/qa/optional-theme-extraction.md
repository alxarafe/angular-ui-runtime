# Independent optional theme packages

AUR-THEME-EXTRACT-002 starts from clean main
`491b52d0c06d7fb5e290141c5c981ded36cabb08` (merged PR #10). No branches or
consumer repositories are changed or removed. The immutable ERBAS reference is
`8d1573c315e03a6edbc92bd7b3d41d851bd54ab9`; each package's PROVENANCE.json
records original file paths/SHA-256, including the catalog. AUR-QA-002 captures
are historical comparison candidates only, not approved baselines or build inputs.

## Inventory and explicit composition

All packages are private `0.0.0-experimental.0` APF archives, physically separate
from each other and the core runtime:

| Package suffix (`@alxarafe/ui-theme-…`) | Public theme export | Visual exports / overrides |
| --- | --- | --- |
| default | `DEFAULT_THEME` | Complete protected 20-key fallback, unchanged implementation. |
| alternative | `ALTERNATIVE_THEME` | `AlternativeBooleanRenderer`, `BOOLEAN_CHOICES`; only `field.BOOLEAN`. |
| cyberpunk | `CYBERPUNK_THEME` | `CyberpunkShell`, `CyberpunkPanel`; only `shell`, `panel`. |
| vintage | `VINTAGE_THEME` | No components or overrides: genuine CSS-only APF entry. |
| high-contrast | `HIGH_CONTRAST_THEME` | `HighContrastPanel`; only `panel`. |

Each optional package contains a public entry, declarations/ESM, `theme.css`,
versioned `theme-package.json`, generated `conformance.json`, LICENSE, NOTICE,
PROVENANCE.json and README. All expose CSS/manifest/conformance subpaths. Angular
Core and the public UI Runtime are peers; tslib is the only ordinary dependency.
No package imports another theme, private source, ERBAS classes/services, router,
backend, HTTP, generator or application store. Vintage creates no fake component.

In a compatible application's Docker environment, install the runtime and default
archives plus whichever optional archives are wanted. Include only those optional
definitions in the application-owned catalog:

```ts
import { provideThemeRuntime } from '@alxarafe/ui-runtime';
import { DEFAULT_THEME } from '@alxarafe/ui-theme-default';
import { ALTERNATIVE_THEME } from '@alxarafe/ui-theme-alternative';
import { CYBERPUNK_THEME } from '@alxarafe/ui-theme-cyberpunk';
import { VINTAGE_THEME } from '@alxarafe/ui-theme-vintage';
import { HIGH_CONTRAST_THEME } from '@alxarafe/ui-theme-high-contrast';

provideThemeRuntime([
  DEFAULT_THEME, ALTERNATIVE_THEME, CYBERPUNK_THEME, VINTAGE_THEME, HIGH_CONTRAST_THEME,
]);
```

Applications may omit any optional import/entry. Installing/importing a package
does not activate it: selection starts at default and remains application-owned.
`ThemeService.activate(id): boolean` keeps its existing semantics, including false
and effective default for unknown IDs. Every missing override resolves directly
to the protected complete default, never another optional theme. No new registry,
dynamic install/remove operation or marketplace is introduced.

## CSS and compatibility

Include default CSS for fallback components, then the selected optional package
styles after it. Multiple optional stylesheets may coexist:

```css
@import '@alxarafe/ui-theme-default/theme.css';
@import '@alxarafe/ui-theme-alternative/theme.css';
@import '@alxarafe/ui-theme-cyberpunk/theme.css';
@import '@alxarafe/ui-theme-vintage/theme.css';
@import '@alxarafe/ui-theme-high-contrast/theme.css';
```

Palette rules target the corresponding active `aur-theme-shell.theme-…` and its
direct default shell; package-specific component rules use their own boundaries.
There are no global body/button/input/link/section or resource/login rules. Vintage
and Alternative override the default shell's local tokens explicitly rather than
relying on inherited variables that its own defaults would shadow. High Contrast
adds only panel presentation and active navigation emphasis. Default CSS remains
application-supplied, not an import/dependency hidden inside an optional package.
Browser checks exercise unrelated controls, another default composition's palette
and return-to-default after all optional styles have been active. Arbitrary nested
applications and all consumer CSS combinations still require integration review.

The runtime archive currently calls itself 0.2.0 but must include the structural
ports introduced at `23e3bf40bf4c3dbad034d3deb71b3358075f51b3`. The older 0.2.0
artifact without those ports is **not interchangeable or supported**. Npm's version
coordinate alone is insufficient; builds check required public exports and record
the actual runtime digest/revision/source-tree identity. All five packages remain
private experimental artifacts. Coordinated public runtime/theme versions and peer
ranges, and separate publication authorization, are required before distribution.

## Builds, archives and preserved locks

```sh
./bin/test
./bin/check
./bin/theme-pack all             # independent rebuild from an existing runtime archive
./bin/theme-pack cyberpunk       # or build just one reviewed package
git diff --check
```

`./bin/pack` builds the core and the five separate themes. `./bin/theme-default`
remains compatible and delegates to the same implementation. The shared
`scripts/theme-package.mjs` is restricted to this fixed five-package list; it is
not plugin discovery. Every build copies only one theme and the existing locked
toolchain into a temporary workspace, installs the public runtime archive and
checks source/integrity/version preservation. No default/other theme is needed to
compile an optional package. Each source folder retains its own APF configuration.

Generated archives are `artifacts/alxarafe-ui-theme-<id>-0.0.0-experimental.0.tgz`.
The core archive remains `artifacts/alxarafe-ui-runtime-0.2.0.tgz` and contains no
theme implementation/dependency. Packing checks public exports, ESM external
imports, declarations, peers, license/assets and exclusions of sources/tests/tools.
Compiled checks pin each override set, validate standalone ports and reject any
optional definition as the sole fallback. The Vintage ESM is checked for absence
of Angular component definitions. Existing default unit tests and the independent
Alternative true/false/null/disabled/read-only tests run before packaging.

The existing root, consumer, testbed and browser dependency locks stay unchanged.
The testbed explicitly installs all six archives and permits only those additions;
all existing locked dependencies must retain version, source and integrity. It
continues to consume public installed exports/CSS only. The independent legacy
consumer remains unchanged.

## Browser evidence and reference differences

`/default-theme/` now composes the real five packaged themes. Existing ten browser
cases remain and ten new cases (five identities at 1280×800 and 390×844) verify:

- All 20 resolved/mounted artifacts and exact override sets, complete default,
  optional registration without activation and observable unknown-ID fallback.
- Exact editing values, Alternative Yes/No/Not set output, mutation guards,
  app-owned draft/field/contribution DOM identity across every theme switch.
- Native navigation/action intent, named and unclaimed regions, labels/keyboard,
  visible focus, horizontal bounds and hit-testing of every essential control.
- Active palettes/typography, reset/isolation with all CSS loaded, browser errors
  and readable DATE/TIME text under dark native color schemes. Text contrast is
  measured; additional native-control captures permit visual indicator review.

Intentional adaptations from the immutable ERBAS implementation:

| Theme | Retained / changed |
| --- | --- |
| Alternative | Original green palette and three BOOLEAN choices. Minimal public renderer replaces inheritance from the ERBAS/default base; no list badge or future grid implementation. |
| Cyberpunk | Original dark palette, accent border/panel wrapper, different workspace/sidebar and right tool rail. Rail reserves 12rem grid space instead of fixed 96px overlay, fitting real controls; below 680px it moves into normal flow after content. Tools follow the workspace in DOM/tab order so mobile ordering is not merely visual. All regions and native links remain reachable. Dark color-scheme makes Chromium calendar/clock indicators light without inversion filters. |
| Vintage | Original warm tokens and Georgia/Times typography; all 20 components are unchanged default resolutions. No placeholder artifacts. |
| High Contrast | Original black/yellow/teal/white/magenta palette, stronger panel border/content and focus. Broad application section rules are omitted; emphasis is limited to owned panel and active navigation. Native controls use dark color-scheme. |

Application-owned fixture controls/content differ from historical QA, so pixel
equality is not claimed. No ERP, business resource CSS, four-theme duplication of
default widgets or pending 1.0 forms/menus/grids/validation/editing engine is added.

### Known focus limitation and pending human review

The current core panel host preserves projected nodes/values on a panel-only
replacement but does not restore their native focus. Vintage → High Contrast (and
the reverse) can therefore lose input focus even though the same node survives.
This pre-existing behavior is not changed by theme extraction. Tests record every
focus transition, assert retention for shell replacements/unchanged components,
and verify keyboard reachability and focus visibility independently. They do not
claim automatic panel-only focus recovery. Consumer adoption needs an explicit
logical-focus policy or a separately authorized core fix. No state-loss failure
is hidden by this limitation; the full 1.0 acceptance gate remains open.

Human review remains pending for all viewport/full-page images and the desktop/
mobile rail, High Contrast visual treatment, Vintage typography, green BOOLEAN and
native dark indicators. Check long content and region placement, not only image
equality or text contrast. Native indicators were inspected in Chromium but that
does not certify every browser, accessibility tool or user style combination.
Record reviewer, date, source/commit/digests, image paths, findings and explicit
approval/rejection. Never auto-approve or weaken a broken baseline.

## Retain and audit evidence

Outputs are ignored development artifacts, outside every npm package:

- `artifacts/theme-<id>-build.json` and `theme-packages-build.json`: source commit,
  dirty status, full input-tree/theme hashes, runtime/theme archive digests,
  reference provenance, locked toolchain, checks and package file inventory.
- `artifacts/testbed/build-evidence.json`: all installed identities/digests/paths
  and the preserved dependency count.
- `artifacts/testbed/results.json`, HTML report and failure traces/screenshots.
- `artifacts/testbed/optional-themes/{desktop,mobile}/<id>/`: viewport/full-page
  PNGs and evidence.json including all five archives, provenance, Chromium/
  Playwright versions, viewports, artifact resolution, palettes, focus transitions,
  assertions/errors and `visualApproval: pending human review`. Cyberpunk and
  High Contrast also have DATE/TIME control close-ups.

The viewport image starts at the theme shell; full-page images include fixture
controls. Retain the whole run before another run overwrites it, pairing captures
with results and matching digests. A pre-commit run honestly records its base
commit plus dirty source-tree hash; do not relabel it as testing a later commit.
For distribution evidence rerun from the clean reviewed commit after coordinated
versioning. Independent repeated builds should reproduce archive bytes with the
same source/environment metadata; changing that metadata intentionally changes
the digest.

Remaining consumer work: install approved/versioned archives, replace internal
theme catalogs/components, supply neutral navigation/routing intent and region
templates, retain application-specific resource/login CSS, settle panel-only focus
and run real application integration/human review. ERBAS and other consumers have
not been modified. No push, publication, tag or deployment follows from these checks.
