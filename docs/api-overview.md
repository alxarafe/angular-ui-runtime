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

## Forms and grids

| Public API | Use |
| --- | --- |
| `composeForm()` | Derive deterministic field/action placement from a definition/layout |
| `FormComposition` | Render composed forms and surface application-owned field/action events |
| `ListGrid` | Present read-only collections |
| `DetailGrid` | Present editable detail collections and emit keyed change intents |
| `formPathKey()` and `ValuePath` types | Work with stable typed field/collection paths |

Forms support simple layouts as well as ordered tabs, sections and groups, with contextual actions, fallback placement, and programmatic diagnostics. Grids support stable row keys, independent collections, editing intents and optional row reordering. These are UI primitives; they do not fetch data or perform CRUD calls themselves.

## Document state

| Public API | Use |
| --- | --- |
| `createDocumentState(document)` | Establish defensively copied immutable accepted/current snapshots |
| `applyDocumentChange(state, change)` | Apply typed field, add-row, remove-row or move-row changes |
| `resetDocumentState(state)` | Restore accepted values in memory |
| `exactNumericEqual()` | Compare supported numeric texts exactly under declared semantics |

Document nodes include fields, nested objects and keyed ordered/unordered collections. Dirty-state detection distinguishes absent, null and raw drafts, and uses exact numeric comparison where declared. The local `revision` is **not** a server concurrency token. `resetDocumentState()` is a primitive; it does not ask the user to confirm abandoning edits.

## Validation

| Public API | Use |
| --- | --- |
| `validateField()` | Apply the supported semantic constraints to one field/input |
| `validateDocument()` | Traverse an immutable document against a separate declarative validation plan |

Validation supports required/nullability, exact INTEGER/DECIMAL ranges and divisibility, Unicode text length, strict BOOLEAN/ENUM/BINARY/UUID checks, date/time/datetime profiles, and supported bounded pattern matching. Unsupported server-only pattern checks are deferred; they are not silently accepted.

Document validation collects field issues, definition/structure diagnostics and deferred checks across nested objects and collections. Results use `definition-error > invalid > pending > valid` precedence. Validation does not modify document state, perform network requests, or submit a document.

## Current limitations (not yet a 1.0 claim)

- No generic completed save lifecycle, duplicate-submit guard, server reconciliation, optimistic-conflict workflow, or server error mapping.
- No complete discard-confirmation/navigation/unload protection lifecycle.
- No fully implemented typed multi-menu/overflow system.
- Some field renderers are intentionally simple; `BINARY` in the supplied default presentation is output-only, not a file upload control.
- No runtime package manager for unknown themes; installation and application bundling are external.
- Full 1.0 browser/visual/accessibility acceptance and independent consumer evidence are incomplete.

The runtime intentionally does not own business rules, authorization, HTTP, routing, persistence, API schema translation, or database access. Those are application concerns rather than missing generic AUR dependencies.

## Further reference

- [Installation and verification](getting-started.md)
- The installed package public declarations (`@alxarafe/ui-runtime`) define the current TypeScript contract.
- Repository maintainers should distinguish implemented APIs from proposed requirements when updating technical design documents.
