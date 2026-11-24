# Getting started with Angular UI Runtime

This guide covers the current **private, source-built prerelease**. AUR is packaged as an Angular library; it is not yet available for installation from the public npm registry.

## 1. Requirements

To build and run the AUR repository itself:

- Git, Bash, and a working Docker Engine.
- Internet access on the first run to fetch immutable container images and dependencies.
- Enough local resources to run the Angular build and headless Chromium verification.

Node.js, npm, Angular CLI, and Playwright run inside disposable containers. No global installation is required on the build host. The repository uses Node.js 24 and an Angular 22 toolchain in its pinned Docker workflows. An application consuming AUR must use a compatible Angular 22 toolchain.

## 2. Verify the source checkout

In a local checkout of the AUR repository:

```bash
./bin/test
./bin/check
```

`./bin/check` verifies formatting, strict TypeScript and Angular compilation, unit/contract tests, APF packaging, isolated installation in a disposable Angular consumer, and Chromium browser scenarios. A green check verifies the **implemented prerelease behavior**, not full acceptance of the future 1.0 contract. A first run may download substantial Docker images.

Only the explicit testbed preview publishes a local listening port. Verification containers are ephemeral. The scripts should not create host `node_modules` directories.

## 3. Build installable APF archives

```bash
./bin/pack
```

The command creates six archives in `artifacts/`:

```text
alxarafe-ui-runtime-0.3.0-alpha.3.tgz
alxarafe-ui-theme-default-0.1.0-alpha.3.tgz
alxarafe-ui-theme-alternative-0.1.0-alpha.3.tgz
alxarafe-ui-theme-cyberpunk-0.1.0-alpha.3.tgz
alxarafe-ui-theme-vintage-0.1.0-alpha.3.tgz
alxarafe-ui-theme-high-contrast-0.1.0-alpha.3.tgz
```

These filenames reflect the **currently declared** package versions, not a stable published release. Rebuilds from different commits can currently have the same filename/version; keep the source commit and archive checksums with any evaluation or distribution.

## 4. Install in an Angular application

Use an Angular 22 application with a compatible compiler/build toolchain. Copy the required AUR archive files into a local directory belonging to that application, such as `vendor/aur/`. The example below assumes you copied the runtime and default theme archives there.

From the **application's** root, using its chosen Node/npm environment:

```bash
npm install --strict-peer-deps \
  ./vendor/aur/alxarafe-ui-runtime-0.3.0-alpha.3.tgz \
  ./vendor/aur/alxarafe-ui-theme-default-0.1.0-alpha.3.tgz
```

Install desired optional themes as additional archives in the same application. Do not use `--force` or `--legacy-peer-deps` to bypass incompatible Angular/runtime peers. Commit the application's lockfile according to its own dependency policy. The repository's Docker-only rule governs **building AUR**, not the toolchain an independent consumer chooses for itself.

If you prefer a different complete `default` theme implementation, the runtime can be installed without the supplied visual default, provided your theme fulfills the public artifact contract.

## 5. Register themes

In the application's Angular configuration:

```ts
import { ApplicationConfig } from '@angular/core';
import { provideThemeRuntime } from '@alxarafe/ui-runtime';
import { DEFAULT_THEME } from '@alxarafe/ui-theme-default';

export const appConfig: ApplicationConfig = {
    providers: [...provideThemeRuntime([DEFAULT_THEME])],
};
```

To opt in to an additional theme:

```ts
import { provideThemeRuntime } from '@alxarafe/ui-runtime';
import { DEFAULT_THEME } from '@alxarafe/ui-theme-default';
import { HIGH_CONTRAST_THEME } from '@alxarafe/ui-theme-high-contrast';

const themeProviders = provideThemeRuntime([
    DEFAULT_THEME,
    HIGH_CONTRAST_THEME,
]);
// Add ...themeProviders to your ApplicationConfig.providers array.
```

Load the default CSS once, before any optional theme CSS. For example in global `styles.css`:

```css
@import '@alxarafe/ui-theme-default/theme.css';
@import '@alxarafe/ui-theme-high-contrast/theme.css';
```

Styles are bundled with your application; installing or registering a theme does not automatically insert its CSS. Optional theme components resolve through active theme → `default` fallback. Activating a theme requires application code:

```ts
import { inject } from '@angular/core';
import { ThemeService } from '@alxarafe/ui-runtime';

const themeService = inject(ThemeService); // Use inside an Angular injection context.
themeService.activate('high-contrast');
```

`activate()` returns `false` and restores `default` for unknown IDs. The `current` property is a readonly Angular signal. Registration does not render the UI: the application must instantiate AUR's public outlets/components and connect them to its own inputs, events, and view data. See [API overview](api-overview.md) for the available public components and integration boundary. For concrete outlet bindings, use the public Angular/TypeScript declarations in the installed package.

## 6. Try AUR without building your own application

From the AUR repository root:

```bash
./bin/testbed
```

Open <http://127.0.0.1:4173> in a local browser. Use the repository's interactive QA scenarios to inspect field rendering, themes, form composition, grids, validation and document-state behavior. The testbed uses installed APF archives; it is not included in any distributed package. Press Ctrl+C to stop the preview.

Run `./bin/check` for reproducible headless Chromium testing. Browser results, screenshots and package evidence are written under `artifacts/testbed/`. Screenshots are **candidate evidence**, not approved visual baselines. Manual inspection is still required for accessibility and layout acceptance.

## 7. Understand the integration boundary

The library provides reusable presentation and local editing/validation utilities; applications provide their own:

- Data definitions and value-to-widget mapping, including absence/null/raw-edit handling.
- Effective permissions, contextual actions, routing, and navigation policies.
- HTTP/API transport, authentication, persistence, transactions, and concurrency rules.
- Server-side validation and mapping of backend errors to the UI.
- Save/retry/conflict reconciliation, confirmation before discarding changes, and navigation protection (until these generic lifecycle facilities are implemented and accepted).

Do not treat `validateField()` or `validateDocument()` as server authorization or successful persistence. A `pending` result still requires deferred server validation; successful local validation alone is not permission to claim a save succeeded.

## 8. Troubleshooting

| Symptom | Check |
| --- | --- |
| Peer dependency conflict | Angular major, core/theme versions, and exact runtime peer required by theme archives |
| `Cannot find module '@alxarafe/ui-runtime'` | Install the actual `.tgz` in the **consuming** Angular application and import the public package root |
| Theme falls back unexpectedly | Ensure the optional theme is registered and its identity is correct; unknown IDs restore `default` |
| Theme markup appears unstyled | Add the theme's exported CSS to global styles, default first |
| Docker workflow fails on first use | Confirm Docker daemon access, network access for image/package download, and sufficient disk space |
| Tests pass but visual output is poor | Browser assertions are not a substitute for reviewing screenshots and layout at desktop/mobile widths |

For technical details, consult [API overview](api-overview.md) and the public declarations shipped in the installed APF package.
