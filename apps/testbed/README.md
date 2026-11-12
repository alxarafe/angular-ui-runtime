# Angular QA testbed

Private, repository-local Angular 22 fixture for the installed UI Runtime package.
Synthetic components here exercise existing bindings only; they are neither a
production theme nor planned 1.0 feature implementations.

Use `./bin/check` at the repository root for complete Docker/browser validation or
`./bin/testbed` for a temporary local preview. Do not run npm on the host or import
library repository source paths. The build script installs the generated APF tarball
in an isolated temporary copy before Angular compilation.

See [QA workflow, artifacts and human review](../../docs/qa/testbed.md).

`/?scenario=composition` exercises synthetic structural themes through the public
shell/navigation/panel ports, retaining application-owned content/region views.
It neither migrates production themes nor implements 1.0 widgets.

`/default-theme/` is a separately compiled fixture page that installs the actual
independent default-theme and runtime tarballs and loads the exported theme CSS.
It has no stylesheet dependency on the synthetic QA pages. See
[extraction QA](../../docs/qa/default-theme-extraction.md).

The same page now explicitly registers all five independently packaged themes,
with optional override/fallback, safe layout and dark native-control evidence in
[optional-theme QA](../../docs/qa/optional-theme-extraction.md). Human review and
consumer panel-only focus policy remain pending.
