# Independent theme package contract v1

Implementation follow-up: [independent structural composition ports](theme-composition-v1.md)
adds opt-in public hosts and presentation bindings. It does not implement package
installation/lifecycle or alter the legacy artifact/default obligations below.
The active private package coordinates and exact prerelease peers are defined in
[package versioning](package-versioning.md); illustrative ranges below are not release metadata.

AUR-THEME-CONTRACT-001 · 2026-11-12 · Inspected runtime baseline:
`ab1e82cb9fc5c066fabd697b4e68e1a5aceaa8cb` (latest remote main verified).

This backend-independent contract complements the [1.0 functional contract](ui-runtime-v1.md),
[53 mandatory acceptance criteria](ui-runtime-v1-acceptance.md) and
[API design](../design/ui-runtime-v1-api.md). MUST describes a conformance
obligation, not an implemented feature. This document adds no public exports,
loading implementation, dependencies, versions or theme migration. Package metadata
and outcome examples below are design contracts, not accepted runtime inputs.

## Existing boundary and delivery models

Theme authors supply presentation; applications own editing state, authorization,
navigation data, routing, persistence and business operations. Theme components
receive presentation context and emit intent through supported ports. They must
not become the authoritative source for those application responsibilities.

| Model | Meaning and availability | Removal boundary |
| --- | --- | --- |
| A: application bundle | Application imports reviewed themes and CSS during its normal build, then supplies definitions to `provideThemeRuntime`. Supported today for registration/selection; installation management is application tooling. | Removing catalog eligibility does not remove bundled JavaScript or CSS. Physical removal requires a new build/distribution. |
| B: independent pre-start distribution | A theme has its own package/version/release and is installed and compatibility-checked before startup. Today a normal package-manager install followed by application build/linking and startup satisfies this model. A separately distributed package does not imply rebuild-free integration. | Package removal happens through deployment/build tooling after restoring default; catalog removal alone is insufficient. |
| C: previously unknown compiled package at runtime | Future installation and linking after the application has been built, without an application rebuild. Not supported by the current registry/service/resolver or promised by APF packaging. | Requires explicit management of catalog eligibility, mounted instances, styles/assets and persistent package caches; already executed JavaScript cannot generally be unloaded. |

A preinstalled catalog is an application-selected set of eligible definitions,
not a remote package discovery protocol. Application-local themes and independently
published packages obey the same component and fallback rules. Multiple packages
may supply multiple identities, but an application catalog MUST resolve identity
collisions explicitly before constructing the registry; never use last-writer wins.

## Identity, metadata and manifest

The public `ThemeDefinition` remains exactly `id`, `cssClass` and `overrides`.
Both identity strings follow the existing `/^[a-z][a-z0-9-]*$/` rule. `id` is stable
within the application catalog, distinct from npm package name, display name and
package version. `default` is reserved for the protected fallback. No ERBAS identity
besides the generic default becomes a library enum member.

A conforming independently distributed package MUST publish a versioned manifest
as data alongside its public entry point. This manifest is packaging metadata,
not an extension to `ThemeDefinition` or a backend resource schema. Its v1 content
MUST identify:

- Manifest contract version, npm package name, immutable package version, author or
  publisher, license and human-readable theme names/descriptions.
- Each supplied `id`, `cssClass`, named public definition export, supplied artifact
  keys and whether it is complete, partial, CSS-only or structural. These categories
  may overlap; they do not grant different privileges.
- Angular and UI Runtime supported semantic-version ranges, any required peer
  dependencies, and explicitly required optional component capabilities.
- Public CSS and asset entry paths, asset licenses and required ordering/scoping;
  an empty CSS list is valid when styles are component-local.
- A reference to conformance evidence pinned to that package version and digest.

Illustrative data shape (no loader consumes it today):

```json
{
  "manifestVersion": 1,
  "package": "@example/paper-theme",
  "version": "1.0.0",
  "publisher": "Example",
  "license": "Apache-2.0",
  "compatibility": { "angular": ">=22.0.0 <23.0.0", "uiRuntime": ">=0.2.0 <0.3.0" },
  "themes": [{
    "id": "paper", "name": "Paper", "description": "CSS-only presentation",
    "cssClass": "theme-paper", "definitionExport": "PAPER_THEME",
    "kinds": ["css-only"], "artifacts": [], "requiredCapabilities": []
  }],
  "styles": ["./paper.css"],
  "assets": [],
  "evidence": "./conformance.json"
}
```

The example ranges illustrate declarations, not a compatibility certification.
The final manifest filename/schema validation tooling and evidence serialization
need a separately authorized implementation decision. Integrity expectations must
come from a trusted distribution record, lockfile or deployment policy; a digest
inside the downloaded package alone cannot authenticate that package.

## Compiled components, CSS and compatibility

Angular component packages MUST use official Angular Package Format tooling,
public package exports and compiled standalone components consumable by the
supported Angular toolchain. No repository source aliases, private runtime imports,
Angular source compilation in the browser or bundled duplicate Angular runtime.
Angular packages remain peer dependencies where required, and UI Runtime
compatibility is declared without shipping a second engine. Package installation
MUST use reproducible resolved versions and integrity records.

APF partial compilation normally requires the application's Angular linker/build
step. An APF tarball alone does not establish model C compatibility. A future C
solution must define an executable/linkable format compatible with the already
running Angular application before accepting compiled components.

Field artifacts MUST retain `context` input and `valueChange` output names and
exact `FieldValue` semantics. Reflection checks names and standalone metadata;
it does not prove payload correctness, accessibility or visual behavior. Structure
artifacts must satisfy the host's documented presentation bindings; current
registry validation does not validate structure-specific ports.

CSS MUST be scoped to the declared theme class or component boundary, with assets
resolved from declared package paths. It must not hide fallback navigation,
validation feedback or actions, or depend on unrelated application selectors.
The host owns applying/removing theme classes and global styles; the resolver
returns component types and does not load styles. Component-local Angular styles
may remain registered after destruction. Authors MUST ensure inactive styles do
not affect the effective theme. Missing essential styles/assets is a load failure;
absence of an explicitly optional asset/override is normal.

Compatible upgrades retain identity, public definition/style exports and renderer
semantics. Package versions and manifest contract versions are distinct from the
UI Runtime version. Reject unsupported manifest major versions, unsatisfied peer
ranges or required capabilities before activation. A capability claim cannot
substitute for a compatible Angular build and browser evidence. Breaking ports,
artifact obligations or semantics require an explicit compatibility/versioning
and migration decision; never silently reinterpret an installed theme.

## Protected complete default and sparse overrides

A conforming application MUST always have an available, validated `default`
implementation and its essential styles/assets before theme-dependent rendering.
It cannot be disabled or removed. Failure of default validation is a fatal
configuration failure: stop theme-dependent startup and provide host-owned error
reporting; do not pretend another sparse theme is a valid fallback.

The current mandatory set is exactly these 20 keys:

```text
shell navigation panel
field.BOOLEAN field.STRING field.TEXT
field.INT8 field.UINT8 field.INT16 field.UINT16 field.INT32 field.UINT32 field.INT64
field.DECIMAL field.UUID field.DATE field.TIME field.DATETIME field.ENUM field.BINARY
```

`default.overrides` MUST contain a valid component for every key. Reusing one
component for multiple field keys is allowed if it honors each semantic contract.
Current `ThemeRegistry` checks completeness at construction and throws for invalid
registration. There is no shipped complete default implementation in UI Runtime.

An application can obtain default from a separate, reviewed theme package: import
its public complete definition, validate its compatibility and evidence, include
its CSS/assets and pass it as `default` to `provideThemeRuntime`. The runtime
depends only on its public ports and identity, never ERBAS component imports,
package names or business models. The fallback package MUST be available locally
at startup independently of optional theme network availability. Replacing its
implementation requires a controlled application upgrade with a fully validated
replacement; it is not permission to uninstall the protected identity.

For each legacy artifact resolution is exactly selected override → default.
There is no parent identity, chained inheritance or previous-theme fallback.
Missing overrides in sparse or empty maps are expected and MUST NOT trigger
failure notifications. Invalid supplied overrides are rejected, not treated as
intentional omissions. A complete optional theme can replace all 20 components;
CSS-only themes replace none. A structural theme replaces any of shell,
navigation or panel and may also supply field overrides.

The 1.0 API design proposes optional `components` for `menus`, `form`, `listGrid`
and `detailGrid`. Its separate resolution order is selected component override →
application default component override → library component default, in the same
registry/resolver. This does not add keys to `ThemeArtifact`, relax default's
20-key obligation, or introduce theme-to-theme inheritance. Those library defaults
are not implemented and cannot substitute for any current default artifact.
Existing themes require no new mandatory entries. Eventually every effective theme
must reach all 1.0 menu/form/grid capabilities through specialization or defaults.
Legacy single-list navigation remains valid; typed-menu mode uses the host-owned
fallback and must not duplicate entries into the legacy list.

## Lifecycle and atomicity

Today `ThemeRegistry.all` is a frozen, sorted snapshot. There are no public
install, disable, replace or uninstall operations. Do not mutate that snapshot or
create a second theme engine. Existing `ThemeService` remains the selection owner
and `ThemeResolver` the component resolver; any future catalog lifecycle must
extend their existing validation/provider boundary compatibly. Applications can
manage installation and compose a new validated catalog before startup today.
Live catalog mutation requires a separate implementation task.

The following are future lifecycle requirements for optional themes:

| Operation | Required result |
| --- | --- |
| Install | Stage package, verify trust/compatibility/assets/bindings, then make it eligible. Installation does not select it. Rejection leaves the catalog intact and reports a diagnostic. |
| Activate | Select an eligible validated identity; missing, unavailable, disabled or rejected requests activate default with an explicit diagnostic. |
| Deactivate/disable | Make an optional theme ineligible; if active, activate default first. Deactivating an inactive theme does not disturb current selection. |
| Replace | Validate a candidate version before changing catalog eligibility. On success replace atomically and remount only where needed, preserving state. If an active identity's requested replacement fails, retain the last validated package for rollback but activate default and report failure. Failure for an inactive identity leaves the effective theme unchanged. |
| Uninstall | Restore default before retiring an active optional theme, remove its eligibility, detach owned presentation resources when possible, then let distribution tooling remove physical files where applicable. Inactive removal leaves selection unchanged. |

Reject deactivate, disable or uninstall of default without changing effective
selection. Repeated operations must have explicit already-installed/absent/no-op
outcomes. Version conflicts must not silently replace an identity. Package-level
removal MUST protect default even when the package also supplies optional themes.
Selection persistence is application-owned; stale persisted requests must not
cause repeated activation loops. Hosts decide whether to retain the original
preference for a later retry, while reporting the effective default honestly.

State, validation, raw edits, dirty flags, row identity/order, pending saves and
logical focus MUST live outside replaceable visual instances. Structural changes
must restore logical focus and preserve projected feature-view ownership. CSS-only
changes must not recreate content solely because the selected identity changed.
No lifecycle operation dispatches business actions or changes authorization.

## Requested versus effective theme and failures

Current behavior is preserved: `activate(id): boolean` returns true for any
registered identity (including default), false for an unknown identity, and unknown
activation synchronously restores default. `current` remains a readonly signal of
the effective definition, isolated per provider composition. A true result means
selection succeeded; it does not certify mounting or rendering. `find` returns
undefined, `require` throws for unknown identity, and resolving an unknown artifact
throws. Current invalid registrations fail construction; they are not caught and
quarantined by the registry.

A conforming host can report unknown selection today by recording the requested
ID and inspecting the boolean/current result. For externally supplied packages,
a future admission stage must reject invalid candidates before passing a validated
catalog into the existing registry. The current runtime does not implement that
admission stage or report detailed failure reasons.

A future additive detailed activation operation/result must leave `activate`
synchronous with its existing boolean meaning; asynchronous installation cannot
be hidden inside it. Required result information is requested ID, effective ID,
outcome, stable diagnostic code, lifecycle phase and safe display information.
Illustrative outcomes, not a public TypeScript API:

| Request/outcome | Effective selection | Diagnostic |
| --- | --- | --- |
| Registered theme, including sparse/CSS-only | Requested ID | Success; no warning for omitted overrides. |
| Unknown or absent package | default | `theme-not-found` or `theme-unavailable`; host can explain fallback. |
| Disabled, incompatible, invalid or integrity-rejected requested package | default | Distinct `theme-disabled`, `theme-incompatible`, `theme-invalid` or `theme-integrity-rejected`. |
| Requested package/style load fails before mounting | default | `theme-load-failed`; include safe retry guidance if available. |
| Active optional theme removed/deactivated | default | Explicit lifecycle outcome, not an unexplained selection change. |
| Default invalid/unavailable | No conforming theme-dependent startup | Fatal `default-unavailable`; no fabricated successful fallback. |

Diagnostics must be host-presentable, localizable by code and exclude credentials,
internal stack traces and untrusted executable/HTML text. Preserve requested versus
effective identity even when default was selected. Detailed operation naming,
synchronous result versus diagnostic publication mechanism and public types are
deferred; no general event bus is required.

Validation/load failures before mounting can safely reject the candidate and select
the already validated default. Once a component is mounted, constructor, template,
event-handler or asynchronous errors may leave Angular views or application state
in an unsafe condition. These require host error handling and explicit reporting
of the failing phase. Selecting default may be attempted only when safe; automatic
rollback, view recovery, JS unloading or preservation after arbitrary malicious
code cannot be guaranteed. A fatal host error/restart path must not be reported as
a successful automatic recovery. Registry reflection cannot detect these failures.

## External package security and model C prerequisites

All external packages, including CSS-only packages, MUST pass application-controlled
publisher/source approval, immutable version/integrity checks, license/dependency
review and compatibility validation before use. Do not execute install scripts or
package code merely to inspect untrusted metadata. Validate paths against traversal,
constrain asset origins and CSS imports/URLs, and apply the deployment's CSP and
network policy. CSS can obscure UI or initiate requests; compiled components run
code with application privileges. Standalone metadata is not a sandbox or a security
boundary, and theme-supplied authorization is never authoritative.

Before model C can be offered, a separately authorized design MUST establish:

- A bounded acquisition/staging process, trusted provenance and integrity verification
  before execution, cache/version conflict handling and offline default availability.
- A compiled module/linking format that shares the host Angular/runtime instances,
  resolves only approved dependencies and public ports, and rejects incompatible
  packages before selection. No runtime template compilation as an implicit shortcut.
- Admission validation and atomic catalog publication through the existing theme
  machinery, with safe styles/assets activation, teardown accounting and diagnostics.
- A clear trust model: only approved code may execute with host privileges. Supporting
  untrusted authors would require a separately demonstrated isolation boundary;
  loading Angular components directly cannot provide it.
- CSP/deployment constraints, resource/size/time limits, cancellation/retry and cache
  retirement rules, and tests of interrupted loads, rollback and post-mount failure
  limitations. Persistent removal must distinguish disk/cache cleanup from code
  already evaluated in the page.

This contract selects no remote module federation, arbitrary URL importer, plugin
marketplace, sandbox transport or general-purpose remote plugin architecture.
Security checks reduce admission risk; they cannot make arbitrary loaded code safe.

## Accessibility, responsiveness and conformance evidence

Required effective capabilities include accessible shell/navigation/panels, all 17
semantic field renderers, simple/complex forms, menus, list and editable grids as
1.0 implementations become available. Optional specialization never makes those
capabilities optional. Theme conformance MUST retain authorized menu/item order and
reachability exactly once, fallback/overflow, error reveal paths, native control
semantics, labels, visible focus, keyboard operation and visible/announced errors.
Color alone must not convey state; contrast, zoom and narrow-layout usability must
be reviewed. Layout must not clip or hide content/actions; intentional table scrolling
must remain accessible.

A package's evidence MUST identify package/runtime versions and digest, consumer
revision/lockfile, Docker commands, browser/environment, supplied overrides and
capabilities, test results, logs and reviewed baseline revisions. Verify:

- Public-export installation/build against every claimed compatibility profile,
  default completeness, invalid registration rejection and all 20 fallback paths.
- CSS-only, sparse and structural selection; unknown/rejected requests; future
  lifecycle operations when implemented, including protected default and failures.
- Definition → browser interaction → validation → emitted result, exact values,
  disabled/read-only behavior, multiple menus, simple/complex forms and editable
  tables, dirty/invalid switching, focus, row identity and save/discard behavior.
- Desktop 1280×800 and narrow 390×844 at minimum, long labels, overflow/errors,
  keyboard access, approved initial screenshots and human layout review. Screenshot
  equality alone is insufficient; baseline changes need explicit review.

Existing ERBAS `default`, `alternative`, `cyberpunk`, `vintage` and `high-contrast`
are reference identities only. Read-only inspection of
`erbas-client/app/src/app/core-fe/themes/themes.ts` confirms a complete default,
a BOOLEAN-only alternative, shell/panel cyberpunk, empty vintage and panel-only
high-contrast. This is sparse-authoring evidence, not certification or permission
to copy/migrate them. Reference provenance is recorded in the parent contract.
The repository's E-QA-001 synthetic themes do not certify these reference themes.

All 53 existing acceptance IDs, statuses and evidence remain unchanged. THEME-001/002
cover today's registration/selection; THEME-003/004/005 constrain effective capability,
state and compatibility; MENU/FORM/GRID/STATE and ADAPTER rows constrain separation;
VISUAL, PACKAGE and RELEASE rows remain the evidence/release gates. Future lifecycle
and external-package requirements are recorded separately in E-THEME-CONTRACT-001;
this design and passing today's checks close no missing acceptance row.

## Deferred implementation decisions

No loading, catalog mutation, packaged default, theme migration or public API change
is implemented here. Future authorized tasks must settle manifest validation tooling,
detailed diagnostic/result publication, lifecycle mechanics in the existing engine,
CSS/resource ownership, compatible replacement and model C acquisition/linking/trust
boundaries. Optional form/menu/grid defaults remain the existing 1.0 design proposal.
None of these choices may weaken protected default, legacy artifact completeness,
one-hop fallback, boolean activation compatibility or the 53 mandatory criteria.
