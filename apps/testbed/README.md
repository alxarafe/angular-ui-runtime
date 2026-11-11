# Angular QA testbed

Private, repository-local Angular 22 fixture for the installed UI Runtime package.
Synthetic components here exercise existing bindings only; they are neither a
production theme nor planned 1.0 feature implementations.

Use `./bin/check` at the repository root for complete Docker/browser validation or
`./bin/testbed` for a temporary local preview. Do not run npm on the host or import
library repository source paths. The build script installs the generated APF tarball
in an isolated temporary copy before Angular compilation.

See [QA workflow, artifacts and human review](../../docs/qa/testbed.md).
