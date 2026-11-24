# Angular UI Runtime (AUR)

**Angular UI Runtime (AUR)** is a reusable, backend-agnostic UI toolkit for Angular applications. It provides theme resolution, presentation composition, form and grid primitives, immutable editing state, and local data validation without imposing an application architecture or a transport protocol.

AUR is distributed as an **Angular Package Format (APF)** library. Visual themes are separate, optional APF packages. Applications choose which packages, components, and integrations to use.

> **Status: experimental prerelease.** The runtime currently declares `0.3.0-alpha.3`, and the five reference themes declare `0.1.0-alpha.3`. Development has continued without changing those version strings. The packages are private, have not been published to the public npm registry, and are not a certified 1.0 release. Pin the source revision and archive digest when evaluating a build.

## Capabilities

- **Independent themes.** A complete default theme, optional partial themes, deterministic fallback, standalone Angular components, and scoped styles.
- **UI composition.** Shell, navigation, panel, forms with tabs/sections/groups, and list/editable-detail grids.
- **Exact field semantics.** Eleven scalar types: `BOOLEAN`, `STRING`, `TEXT`, `INTEGER`, `DECIMAL`, `UUID`, `DATE`, `TIME`, `DATETIME`, `ENUM`, and `BINARY`. Numeric and temporal values can be handled without lossy JavaScript number/date conversion.
- **Immutable document editing core.** Snapshots, dirty-state comparison, keyed nested collections, and add/edit/remove/reorder operations.
- **Local validation.** Field validation, exact numeric and temporal constraints, bounded pattern checks, deferred server checks, and recursive document-level validation.
- **Consumer-controlled integration.** Applications retain ownership of authorization, routing, API calls, persistence, server-side validation, business rules, and user workflows.

These capabilities are building blocks, not a complete save-and-reconcile workflow. See [API and feature status](docs/api-overview.md) for implemented behavior and known gaps.

## Packages

| Package | Purpose | Declared version |
| --- | --- | --- |
| `@alxarafe/ui-runtime` | UI runtime and public APIs | `0.3.0-alpha.3` |
| `@alxarafe/ui-theme-default` | Complete default presentation | `0.1.0-alpha.3` |
| `@alxarafe/ui-theme-alternative` | Optional field presentation | `0.1.0-alpha.3` |
| `@alxarafe/ui-theme-cyberpunk` | Optional structural presentation | `0.1.0-alpha.3` |
| `@alxarafe/ui-theme-vintage` | Optional CSS-only presentation | `0.1.0-alpha.3` |
| `@alxarafe/ui-theme-high-contrast` | Optional high-contrast presentation | `0.1.0-alpha.3` |

The runtime has no dependency on a visual theme. An application using theme rendering must provide a complete `default` theme; the supplied default package is one option. Optional themes fall back directly to that default. Themes are not loaded or installed dynamically at runtime.

**Compatibility:** Angular `^22.0.0` is the declared peer dependency; the reference themes require the exact runtime prerelease version shown above. Other Angular majors have not been certified. The toolkit does not include Angular itself.

## Build and try it

Requirements: Bash, Git, and access to a running Docker Engine. No host Node.js, npm, or Angular CLI installation is required by the repository scripts. The first run needs internet access for container images and dependencies.

From the repository root:

```bash
./bin/test       # Unit/contract tests in Docker
./bin/check      # Full build, package, consumer and Chromium verification
./bin/pack       # Produce the core and five theme APF archives
./bin/testbed    # Open the local QA preview on http://127.0.0.1:4173
```

`./bin/testbed` runs until interrupted with Ctrl+C. It is a repository-local QA fixture, **not** a distributed demo or an application runtime. The build archives are written under `artifacts/` and are not published automatically.

For installation in your own Angular 22 project, see [Getting started](docs/getting-started.md). The current package installation route is through locally built `.tgz` archives, not `npm install` from a public registry.

## Minimal application configuration

After installing the runtime and default theme archives:

```ts
import { ApplicationConfig } from '@angular/core';
import { provideThemeRuntime } from '@alxarafe/ui-runtime';
import { DEFAULT_THEME } from '@alxarafe/ui-theme-default';

export const appConfig: ApplicationConfig = {
    providers: [...provideThemeRuntime([DEFAULT_THEME])],
};
```

Load the default theme stylesheet once in the application's global styles:

```css
@import '@alxarafe/ui-theme-default/theme.css';
```

This registers the theme infrastructure; it does not automatically create an application screen. Render UI through the public AUR outlets and components, and connect their inputs/events to your own application state. See the [installation and composition guide](docs/getting-started.md).

## Documentation

- [Getting started: prerequisites, packaging, installation, and local QA](docs/getting-started.md)
- [Public API overview and current limitations](docs/api-overview.md)
- [Guía rápida en español](docs/es/inicio-rapido.md)

## Design boundaries

AUR is a UI library, not an ERP framework, application generator, router, HTTP client, authentication service, database abstraction, or persistence engine. It does not require any specific backend, API schema, database, or consuming application. Integration adapters belong to consumers.

Its public runtime entry point is `@alxarafe/ui-runtime`. Do not import from this repository's private source paths. All packages use APF and the official public exports.

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE) for license and attribution information.
