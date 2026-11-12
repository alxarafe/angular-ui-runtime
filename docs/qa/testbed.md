# Browser QA testbed foundation (AUR-QA-001)

`apps/testbed/` is a permanent repository-local Angular 22 QA fixture. It is private,
non-distributed and backend-independent. It imports only `@alxarafe/ui-runtime`
public exports from the generated, installed APF archive. It does not implement
planned 1.0 features or replace consumer integration tests.

## Reproduce the checks

From the repository root, with Docker Engine and Bash:

```sh
./bin/test
./bin/check
```

No host Node, npm, Angular CLI or Playwright installation is needed. All npm installs,
builds, servers and browsers run in ephemeral containers as the host user's UID/GID.
No named volumes or repository node_modules are created. The first run downloads
images and dependencies. Browser execution is fixed to Linux amd64, including on
hosts that need Docker's amd64 emulation; captures on other architectures are not
interchangeable visual references.

`./bin/check` first runs the existing immutable Node 24.22.2/npm 11.19.1 image for
library install, strict checks, unit/type contracts, production APF build, package
verification and the independent disposable Angular consumer. Its lock-regression
checks remain mandatory and unchanged. `scripts/testbed.mjs` then copies only the
QA app into a temporary workspace, runs its independent `npm ci`, installs the same
actual `.tgz` with lockfile resolution enabled and verifies locked dependency
preservation and the installed package's real path. Angular compiles that installed
package into a standalone production build. No library source aliases or symlinks
are used. Static build output is copied to `artifacts/testbed/site/`.

A second container copies only `tests/browser/`, installs its lockfile with `npm ci`
and serves the compiled static site on container-local loopback. Playwright is
exactly `1.58.2`; the matching official image is:

```text
mcr.microsoft.com/playwright:v1.58.2-noble@sha256:65cefd09a5e943921ecd3a6e5414c603db2eb161e9eb48f2e2ccc63486dc7dc0
```

This digest pins Linux amd64 browser binaries and system libraries/fonts, including
Chromium revision 1208. The image contains Node 24.13.0/npm 11.6.2 for the browser
runner; Angular builds stay on the original Node image. No browser download or
unpinned npx command runs during validation. The matching package/image version
follows [Playwright's official Docker guidance](https://playwright.dev/docs/docker).
Only Chromium is exercised; bundled Firefox and WebKit are not tested.

`./bin/check` is the authoritative entry point: its shell workflow runs both
containers and fails if either phase fails. The internal root `npm run check`
prepares the site but is not a substitute for that Docker entry point.

## Scenarios and evidence limits

The two theme identities `default` and `qa-alternative` are **synthetic fixtures**.
They are not ERBAS's production default/alternative themes and do not establish
visual acceptance of ERBAS, Alixar/Solucar or the five reference themes in the
1.0 contract. There is one installed ThemeRegistry/ThemeService/ThemeResolver,
provided by `provideThemeRuntime`; testbed outlets only instantiate resolved
components and bind public input/output names.

The default registers all 20 existing artifact keys. A generic field probe fills
all 17 renderer slots to test registration, not to claim 17 semantic widgets exist.
Browser scenarios exercise a string-backed exact decimal input, BOOLEAN checkbox,
disabled/read-only controls, shell, navigation and panel. The alternative overrides
panel and decimal renderer; shell, navigation and other fields use default fallback.
Fixture-owned signals preserve emitted string/boolean values during replacement;
this is not the future document editing engine.

Three original smoke scenarios run at each viewport (six tests): initialization/registration
and default bindings; override switching plus unknown-ID fallback and retained
emitted values; keyboard activation/focus and responsive layout reachability.
Console errors, uncaught page errors, failed requests and HTTP errors fail every
test. Playwright disposes each page/context and closes its web server when the
suite ends; Docker removes the container.

An additional independent-composition scenario (`?scenario=composition`, two more
cases) uses the public structural ports in the
[composition contract](../contracts/theme-composition-v1.md). It checks projection
identity, named-region relocation/catch-all, structural and panel-only replacement,
CSS-only retention, navigation updates/intent, native links and retained-node focus.
Components/data are synthetic. Candidate full-page captures are in
`artifacts/testbed/composition/{desktop,mobile}/port-{default,alternate}.png`.

Viewports are exactly 1280×800 and 390×844 at deviceScaleFactor 1. Mobile uses Chromium
mobile/touch emulation, not a physical device. Locale en-GB, timezone UTC, light
scheme, reduced motion, system fonts from the pinned image and fixed fixture data
avoid external fonts/network data and timing-dependent content. Screenshots disable
animations. Tests check PNG dimensions, horizontal overflow and viewport reachability;
they do not prove absence of every visual/accessibility defect.

## Artifacts

Every successful complete run writes outside the package:

- `artifacts/testbed/build-evidence.json`: archive SHA-256, app lockfile SHA-256,
  installed package path, version, Node version and preserved dependency count.
- `artifacts/testbed/results.json` and `report/index.html`: browser results and HTML
  report; failed tests retain traces and failure captures under `test-results/`.
- `artifacts/testbed/browser-desktop.json` and `browser-mobile.json`: actual Chromium
  version and viewport metadata, explicitly marking visual approval as false.
- `artifacts/testbed/screenshots/{desktop,mobile}-{default,alternative}.png`: exact
  viewport captures (four images). `*-full.png` companions show below-fold content.
- `artifacts/testbed/site/`: the compiled static QA app, for inspection only.

Paths are overwritten by subsequent runs; retain a copy with commit ID and archive
hash before comparing or reviewing two runs. A failed run can leave older successful
captures: always pair images with that run's results/build metadata. CI is
configured to retain the testbed artifacts for 14 days, named by commit
and run attempt, including failure reports when available. `artifacts/` is ignored by
git. Package verification rejects app, test, script, screenshot and artifact paths,
development dependencies and browser-tool dependencies in the published manifest.
Both the QA app and browser runner have private manifests and independent lockfiles.

## Human visual inspection (no automatic baseline approval)

1. Run `./bin/check` and confirm all eight browser tests and earlier phases passed.
   Preserve the revision, tarball digest, image digest, actual browser version,
   results and screenshots together. Passing assertions alone are insufficient.
2. Open all four viewport captures at 100% size and their full-page companions.
   Review text legibility, focus, labels, spacing, borders, contrast, overflow,
   overlap, clipping and the visibly identified synthetic theme states. Scrollable
   below-fold content must remain reachable; it is not automatically a defect.
3. Inspect the live fixture using the Docker-only command:

   ```sh
   ./bin/testbed
   ```

   This rebuilds/reinstalls the actual package and serves the production build at
   `http://127.0.0.1:4173` until Ctrl+C. Only this explicit preview publishes a port,
   bound to host loopback. The container and dependencies disappear on exit.
   Use browser viewport tools at both sizes, Tab/Shift+Tab/Enter, text input,
   checkbox changes and theme/fallback buttons. A local browser is only a manual
   inspection client; the reproducible automated run uses container Chromium.
   Open `/?scenario=composition` to inspect independent ports, relocated tools,
   catch-all projection and state/focus retention at both sizes.
4. Record findings with reviewer identity, date, revision, browser/environment,
   image paths, defects and rationale. Initial status is **pending human review**.
   This task creates candidate captures, not approved baselines and no screenshot
   equality acceptance test. No review is automatically inferred from green tests.
5. Approval/version-controlled baselines need an explicit reviewed follow-up with
   documented scope. Never update references or weaken assertions merely to pass.
   Synthetic-fixture approval still cannot approve production reference themes.

## Remaining coverage

No semantic field validation, date/UUID/decimal rules, typed multi-menu fallback,
forms/tabs, grids/editable collections, dirty/save/discard/navigation engine, domain
adapters, optimistic concurrency, all-reference-theme coverage, cross-browser/device
coverage, complete accessibility audit or approved visual regression baselines are
established. The [acceptance matrix](../contracts/ui-runtime-v1-acceptance.md) records
only this foundation's verified evidence; the 1.0 release gate remains open.
