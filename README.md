# Angular UI Runtime

![Angular](https://img.shields.io/badge/Angular-22-DD0031?logo=angular)
[![CI](https://github.com/alxarafe/angular-ui-runtime/actions/workflows/ci.yml/badge.svg)](https://github.com/alxarafe/angular-ui-runtime/actions/workflows/ci.yml)
![License](https://img.shields.io/badge/License-Apache%202.0-blue)

`@alxarafe/ui-runtime` is a general-purpose Angular UI runtime library, independent of backend technologies. ERBAS and Alixar-Solúcar are reference applications that inform its design, not limitations on its use.

Implemented version `0.2.0` provides the Angular 22 theme engine and exact-value field renderer contracts extracted from ERBAS. Version `1.0` plans reusable field validation, typed menus, forms, grids and document editing state; these capabilities are specified in the contract and design documents but are not implemented yet.

## Requirements

Docker Engine access and Bash are required. Node.js, npm and Angular CLI are supplied exclusively by an immutable Node.js 24 LTS Docker image; no host installation is needed. The build image provides Node.js 24.22.2 and npm 11.19.1. Browser checks use a separate digest-pinned Playwright 1.58.2 image with its matching Chromium. The first run requires internet access to download images and npm dependencies.

## Commands

Run from the repository root:

```sh
./bin/test   # Reproducible dependency installation and automated tests
./bin/check  # Complete validation, isolated consumer and Chromium QA smoke tests
./bin/pack   # Reproducible installation, production build and verified npm tarball
./bin/testbed # Docker-only QA preview at http://127.0.0.1:4173; Ctrl+C to stop
```

Each command runs in ephemeral containers as the host user's UID/GID. Source is mounted read-only; dependencies, temporary workspaces and the consumer live in container storage. Only `artifacts/` is writable on the host. Automated checks publish no ports and create no resident services or named volumes; the explicit testbed preview publishes only host loopback port 4173 until stopped. Repeated runs use `npm ci` with committed lockfiles and discard temporary dependencies on exit.

`./bin/check` runs TypeScript strict checking, automated bootstrap and Angular-compiled theme tests, the production library build and npm packaging validation. It inspects the tarball's identity, exports, ESM bundle, declarations, license and development-file exclusions. A separate temporary standalone Angular application installs the actual tarball and compiles using only its installed package exports. Its own lockfile pins the consumer toolchain. It is deleted after the check, including on failure.

The consumer first runs `npm ci`, then installs the generated tarball with `npm install --no-save` while retaining lockfile resolution. Validation requires the consumer lockfile to remain unchanged and every initially installed dependency to retain its locked version, source and integrity; installed package manifests also confirm the versions. Only the runtime package may be added. Platform-specific optional dependencies absent after `npm ci` are not required. Any dependency drift fails the check before the public-package imports and production consumer build.

The separate private `apps/testbed/` app installs the same actual tarball, preserves its own locked dependencies and builds using public exports. `./bin/check` then runs six Playwright smoke tests at 1280×800 and 390×844 against the compiled site. Screenshots, reports and package/browser metadata are written under `artifacts/testbed/`, outside the npm package. The two synthetic QA themes exercise existing bindings only; they are not production reference themes or approved visual baselines. See [browser QA and human inspection](docs/qa/testbed.md).

The local artifact is:

```text
artifacts/alxarafe-ui-runtime-0.2.0.tgz
```

Packaging does not publish to npm. Push, PR, merge, publication and deployment require separate authorization.

## Library boundaries

The workspace is private; the distributable package manifest is `projects/ui-runtime/package.json`. The public entry point is `projects/ui-runtime/src/public-api.ts`. Angular CLI and ng-packagr produce Angular Package Format with ESM, type declarations, partial compilation and `sideEffects: false`. Angular core remains a peer dependency (`^22.0.0`). TypeScript and Angular template checks are strict.

`UI_RUNTIME_VERSION` is a technical bootstrap marker used to verify the public package boundary. It does not define business functionality or a metadata API. Future Angular components must use standalone APIs. No styling framework, state library or permanent demonstration app is included.

Consumer applications own application-specific workflows, configuration, routing and business logic. Import only from `@alxarafe/ui-runtime`, never from this repository's source tree. To evaluate the local archive in an Angular 22 consumer, install the generated `.tgz` with npm in that consumer's Docker environment; do not commit machine-specific absolute dependency paths.

## Theme engine

The public API exports `ThemeArtifact`, `THEME_ARTIFACTS`, `ThemeId` (only the generic `Default` identity), `ThemeDefinition`, `ThemeArtifacts`, `FieldArtifact`, `StructureArtifact`, `ThemeRegistry`, `ThemeService`, `ThemeResolver` and `provideThemeRuntime`.

Consumers call `provideThemeRuntime(themes)` in their application providers. They supply a `default` theme containing every artifact (shell, navigation, panel and each field renderer), then optional themes with sparse overrides or an empty override map for CSS-only changes. All artifacts must be compiled standalone Angular components. Field components must expose the `context` input and `valueChange` output. Registration rejects unknown artifacts, invalid identities, duplicate theme IDs and incomplete defaults, and captures frozen snapshots.

`ThemeService.current` is a readonly signal. `activate(id)` selects a registered theme and returns `true`; an unknown ID restores `default` and returns `false`. `ThemeResolver.resolve(artifact)` uses the selected override or falls directly back to the default component. Selection stays local to each provider composition; there is no persistence or browser/HTTP dependency.

The renderer API exports `FieldValue`, `FieldRendererContext`, `FieldRenderer` and `FIELD_RENDERER_BINDINGS`. Exact numeric, date, time, instant and binary values remain strings; booleans and null retain their values. Context includes identity, label, value, optional disabled/read-only flags and choices. Transport and semantic validation remain consumer responsibilities.

No themes, CSS, shells, widgets or normalized backend type registry are shipped. Consumers still supply those implementations and their own theme identities. ERBAS adoption and any field outlet/widget migration remain separate work; AUR-002B is not included. See `NOTICE` for source revision, original paths, test provenance and the minimal extraction changes.

## Version 1.0 target contract

The [UI Runtime 1.0 contract](docs/contracts/ui-runtime-v1.md) and its
[mandatory acceptance matrix](docs/contracts/ui-runtime-v1-acceptance.md) define
the target functionality and release gate. They do not describe completed 0.2.0
features. The repository-local Angular QA testbed is a non-distributed
fixture covering existing 0.2.0 contracts; full 1.0 coverage remains pending. The [API and internal contract design](docs/design/ui-runtime-v1-api.md)
contains compiled, unpublished interface proposals and compatibility decisions.

## Technical references

- [ERBAS client](https://github.com/alxarafe/erbas-client): Angular/npm conventions and Docker validation patterns.
- [Solucar web](https://github.com/alxarafe/solucar-web): Angular 22 toolchain and install/typecheck/test/build validation sequence.
- [Creating Angular libraries](https://angular.dev/tools/libraries/creating-libraries).
- [Angular Package Format](https://angular.dev/tools/libraries/angular-package-format).
- [Angular version compatibility](https://angular.dev/reference/versions).

The reference repositories are read-only inputs and are not modified by these scripts.

## License

Apache-2.0. The original `LICENSE` is preserved and included in the npm archive alongside `NOTICE`, which records extraction provenance.
