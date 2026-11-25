# Public API and feature status

This document summarizes the **implemented** API of the current AUR source tree. The authoritative public exports are in `projects/ui-runtime/src/public-api.ts`. Internal design contracts may also describe future 1.0 requirements; a stated target is not necessarily implemented.

## Architecture and responsibilities

AUR contains presentation components, theme resolution, layout composition, document editing primitives, and local validation. Its public API does **not** prescribe a backend or application domain. Consuming applications adapt business data to AUR's public types, own integration and persistence, and decide when and how to run validation.

## Theme and presentation

| Public API | Use |
| --- | --- |
| `provideThemeRuntime()` | Register a complete default theme and any optional themes in Angular providers |
| `ThemeRegistry` | Immutable, validated theme catalog |
| `ThemeService` | Read/activate the effective theme through an Angular signal |
| `ThemeResolver` | Resolve structural/field artifacts, optional controls and component overrides |
| `ThemeShellOutlet`, `ThemeNavigationOutlet`, `ThemePanelOutlet` | Compose theme-specific structural components around application-owned views |
| `ThemeDefinition`, `THEME_ARTIFACTS`, `ThemeArtifact` | Theme authoring contract and the 14 required structural/field artifact identifiers |

Eleven field identifiers are supported: `BOOLEAN`, `STRING`, `TEXT`, `INTEGER`, `DECIMAL`, `UUID`, `DATE`, `TIME`, `DATETIME`, `ENUM`, and `BINARY`. Alongside `shell`, `navigation`, and `panel`, these form the 14 mandatory default-theme artifacts. Application-provided complete defaults are supported; the separate default visual theme is optional for runtime installation but mandatory if the application has no other complete default.

`ThemeDefinition` exposes `id`, `cssClass`, `overrides`, and optional presentation/control definitions. A partial theme overrides selected artifacts; other artifacts resolve directly from `default`. CSS-only themes are supported. Theme registration is static at application bootstrap; AUR does not download arbitrary new packages or replace compiled code dynamically in a running application.

Optional per-instance controls are declarative and preserve semantic/domain compatibility; they are not a general-purpose widget marketplace. `ThemeService.activate(id)` selects a known theme and returns `true`; an unknown theme returns `false` and selects `default`.

## Typed menus

`ThemeShellOutlet` accepts opt-in `[menus]`, `[menuPlacements]`,
`[menuLinkActivation]`, `(menuSelected)` and `(menuDiagnostics)`. Public
`MenuDefinition`, `MenuItem`, `MenuKind`, `MenuPlacement` and `MenuSelection` keep
identity separate from semantic kind and region. `snapshotMenus()` validates and
freezes complete ordered trees; `composeMenus()` derives exactly-once placement.
Multiple primary, secondary and account menus are supported without a count limit.
Unsupported/conflicting placements use a labelled host-owned overflow, independent
of the active shell. Legacy single-tree navigation remains unchanged when `menus`
is undefined; typed mode suppresses legacy navigation. See the [menu contract](contracts/menus.md)
for admission, keyboard behavior, native links, diagnostics and integration limits.

## Forms and grids

| Public API | Use |
| --- | --- |
| `composeForm()` | Derive deterministic field/action placement from a definition/layout |
| `FormComposition` | Render composed forms and surface application-owned field/action events |
| `ListGrid` | Present read-only collections |
| `DetailGrid` | Present editable detail collections and emit keyed change intents |
| `formPathKey()` and `ValuePath` types | Work with stable typed field/collection paths |

Forms support simple layouts as well as ordered tabs, sections and groups, with contextual actions, fallback placement, and programmatic diagnostics. Grids support stable row keys, independent collections, editing intents and optional row reordering. These are UI primitives; they do not fetch data or perform CRUD calls themselves.

## Integrated document editors

`bindDocumentEditor(session, options)` derives form/collection contexts and validation
feedback from the current session. `applyDocumentFieldIntent` and
`applyDocumentCollectionIntent` translate scalar/lossless and structural events to
`session.change()`; callers supply added rows. `FieldRendererContext.documentInput`
opts artifact fields into a lossless input bridge with separate `fieldEdit`,
`gridEdit` and `collectionEdit` channels. Existing scalar outputs remain unchanged.
`FormComposition.revealPath` and `DetailGrid.revealPath` support keyed field/row/
collection targets. See [editor bindings](contracts/editor-bindings.md) for exact
presence/raw semantics, accessible feedback, save/discard integration and limitations.

## Document state

| Public API | Use |
| --- | --- |
| `createDocumentState(document)` | Establish defensively copied immutable accepted/current snapshots |
| `applyDocumentChange(state, change)` | Apply typed field, add-row, remove-row or move-row changes |
| `resetDocumentState(state)` | Restore accepted values in memory |
| `DocumentSession` | Coordinate validated submission, edit locks, adapter outcomes and authoritative recovery |
| `exactNumericEqual()` | Compare supported numeric texts exactly under declared semantics |

Document nodes include fields, nested objects and keyed ordered/unordered collections. Dirty-state detection distinguishes absent, null and raw drafts, and uses exact numeric comparison where declared. The local `revision` is **not** a server concurrency token. `resetDocumentState()` is a primitive; it does not ask the user to confirm abandoning edits.

`DocumentSession` wraps an admitted `DocumentState`; use `change()` for edits in that
lifetime. `submit(plan)` calls the existing validator over the current snapshot and
returns blocked evidence or an immutable submission with exact parsed values, typed
paths/deferred checks, attempt identity and local revision. It locks field/structural
edits and duplicate submission. `resolve()` accepts adapter outcomes; rejection and
conflict retain edits, while uncertain/committed results require locked recovery.
`recover()` requires an authoritative complete tree mapped to the submitted UI keys.
Deferred checks require explicit confirmation; ID/version-only responses cannot
establish clean accepted snapshots. Stale attempts from another session are ignored.
See the [operational save contract](contracts/document-state.md#operational-save-lifecycle-aur-state-save-001)
for the public types, ownership and failure transitions. No HTTP or router dependency
is introduced. A clean dirty comparison alone does not establish save completion.

## Validation

| Public API | Use |
| --- | --- |
| `validateField()` | Apply the supported semantic constraints to one field/input |
| `validateDocument()` | Traverse an immutable document against a separate declarative validation plan |

Validation supports required/nullability, exact INTEGER/DECIMAL ranges and divisibility, Unicode text length, strict BOOLEAN/ENUM/BINARY/UUID checks, date/time/datetime profiles, and supported bounded pattern matching. Unsupported server-only pattern checks are deferred; they are not silently accepted.

Document validation collects field issues, definition/structure diagnostics and deferred checks across nested objects and collections. Results use `definition-error > invalid > pending > valid` precedence. Validation does not modify document state, perform network requests, or submit a document.

## Current limitations (not yet a 1.0 claim)

- Save operations require application-managed transport, authoritative readback, UI-key reconciliation and server error mapping; no automatic retry, background edit merging or persistence is supplied.
- DocumentSession provides confirmed discard, a framework-independent leave boundary and explicit unload integration; applications own Router/history adapters and dialogs.
- Typed menu placement and overflow are implemented; full visual/assistive-technology certification and independent consumer evidence remain incomplete.
- Some field renderers are intentionally simple; `BINARY` in the supplied default presentation is output-only, not a file upload control.
- No runtime package manager for unknown themes; installation and application bundling are external.
- Full 1.0 browser/visual/accessibility acceptance and independent consumer evidence are incomplete.

The runtime intentionally does not own business rules, authorization, HTTP, routing, persistence, API schema translation, or database access. Those are application concerns rather than missing generic AUR dependencies.

## Further reference

- [Installation and verification](getting-started.md)
- The installed package public declarations (`@alxarafe/ui-runtime`) define the current TypeScript contract.
- Repository maintainers should distinguish implemented APIs from proposed requirements when updating technical design documents.
