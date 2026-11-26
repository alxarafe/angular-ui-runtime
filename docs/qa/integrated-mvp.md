# Integrated MVP composition acceptance (AUR-QA-COMPOSITION-001)

## Scope and execution

This is repository-local, private installed-APF acceptance, not a permanent demo,
ERP, backend integration, release gate or declaration that AUR 0.9.0 is ready.
Only QA fixtures, acceptance tests and documentation change; no public API or
library implementation changes are authorized by this task.

Inspect `/default-theme/?scenario=integrated` through `./bin/testbed`. One existing
ThemeShellOutlet hosts the existing editor and list fixtures, both mounted and
hidden by application view state. Switching views preserves their independent
application state; it is not a Router guard or a decision to discard a document.
Typed menu intents and legacy navigation use the same explicit QA view switch.

The editor's opt-in QA layout has exactly three tabs:

1. General information: scalar fields, exact numeric text, ENUM, absent/null/empty/raw
   inputs, static readonly/disabled fields and a collapsible amount section.
2. Detail information: two independent keyed collections, an existing nested
   collection, lossless cells and add/remove/move intents sharing DocumentSession.
3. Additional content: a standard deferred-check field, a retained Angular template
   containing an application-owned component, and contextual actions.

The custom component's local draft is deliberately application-owned. It is not
silently included in document save/discard; applications must explicitly bind any
custom business state to their own persistence/lifecycle decisions. Its sample
readonly/disabled behavior is fixture code, not a new AUR policy.

The list view reuses ListGrid's controlled keys, scalar/choice query inputs and
pager. Synthetic page supply and response buttons are application adapters in the
fixture, not HTTP, query execution or a data-source framework.

Run `./bin/test`, `./bin/check` and `git diff --check` in the repository. All installs,
builds, servers and Chromium run through the existing ephemeral Docker workflow.
The complete Chromium suite, not only the integrated spec, is applicable. The
integrated tests run at 1280×800 and 390×844 with five reference themes. Save,
rejection/conflict, reconciliation and discard are exercised once per theme at each
viewport. Other tests combine theme cycles with focused interactions; this is not
an exhaustive Cartesian product of every interaction, input state and theme.

Execution status: **PASS**, 2026-11-26. Product base: `0856f14` (merged PR #36),
with this task's QA-only changes. `./bin/test` passed **329** unit/type-backed tests.
`./bin/check` passed lockfile installation, formatting, TypeScript, tests, production
APF builds/package verification, disposable consumers and **168/168 Chromium tests**
(**14 integrated**, **154 existing**), with **0 failed, 0 skipped, 0 flaky**.
The authoritative browser run started at `2026-11-26T11:51:58.085Z`.
Chromium `145.0.7632.6` / Playwright `1.58.2`; desktop and emulated mobile.
The core archive SHA-256 was `259de9d7d233258451785cb877647d51c72df25fbb31a1a6ed9e50bc4d8dab6b`;
238 locked QA dependencies were preserved. Package versions remain unchanged.
There are **34 integrated candidate PNGs**, not approved visual baselines.

## Acceptance matrix

Browser references are under `tests/browser/specs/`, unit files under `tests/`,
and contracts under `docs/contracts/`. `I1`, `I2` and `I3` refer to
`integrated.spec.mjs` editor composition, shell/list and per-theme document lifecycle
cases. Supplementary specs remain independently executable and run in the full suite.

| Capability | Test scenario | Result | Evidence | Remaining limitation |
| --- | --- | --- | --- | --- |
| Three-tab form/section/group composition | General, Detail, Additional with hidden/collapsed containers | PASS | I1, I3; `form.spec.mjs` | Full contract visual approval is separate. |
| Exact numeric text and absent/null/empty/raw states | Header state transitions and exact integer/decimal acceptance | PASS | I1, I3; `editor.spec.mjs` | Generic scalar widgets are not all specialized FIELD widgets. |
| ENUM and edit-channel separation | Exact Unicode/whitespace choices, one lossless output | PASS | I1, I3; `editor.spec.mjs`, `selector.spec.mjs` | Optional-control lossless support is not implemented. |
| Two independent keyed detail collections | Second-row edit plus first-collection add/move/remove | PASS | I3; `grid.spec.mjs` | No independent row HTTP/save contract. |
| Nested stable paths and row identity | Nested correction; keyed reorder retains a native cell | PASS | I1, I3; `editor.spec.mjs` | No arbitrary complex-object editor. |
| Multiple local/root/server errors and deferred checks | Initial sibling issues; synthetic mapped rejections; deferred section | PASS | I1, I3; `feedback.spec.mjs` | Backend decoding/check execution remains external. |
| Reveal and actual focus completion | First error, collapsed amount/nested cells, row rejection, unknown path | PASS | I1, I3; `feedback.spec.mjs` | Hidden columns have no reveal implementation. |
| Mixed standard fields and custom slots | Deferred field and one retained custom component in Additional | PASS | I1; `form-slots.spec.mjs` | Stable template/container identities are required. |
| Component/DOM/local-state retention | Theme cycles, context refresh, tab and section hiding | PASS | I1, I2; `form-slots.spec.mjs` | Arbitrary layout rearrangement can remount views. |
| Contextual actions and restrictions | Explicit action once, disabled action suppressed, app-owned custom locks | PASS | I1; `form.spec.mjs` | Authorization/action policy is application-owned. |
| Five themes and narrow layout | Full shell plus form/list content, wrapping and horizontal scroll | PASS | I1, I2, I3; `default-theme.spec.mjs`, `list-ports.spec.mjs` | Captures are candidates, not human-approved baselines. |
| Keyboard interaction | Tab activation, Home/End/arrows, Enter/Space, dialog Escape | PASS | I1, I2, I3; `navigation.spec.mjs` | Real assistive-technology testing is not covered. |
| Typed/legacy menus | Same retained content; mode isolation; explicit view intents; disabled item | PASS | I2; `menus.spec.mjs`, `navigation.spec.mjs` | No production routing/authorization integration. |
| Single/multiple selection across pages | Independent channels; outside-page keys retained | PASS | I2; `list-ports.spec.mjs` | No select-all, range selection or bulk-action policy. |
| Search/sort/filter presentation | Exact string/opaque choice drafts; explicit application per theme | PASS | I2; `list-ports.spec.mjs` | No query dialect, semantic filter builder or fetching. |
| Pager boundaries and empty/unknown totals | Requested offsets do not fetch; supplied page and first/last boundaries | PASS | I2; `list-ports.spec.mjs` | No arbitrary page jumps or page-size chooser. |
| Readonly/disabled and session locks | Scalar/custom input restrictions; locked edits and structural buttons | PASS | I1, I3; `grid.spec.mjs`, `list-ports.spec.mjs` | Custom components must enforce their own inputs. |
| Dirty state and discard | Dirty editor hidden by list; cancel/confirm returns focus and preserves/resets data | PASS | I2, I3; `document-protection.spec.mjs` | No automatic discard of unrelated custom state or Router integration. |
| Save/rejection/conflict/reconciliation | Synthetic submission, separate rejection reasons, committed/readback acceptance | PASS | I3; `document-save.spec.mjs` | No claim of backend durability or transaction behavior. |
| No implicit edits/duplicate actions; public APF only | Exact event deltas, stable snapshots, no fetch/XHR, installed archive build | PASS | I1–I3; `testbed-boundary.test.mjs`; consumer/package checks | Synthetic acceptance is not independent consumer conformance. |
| Optional-control lossless document editing | Not part of the integrated editor; explicit unsupported boundary | NOT COVERED | `editor-bindings.md`, focused optional-control contracts | Not implemented; scalar optional controls have separate evidence. |
| Hidden grid-column reveal | No hidden-column presentation/reveal port is exercised | NOT COVERED | Grid/editor contract limits | Not implemented; unknown/unrendered targets do not invent a control. |
| Complete specialized lossless FIELD widgets | Plain-text bridge does not establish semantic widget coverage | NOT COVERED | FIELD notes below; scalar/temporal focused suites | Multiline/picker/binary widget gaps remain. |
| Cross-browser/assistive technology/human visual approval | Chromium emulation and candidate captures only | NOT COVERED | Browser metadata: visualBaselineApproved=false | Implemented primitives require broader verification. |
| Independent production/backend integration | Synthetic installed-APF application only | NOT COVERED | No fetch/XHR; disposable consumer evidence | Outside this MVP; no backend durability/routing/authorization claim. |

## Classification of remaining scope

- **Implemented and verified:** the **20 PASS rows** above, within their named
  scenarios and theme/viewport scope. These include real user interaction and
  unchanged-state/event-count assertions, not just successful instantiation.
  The five NOT COVERED rows are explicit exclusions/gaps, not passing substitutes.
- **Implemented but insufficiently verified:** other browsers, physical mobile
  devices, assistive technologies, human visual/contrast review, independent real
  application adoption and exhaustive theme/state combinations. Optional controls
  have registry/domain/rating evidence, but are not part of this integrated editor.
- **Not implemented:** lossless document binding for optional-control fields,
  hidden-grid-column reveal, a general complex-object editor, complete specialized
  widgets for all FIELD semantics, select-all/range selection and arbitrary pager
  navigation. Existing semantic validation and artifact IDs do not imply specialized
  widgets for every field type. Help/touched policy and full FIELD acceptance remain
  incomplete as documented by the editor contract.
- **Outside the agreed MVP:** HTTP/backend or ARP integration, transport codecs,
  authorization, Router policy, query interpretation/fetch/caching/cancellation,
  custom business logic, production persistence guarantees, an ERP/demo application,
  a general dialog framework, publication and release readiness certification.

The lossless document bridge currently has a BOOLEAN checkbox and themed ENUM;
its other scalar artifacts use plain text. This integrated editor does not verify
TEXT multiline editing, lossless DATE/TIME/DATETIME picker interactions, UUID-specific
controls or BINARY upload/edit/preview. Standalone legacy TEXT textarea/native date
controls do exist, and the legacy BINARY renderer is output-only; those facts do
not establish lossless specialized-widget acceptance. INTEGER/DECIMAL exact-text
editing and validators are verified separately from any native numeric widget claim.

## Evidence artifacts and defect handling

The authoritative full-suite results are `artifacts/testbed/results.json` and
`artifacts/testbed/report/index.html`; installed archive/dependency evidence is in
`artifacts/testbed/build-evidence.json`. Candidate integrated PNGs are under
`artifacts/testbed/integrated/{desktop,mobile}/`: General/Details (default), Additional
and List (five themes), plus accepted document/discard (five themes). Preserve these
with the tested revision, archive digest and pinned image/browser metadata before
another run overwrites them. Existing screenshot review instructions still apply.

QA defect classification: the first integrated editor run exposed a QA
expectation defect (QA-COMP-T01): first-invalid navigation follows the supplied
EditorFeedback order, not visual field order. Canonical validation feedback placed
amount before title. An isolated Chromium focus trace showed one focus transition
to `editor-amount` and one true completion at both viewports; the test now asserts
that documented order. No product code was changed for this correction.

Product-defect status: **no product defect identified in the covered scenarios**.
The final matrix contains **20 PASS / 0 FAIL / 5 NOT COVERED** rows. The final full
suite has no expected-failure, skipped or flaky case masking a product failure.
A failed assertion must be classified as a test defect, product regression or missing feature. Only isolated
QA defects may be fixed here. Product regressions and missing features must stay
explicitly reported; no public API additions or test-only masking are authorized.
Passing automation alone does not establish AUR 0.9.0 readiness.
