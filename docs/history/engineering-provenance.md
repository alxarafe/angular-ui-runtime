# Engineering provenance

Historical source inspection informed AUR design and extraction. These records
are attribution and design evidence, not normative consumer dependencies, build
inputs, integration certification or claims of implemented UI Runtime 1.0 features.
AUR is an independent Angular library distributed in Angular Package Format (APF).
Active integration obligations use the metadata CRUD and complex document profiles.
NOTICE, PROVENANCE.json and licenses remain authoritative and unchanged.
AUR-PROVENANCE-001 simplified routine source headers while retaining SPDX identifiers,
modification notices and references to NOTICE for provenance and changes.
No reference repository is modified by library validation.

## Contract source inspection

Source: `docs/contracts/ui-runtime-v1.md` at documentation baseline `95b459e`.

The base is main `c1869b2d17a19864ac24ccfb7f593af2de172851`, confirmed against remote
main. The following read-only local reference revisions informed this contract;
source inspection is design evidence, not consumer integration test evidence.

| Repository / revision | Inspected sources and consequence |
| --- | --- |
| angular-ui-runtime / base above | `projects/ui-runtime/src/{public-api.ts,theme/theme-definition.ts,theme/theme-runtime.ts,field-types/renderer-context.ts}`, `tests/theme.test.mjs`, `scripts/{pack,consumer}.mjs`, `bin/run`: preserve the extracted runtime and APF boundary. |
| erbas-client / `8d1573c315e03a6edbc92bd7b3d41d851bd54ab9` | `app/src/app/resource-runtime/{fields.ts,resource-form.ts,resource-layout.ts,models.ts}`, `core-fe/themes/themes.ts`, `core-fe/shell/shell-extensions.ts`: reuse layout projection and renderer concepts; do not extract its HTTP models wholesale. |
| erbas-contract / `9d6f4a3035eee9d1bce074b7521dedd34212d823` | `docs/core/resources-001.md`, `openapi/core/resources/contract.yaml`, `openapi/modules/wms/shared.yaml`: exact scalars, independent presence/nullability and published constraint vocabulary. |
| resource-controller / `e7dd6b0edd88ecc82adb0c55504c15d6e3ad53b2` | `src/Trait/ResourceTrait.php`, especially `convertMetadataToComponents()`: existing propagation of required, length, min/max/step, precision/scale and unsigned informs adapter mapping, not a PHP algorithm to copy. |
| solucar-web / `c9dda6a7e8222ba09506577f7b94fded27deac96` | `src/app/core/navigation/navigation-entry.ts`, `src/app/app.routes.ts`, contact and API structure: permissions, routes and transport are application responsibilities. No proposal UI integration is claimed. |
| alixar / `aed4c0a0cca98c0314eafb96c9bc8d4d56c78744` | `docs/proposals.md`, `docs/design/ALIXAR-COM-001-proposal-order-design.md`: header plus ordered editable lines and expected-version replacement provide an independent aggregate scenario. |

The current package contains theme registration/resolution and renderer bindings,
not complete validation, menus, forms, grids or document state. ERBAS
`scalarInput()` already preserves exact numbers, uses BigInt integer range checks,
checks nullability, simple DATE syntax, enum membership and code-point lengths.
It leaves patterns, exact numeric constraints and business rules to the server;
DATE syntax alone does not validate a calendar. The replacement must close these
client feedback gaps without moving HTTP serialization into renderers.
Resource-controller's PHP metadata names are not a new public metadata contract.
Adapters translate published definitions explicitly; `step` means `multipleOf`
only when their semantics actually agree. Missing metadata must not be invented.

## Original consumer integration scenarios

Source: `docs/contracts/ui-runtime-v1.md` at documentation baseline `95b459e`.

ERBAS adapts published resource metadata and its existing flat CREATE/PATCH CRUD
protocol; immutable/read-only behavior and lossless numeric JSON remain there.
Solucar/Alixar adapts its own APIs and complex documents independently. Its proposal
draft is a mandatory consumer reference scenario: edit header and ordered lines,
add/remove/reorder rows, validate exact quantities/prices, cancel discard, save a
complete draft with optimistic expectedVersion, handle stale-version conflict
without losing edits, then reconcile successful id/version and refreshed data.
Totals, currency/business policy and permission decisions stay in that application.
Alixar replacement can regenerate line IDs, so temporary UI identity must not
assume persistence identity survives. This scenario is not a built-in Proposal
model; source/backend tests do not establish an existing Solucar proposal screen.

## API design reuse analysis

Source: `docs/design/ui-runtime-v1-api.md` at documentation baseline `95b459e`.

Read-only references were inspected at ERBAS Client
`8d1573c315e03a6edbc92bd7b3d41d851bd54ab9` and resource-controller
`e7dd6b0edd88ecc82adb0c55504c15d6e3ad53b2`:

| Existing code | Reuse / adaptation boundary |
| --- | --- |
| ERBAS `app/src/app/core-fe/field-types/normalized-field-types.ts` | Reuse semantic-to-artifact mapping; derive SemanticType from the package's field artifact union to avoid catalogue drift. Runtime unknown-type rejection still required. |
| ERBAS `core-fe/themes/default/field-renderers.ts` | Preserve context, guarded changes and exact string handling. Do not migrate widgets here. Enum empty-string/null sentinel needs a future fix: empty declared strings and explicit null must remain distinct. |
| ERBAS `core-fe/field-types/field-renderer-outlet.ts` | Reuse Angular inputBinding/outputBinding and replacement-only-when-type-changes. Extend outlet later to choose one event channel and externalize raw editing state. |
| ERBAS `core-fe/shell/theme-shell-outlet.ts` | Preserve embedded view ownership outside the replaceable shell; project nodes into the new shell. Extend logical focus restoration and browser tests later. |
| ERBAS `resource-runtime/fields.ts` (`scalarInput`) | Reuse exact integer range/grammar and Unicode-counting intent as implementation provenance. Refactor toward one validator in an authorized implementation task; do not copy the algorithm into another validator now. Current DATE regex, constraints and pattern coverage are incomplete. |
| ERBAS `resource-runtime/exact-json.ts` | Keep ExactNumber and lossless parse/stringify in the application adapter; never use JSON.parse Number output for exact numeric values. This is transport code, not a library decimal arithmetic engine. |
| ERBAS `resource-runtime/resource-form.ts` | Reuse changed-effective-value submission and read-only/immutable projection. Its changed set alone is not the new document dirty model; original/current comparison is required. |
| ERBAS `resource-runtime/resource-layout.ts` | Reuse first valid placement, ordered hierarchy, unplaced fallback and keyboard tab behavior. Replace HTTP Field/Action models with neutral references/effective actions. |
| ERBAS `core-fe/shell/shell-extensions.ts`, `shell-content.ts` | Preserve the separate extension slots and legacy single navigation-list bindings. They are not typed menu storage. |
| resource-controller `src/Trait/ResourceTrait.php::convertMetadataToComponents()` | Preserve metadata propagation intent: required, length, min/max/step, precision/scale, unsigned. Translate explicitly in adapters; do not equate step and multipleOf by name. |
| resource-controller `src/Component/AbstractField.php`, `Fields/{Integer,Decimal}.php` | Metadata/options and serialized presentation are reference behavior; no PHP validation algorithm or component DTO is copied into this library. |

The original design called the ERBAS scalar and Alixar/Solucar references normative
inputs. That historical wording is superseded by the independent integration
profiles; backend source inspection remains insufficient as UI integration evidence.

## Temporal profile source evidence

Source: `docs/contracts/temporal-uuid-validation.md` at documentation baseline `95b459e`.

| Reference / revision | Evidence and boundary |
| --- | --- |
| erbas-contract `9d6f4a3035eee9d1bce074b7521dedd34212d823`, `docs/core/resources-001.md` | TIME input accepts 0–7 fractional digits; adapter output uses seven. DATETIME serializes UTC. |
| erbas `3b237cf3e5a38b75de3a9c89e10f95a329158a8a`, `erbas-core/.../resources/ScalarType.java` | Uses Java OffsetDateTime; does not explicitly enforce this narrow offset/lexical subset. No equivalence to that permissive parser is claimed. |
| arp-dotnet `2e6aa2ca2ba17b148b1f0873c58fcd2b38ddd6df`, `ScalarValidator.cs` and `RuntimeTests.cs` | Explicit ±14:00 boundary, minute checks, seven-digit ticks and rejected UTC year crossings. |
| arp-java `91b5212aba176f97c37366166cb90fc7ae786bfb`, `ScalarValidator.java`; arp-php `51c57cfbbe3953d460896d1a2e30b196329b5f58`, `Internal/Scalar.php` | Independently express the same fourteen-hour and UTC-year checks. |

These are profile-selection evidence, not imported backend models or external
consumer conformance tests. No reference repository is modified or run for library QA.

## Theme extraction source records

The original extraction procedures are retained in Git at documentation baseline
`95b459e`: `docs/qa/default-theme-extraction.md` (AUR-THEME-EXTRACT-001) and
`docs/qa/optional-theme-extraction.md` (AUR-THEME-EXTRACT-002). Their active versions
retain reproduction steps, visual findings, adaptations and pending review while
using source-neutral product descriptions.

Both used ERBAS Client revision `8d1573c315e03a6edbc92bd7b3d41d851bd54ab9`.
Each theme's PROVENANCE.json records original paths and SHA-256 hashes; NOTICE
records Apache-2.0 adaptations. Default extraction was tested against AUR runtime
revision `23e3bf40bf4c3dbad034d3deb71b3358075f51b3`; optional extraction started at
AUR `491b52d0c06d7fb5e290141c5c981ded36cabb08` (merged PR #10).

AUR-QA-002 captures used the source application revision above plus a recorded
dirty QA source hash. They remain historical comparison candidates, not approved
baselines or build inputs. No source checkout or unmerged QA branch is required.
Default extraction excluded application resource/login styles, replaced router and
extension dependencies with public ports and projection, fixed the enum null/empty
sentinel collision, and moved floating actions into normal flow. Optional themes
retained green BOOLEAN choices, cyberpunk shell/panel and reserved tool rail,
vintage warm typography/tokens and high-contrast panel/focus styling. Full human
visual approval and application integration were not established by extraction.

## Original theme reference analysis

Existing ERBAS `default`, `alternative`, `cyberpunk`, `vintage` and `high-contrast`
are reference identities only. Read-only inspection of
`erbas-client/app/src/app/core-fe/themes/themes.ts` confirms a complete default,
a BOOLEAN-only alternative, shell/panel cyberpunk, empty vintage and panel-only
high-contrast. This is sparse-authoring evidence, not certification or permission
to copy/migrate them. Reference provenance is recorded in the parent contract.
The repository's E-QA-001 synthetic themes do not certify these reference themes.

## Original integration acceptance wording

Source: `docs/contracts/ui-runtime-v1-acceptance.md` at `95b459e`.
These historical names now map to the two independent integration profiles;
requirement IDs, statuses, functional guarantees and evidence obligations remain.

| ID | Original requirement | Cases | Level | Evidence location | Status | Evidence / gap |
| --- | --- | --- | --- | --- | --- | --- |
| ADAPTER-001 | Keep transport, business, auth, persistence, defaults and backend metadata outside library. | ERBAS flat PATCH vs aggregate replacement; private endpoints/types leaking exports. | integration, consumer | tests/contracts/adapter-boundary/; consumer evidence | partial | Current public API is independent; future adapter integration evidence absent. Design/type evidence: E-DESIGN-001 only. |
| ADAPTER-002 | ERBAS integration preserves published metadata/scalars/CRUD semantics. | Immutable patch; nullable clear; absent defaults; lossless JSON; server errors. | consumer | separate ERBAS Client evidence manifest | missing | No integration executed in this task. |
| ADAPTER-003 | Solucar/Alixar scenario edits header/ordered lines and handles optimistic version conflicts. | Add/remove/reorder; stale version retains draft; id/version success; regenerated IDs. | consumer | separate Solucar evidence manifest | missing | Alixar backend/design inspected; no library-backed proposal screen proof. |
| RELEASE-002 | Require reproducible ERBAS and Solucar evidence pinned to RC tarball/hash and consumer revisions. | Stale evidence; missing commands/lockfiles/logs; build-only evidence. | consumer | planned release evidence manifest; separate consumer repositories | missing | No release integration evidence yet. |

## Integer metadata interoperability

The original contract and E-INTEGER-001 referenced ARP-INTEGER-001 as a contract
candidate for effective integer capacity, and external ARP dictionary engines.
This identifier is retained for historical traceability. AUR consumes explicit
capacity and constraints from adapters and does not depend on that project.
