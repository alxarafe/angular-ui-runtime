# Angular UI Runtime

![Angular](https://img.shields.io/badge/Angular-22-DD0031?logo=angular)
[![CI](https://github.com/alxarafe/angular-ui-runtime/actions/workflows/ci.yml/badge.svg)](https://github.com/alxarafe/angular-ui-runtime/actions/workflows/ci.yml)
![License](https://img.shields.io/badge/License-Apache%202.0-blue)

`@alxarafe/ui-runtime` is an independent Angular 22 library foundation for shared UI capabilities across ERBAS and Alixar-Solucar. Version `0.1.0` establishes the build, test and npm packaging pipeline. Business components and metadata contracts are not defined yet.

## Requirements

Docker Engine access and Bash are required. Node.js, npm and Angular CLI are supplied exclusively by an immutable Node.js 24 LTS Docker image; no host installation is needed. The image provides Node.js 24.22.2 and npm 11.19.1. The first run requires internet access to download the image and npm dependencies.

## Commands

Run from the repository root:

```sh
./bin/test   # Reproducible dependency installation and automated tests
./bin/check  # Complete validation, including the isolated Angular consumer
./bin/pack   # Reproducible installation, production build and verified npm tarball
```

Each command runs in an ephemeral container as the host user's UID/GID. Source is mounted read-only; dependencies, compilation output and the consumer live in temporary container storage. Only `artifacts/` is writable on the host. No ports, resident services or named volumes are created. Repeated runs use `npm ci` with committed lockfiles and discard temporary dependencies on exit.

`./bin/check` runs TypeScript strict checking, automated bootstrap tests, the production library build and npm packaging validation. It inspects the tarball's identity, exports, ESM bundle, declarations, license and development-file exclusions. A separate temporary standalone Angular application installs the actual tarball and compiles using only its installed package exports. Its own lockfile pins the consumer toolchain. It is deleted after the check, including on failure.

The local artifact is:

```text
artifacts/alxarafe-ui-runtime-0.1.0.tgz
```

Packaging does not publish to npm. Push, PR, merge, publication and deployment require separate authorization.

## Library boundaries

The workspace is private; the distributable package manifest is `projects/ui-runtime/package.json`. The public entry point is `projects/ui-runtime/src/public-api.ts`. Angular CLI and ng-packagr produce Angular Package Format with ESM, type declarations, partial compilation and `sideEffects: false`. Angular core remains a peer dependency (`^22.0.0`). TypeScript and Angular template checks are strict.

`UI_RUNTIME_VERSION` is a technical bootstrap marker used to verify the public package boundary. It does not define business functionality or a metadata API. Future Angular components must use standalone APIs. No styling framework, state library or permanent demonstration app is included.

Consumer applications own application-specific workflows, configuration, routing and business logic. Import only from `@alxarafe/ui-runtime`, never from this repository's source tree. To evaluate the local archive in an Angular 22 consumer, install the generated `.tgz` with npm in that consumer's Docker environment; do not commit machine-specific absolute dependency paths.

## Technical references

- [ERBAS client](https://github.com/alxarafe/erbas-client): Angular/npm conventions and Docker validation patterns.
- [Solucar web](https://github.com/alxarafe/solucar-web): Angular 22 toolchain and install/typecheck/test/build validation sequence.
- [Creating Angular libraries](https://angular.dev/tools/libraries/creating-libraries).
- [Angular Package Format](https://angular.dev/tools/libraries/angular-package-format).
- [Angular version compatibility](https://angular.dev/reference/versions).

The reference repositories are read-only inputs and are not modified by these scripts.

## License

Apache-2.0. The original `LICENSE` is preserved and included in the npm archive.
