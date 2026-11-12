# Independent default theme (experimental)

`@alxarafe/ui-theme-default@0.1.0-alpha.3` is a separate APF package,
adapted from ERBAS's Apache-2.0 default presentation. It ships no application,
backend, routing, generator or domain service. See NOTICE and PROVENANCE.json.

## Compatibility and distribution status

The exact runtime peer is `@alxarafe/ui-runtime@0.3.0-alpha.3`. Historical
`0.2.0` archives do not satisfy it. Each theme is independently versioned;
installation never activates it. `conformance.json` records the tested runtime
archive digest and source identity. All packages remain `private: true` and npm
publication is prohibited. See the repository's
`docs/contracts/package-versioning.md` for compatibility and upgrade policy.

Angular 22 is a peer; only tslib is a runtime dependency. The theme consumes the
public `@alxarafe/ui-runtime` entry, never repository source aliases. Both Angular
and UI Runtime stay external to its ESM bundle.

## Build and install

In this repository use Docker only:

```sh
./bin/pack            # core APF archive, then five separately built/packed themes
./bin/theme-default   # theme only, using the already built runtime archive
./bin/check           # includes both archives, tests, installed consumers and Chromium
```

The theme-only builder copies this directory and the locked root toolchain into
an ephemeral workspace, installs the supplied runtime archive, checks its public
ports and preserves all toolchain lock entries. It compiles/tests/packs with its
own `ng-package.json` and standalone tsconfigs. Core sources are not present in
that workspace. No reference checkout or QA branch is a build input. For a
standalone source build in another Docker toolchain, place this directory under
a workspace with matching Angular/compiler/ng-packagr/TypeScript tooling and the
tested runtime installed; generate `conformance.json` from that archive's digest,
then run `ng-packagr -p ng-package.json -c tsconfig.lib.json`. The authoritative
reproducible toolchain/lock and evidence builder are this repository's scripts.

Artifacts are `artifacts/alxarafe-ui-runtime-0.3.0-alpha.3.tgz` and
`artifacts/alxarafe-ui-theme-default-0.1.0-alpha.3.tgz`. Install both into a
compatible application using its own Docker/package workflow; include
`@alxarafe/ui-theme-default/theme.css` once in application styles.

```ts
import { provideThemeRuntime } from '@alxarafe/ui-runtime';
import { DEFAULT_THEME } from '@alxarafe/ui-theme-default';
// Application providers:
provideThemeRuntime([DEFAULT_THEME]);
```

Use `ThemeShellOutlet` with application TemplateRefs/navigation/intent handling.
Application state and extension registration remain outside visual components.
Additional partial themes fall directly back to this complete `default`.

## Public contents

Root exports: `DEFAULT_THEME`, `DEFAULT_ARTIFACTS`, `DefaultShell`,
`DefaultNavigation`, `DefaultPanel`, and DefaultBoolean/String/Text/Number/Date/
Time/Enum/BinaryRenderer. The complete definition has exactly 20 required mappings.
UUID/DATETIME use string rendering; seven integer types and DECIMAL share exact
text-number rendering. BINARY remains labelled output-only, not a file editor.
Subpath exports: `theme.css`, `theme-package.json`, `conformance.json`.

All standard named regions are optional: topbar-start/actions, navigation-before/
after, content-before/after, contextual-actions, floating-actions and footer.
Unknown regions remain in the visible catch-all. These are projection names,
not a new extension registry. Floating actions are deliberately in normal flow
to avoid the overlapping mobile fixed controls observed in historical QA.

## Value semantics and intentional adaptations

`context` / `valueChange` and string/boolean/null remain unchanged. BOOLEAN null
is indeterminate; text-like null displays empty without emitting a replacement.
Integers/decimals never pass through Number; DATETIME remains exact text. DATE and
representable TIME use native inputs; TIME with more than three fractional digits
uses text to retain precision native Chromium cannot display. No local semantic
validation, numeric normalization, transport or 1.0 editing engine is added.
Native DATE editing still has browser-controlled intermediate-value behavior.

ENUM uses selected index, not a colliding empty-string sentinel: Not set emits
null and a declared empty-string choice emits `""`. This explicitly corrects the
original ERBAS ambiguity without changing the public value type. Disabled/read-only
renderers cannot emit edits. Navigation uses native hrefs and action intent, with
the application responsible for validated data, routing and authorization.

Generic original colors, system typography, sidebar/workspace proportions,
controls and mobile stacking remain. CSS selectors target only this package's
components/classes. Resource/list/form/login/business selectors are excluded;
applications style their own content. Appearance comparison, browser evidence and
remaining limits are documented in the repository's extraction QA procedure.
Generated captures and conformance records remain pending human visual review;
they are not approved references or a full 1.0 conformance certificate.
