# Independent vintage theme (experimental)

`@alxarafe/ui-theme-vintage@0.1.0-alpha.3` is a private optional APF package.
Import `VINTAGE_THEME` from the public package and explicitly register it alongside
a complete `DEFAULT_THEME` using `provideThemeRuntime`. Installation does not
select it. Include the default CSS and this package's `theme.css` export once.
The identity is `vintage`; overrides are none (genuine CSS-only).
All missing artifacts resolve directly to default, never through another theme.
The package has no dependency on the default package or any consumer code.

The only non-peer dependency is tslib. Angular Core and UI Runtime are peers.
The exact runtime peer is `@alxarafe/ui-runtime@0.3.0-alpha.3`. Historical
`0.2.0` archives do not satisfy it. Each theme is independently versioned;
installation never activates it. `conformance.json` records the tested runtime
archive digest and source identity. All packages remain `private: true` and npm
publication is prohibited. See the repository's
`docs/contracts/package-versioning.md` for compatibility and upgrade policy.

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
