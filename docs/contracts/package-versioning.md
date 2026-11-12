# Private APF package versions and compatibility

AUR-VERSION-001 establishes distinct version contracts after the extraction in
merged PR #11. All six packages retain `private: true`. Publication, tags and
external distribution require separate authorization. AUR-FOCUS-001 advances the
runtime to alpha.2 for retained-node panel focus recovery.
All five alpha.2 themes are metadata-only compatibility releases for that exact
peer; visuals and overrides are unchanged. Alpha.1 remains historical provenance.
No public API, renderer binding, composition port or theme identity changes.

| Package | Current version | Runtime peer |
| --- | --- | --- |
| `@alxarafe/ui-runtime` | `0.3.0-alpha.2` | — |
| `@alxarafe/ui-theme-default` | `0.1.0-alpha.2` | `0.3.0-alpha.2` |
| `@alxarafe/ui-theme-alternative` | `0.1.0-alpha.2` | `0.3.0-alpha.2` |
| `@alxarafe/ui-theme-cyberpunk` | `0.1.0-alpha.2` | `0.3.0-alpha.2` |
| `@alxarafe/ui-theme-vintage` | `0.1.0-alpha.2` | `0.3.0-alpha.2` |
| `@alxarafe/ui-theme-high-contrast` | `0.1.0-alpha.2` | `0.3.0-alpha.2` |

Angular Core remains a `^22.0.0` peer. Tests use locked Angular 22.2.5 with the
existing compiler/build toolchain; no additional Angular versions are certified.
Angular and runtime peers remain external to theme bundles. Only tslib is a
non-peer runtime dependency. No theme depends on another theme or on a consumer.
The runtime has no dependency on any theme. There are no cyclic package edges.

Each package's `package.json` owns its version and peers. Theme manifests repeat
their package version and runtime requirement for inspection; checks enforce
agreement. Build scripts derive archive names from each individual manifest via
`scripts/package-metadata.mjs`. There is no shared theme-version constant.
The workspace/lock root version follows the runtime; locked dependency versions,
resolutions and integrity values remain unchanged.

## Install and compose

Build in ephemeral Docker with `./bin/pack`. Generated archives are:

- `artifacts/alxarafe-ui-runtime-0.3.0-alpha.2.tgz`
- `artifacts/alxarafe-ui-theme-default-0.1.0-alpha.2.tgz`
- `artifacts/alxarafe-ui-theme-alternative-0.1.0-alpha.2.tgz`
- `artifacts/alxarafe-ui-theme-cyberpunk-0.1.0-alpha.2.tgz`
- `artifacts/alxarafe-ui-theme-vintage-0.1.0-alpha.2.tgz`
- `artifacts/alxarafe-ui-theme-high-contrast-0.1.0-alpha.2.tgz`

In a compatible Angular application's own isolated package workflow, install
runtime and Default archives together, adding only desired optional archives:

```sh
npm install --strict-peer-deps /archives/alxarafe-ui-runtime-0.3.0-alpha.2.tgz /archives/alxarafe-ui-theme-default-0.1.0-alpha.2.tgz /archives/alxarafe-ui-theme-alternative-0.1.0-alpha.2.tgz
```

Do not bypass peer failures with force or legacy peer resolution. Register through
public exports, for example:

```ts
import { provideThemeRuntime } from '@alxarafe/ui-runtime';
import { DEFAULT_THEME } from '@alxarafe/ui-theme-default';
import { ALTERNATIVE_THEME } from '@alxarafe/ui-theme-alternative';
provideThemeRuntime([DEFAULT_THEME, ALTERNATIVE_THEME]);
```

Other exports are `CYBERPUNK_THEME`, `VINTAGE_THEME`, `HIGH_CONTRAST_THEME` from
their respective public package roots. Installation does not activate a theme.
Include `@alxarafe/ui-theme-default/theme.css` first, followed by each installed
optional package's `theme.css` in application global styles. Selectors are scoped
to their theme host/component boundaries. Existing browser regressions check
inactive themes and unrelated content. CSS inclusion remains application-owned.

Default supplies all 20 mandatory artifacts. Alternative overrides BOOLEAN only,
Cyberpunk shell/panel, Vintage none (CSS-only), High Contrast panel only. Missing
overrides resolve directly to Default. A runtime-only installation is supported
when the application supplies its own complete, validated protected `default`.
No particular visual package is hardcoded into the runtime.

`ThemeService.activate(id): boolean` is unchanged: unknown IDs return false and
restore `default`; the consuming application can observe the existing boolean
result and effective theme. No richer error contract is introduced. Projected
application content and editing state remain application-owned. Existing value
and structural-switch browser regressions remain required.

## Independent upgrades

A theme can increment its own version without increments to other themes. Its
exact runtime peer must identify a tested compatible runtime. A runtime change
requires affected themes to declare and test the new exact peer before they can
be installed together; a metadata-only compatibility release is still a release
of that theme. Do not equate all artifacts sharing an old version string.

The historical runtime `0.2.0` without structural ports is rejected by npm peer
resolution. Former local snapshots also labelled `0.2.0` are not supported by the
new exact contract. Active manifests no longer use a required Git revision or
snapshot-only flag as a substitute for compatibility. Historical extraction docs,
NOTICE and PROVENANCE retain original source identity; generated conformance
continues to record the actual runtime archive digest and source tree.

Broader ranges require an explicit compatibility decision after API stability,
Angular/compiler/APF compatibility and successful install/build/unit/browser
matrices across every proposed supported runtime release, including range bounds
and prerelease matching. A caret range is not inferred from one successful build.
Breaking public changes require separate authorization. Future stable versioning
and npm publication remain deferred.

## Reproducible evidence and limits

`./bin/test` covers metadata agreement and independent archive naming.
`./bin/check` builds/inspects six actual APF archives, preserves installed lock
entries and validates runtime alone, Default, each optional independently with
Default, and all five themes together in disposable Angular 22 consumers.
Installed imports use public exports exclusively, with no source aliases.
It checks single Angular/runtime resolution, direct fallback and unknown-theme
behavior. A hash-pinned actual historical APF fixture is rejected with ERESOLVE
for each of the five exact theme peers. It is negative-test data only.

Evidence is outside all distributable packages:

- `artifacts/compatibility/runtime-only.json`, `matrix.json` and `rejected-*.log`.
- `artifacts/theme-*-build.json`, `theme-packages-build.json` and
  `artifacts/testbed/build-evidence.json`: versions, archive digests and source
  identity. Dirty validation source is identified by commit plus tree digest.
- Existing testbed Chromium desktop 1280×800/mobile 390×844 captures and reports
  under `artifacts/testbed/`; see extraction QA documents for human review.

Repeat `./bin/pack` without changing source inputs and compare the SHA-256 of
all six metadata-derived archives for byte reproducibility. Version contracts do
not replace archive provenance or grant visual approval. Screenshots remain
pending human review. Logical-focus mapping to replaced controls, full UI Runtime 1.0
validation/editing/menu/form/grid capabilities, dynamic theme installation and
consumer adoption remain outside this task.
