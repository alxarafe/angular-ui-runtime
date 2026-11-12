# Independent vintage theme (experimental)

`@alxarafe/ui-theme-vintage@0.0.0-experimental.0` is a private optional APF package.
Import `VINTAGE_THEME` from the public package and explicitly register it alongside
a complete `DEFAULT_THEME` using `provideThemeRuntime`. Installation does not
select it. Include the default CSS and this package's `theme.css` export once.
The identity is `vintage`; overrides are none (genuine CSS-only).
All missing artifacts resolve directly to default, never through another theme.
The package has no dependency on the default package or any consumer code.

The only non-peer dependency is tslib. Angular Core and UI Runtime are peers.
The runtime `0.2.0` coordinate means only the local structural-ports snapshot at
`23e3bf40bf4c3dbad034d3deb71b3358075f51b3` or a tested compatible descendant;
the older 0.2.0 archive without these ports is unsupported. `conformance.json`
records the exact tested archive digest. Coordinated public versions/peer ranges
and distribution approval are still required. Do not publish this private package.

Use `./bin/theme-pack vintage` from the repository root to build only this package
against the already packed runtime; `./bin/pack` builds all five theme archives.
The shared locked Docker builder copies only this package and installs the runtime
public archive, with no other theme or consumer source available. Each directory
has its own APF entry/configuration and standalone tsconfigs. Build outputs exclude
sources, tests and tools, and export declarations, CSS, manifest and evidence.

Styles activate only under the matching `aur-theme-shell.theme-vintage` host or
this package's own component boundary. They do not import other theme styles.
Consumers must retain default CSS for fallback components. See the repository's
`docs/qa/optional-theme-extraction.md` for composition examples, CSS order, intended
differences, limits and human review. No 1.0 validation/document engine or theme
installation lifecycle is implemented. Captures remain pending human approval.

Source/license provenance is recorded in NOTICE and PROVENANCE.json. Historical
ERBAS QA captures are reference material only. No ERBAS checkout is required.
