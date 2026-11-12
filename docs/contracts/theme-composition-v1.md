# Independent structural theme composition

AUR-THEME-PORTS-001 adds opt-in presentation ports on the existing engine, refining
the [theme package contract](theme-package-v1.md). No package installation, remote
loading or proposed 1.0 widgets are implemented.

## Independent products and extraction obstacles

UI Runtime is a standalone Angular presentation product. It does not import,
execute or require a Java/C# definition generator, HTTP schema or consumer service.
A future generator is independently usable without this runtime. Interoperability
belongs to neutral versioned definitions and optional external adapters, whose
APIs are not defined here. Theme packages use public presentation exports and
Angular peers; no ERBAS base class or router is required.

Read-only ERBAS inspection identified these future extraction changes:

| Reference | Consumer dependency |
| --- | --- |
| Default/Cyberpunk `structure.ts` | `ShellBase`, `NavigationBase`, local slot and navigation/panel outlets. |
| Default/Cyberpunk shell templates | Consumer slot constants and extension components. |
| Default navigation template | `RouterLink`, `RouterLinkActive`, `applicationRoute` and application navigation shape. |
| `shell-content.ts` | Presentation base classes tied to the application's slot vocabulary. |
| `shell-slot-outlet.ts` | Consumer extension registry and contribution ordering. This ownership stays outside the library. |
| `theme-{shell,navigation,panel}-outlet.ts` | Useful view-ownership/binding patterns without an independent package boundary. |

No reference component/template was migrated. New hosts reuse `ThemeResolver` and
`ThemeService`, with no second engine, extension registry or generic plugin API.

## Public ports

Import only from `@alxarafe/ui-runtime`:

| Export | Contract |
| --- | --- |
| `ThemeNavigationItem` | Readonly `id`, `label`; optional `href`, native `target`/`download`, `disabled`, `current`, ordered `children`. One application-owned tree, not the proposed multi-menu model. |
| `ThemeNavigationSelection` | Readonly `itemId`: intent, never an executable operation or router command. |
| `ThemeShellComponent` | Signal `navigation` input and `navigationSelected` action output; optional `linkActivation` callback input. |
| `ThemeNavigationComponent` | Signal `items` input and `selected` action output; optional `linkActivation` callback input. |
| `THEME_SHELL_BINDINGS`, `THEME_NAVIGATION_BINDINGS` | Frozen public template names for those inputs/outputs. |
| `THEME_SHELL_PROJECTION` | Frozen heading/content/footer selectors below. |
| `THEME_REGION_ATTRIBUTE`, `ThemeRegions` | Named projection attribute; readonly name-to-`TemplateRef<unknown>` map. |
| `ThemeShellOutlet` (`aur-theme-shell`) | Owns projected views, binds `navigation`, forwards `navigationSelected` and applies the effective CSS class. |
| `ThemeNavigationOutlet` (`aur-theme-navigation`) | Resolves Navigation, binds `items`, forwards `selected`. No routing execution. |
| `ThemePanelOutlet` (`aur-theme-panel`) | Resolves Panel and preserves the host-owned projected view. |

Panel's port is exactly one ordinary `<ng-content />`; no empty marker interface
or panel context is necessary. Authors declare normal Angular inputs/outputs and
may implement the interfaces; no inherited base class is required.

`ThemeArtifacts` structure entries remain `Type<unknown>`, and registry validation
is unchanged. Old components keep working through their existing consumer outlets.
The new hosts require their opt-in port metadata when mounting: missing bindings
or invalid selectors throw before that host replaces its current component. They
do not silently treat malformed overrides as omitted ones. Reflection checks
names, standalone metadata and selectors, not actual payloads or visual behavior.

## Projection and optional named regions

```html
<aur-theme-shell [heading]="headingTemplate" [content]="editingTemplate"
  [footer]="footerTemplate" [navigation]="authorizedNavigation"
  [regions]="{ tools: toolsTemplate, account: accountTemplate }"
  [linkActivation]="handleLink"
  (navigationSelected)="handleApplicationIntent($event.itemId)" />
```

Content is required; heading/footer and regions are optional. The consumer owns
templates, editing state and extension composition. Missing optional regions are
normal. There is no library registration, priority ordering, extension discovery
or fixed ERBAS slot enum.

The host creates stable `div` wrappers around application views:

| Input | Wrapper / static shell projection selector |
| --- | --- |
| heading | `[aur-shell-heading]` |
| content | `[aur-shell-content]` |
| footer | `[aur-shell-footer]` |
| regions.tools | `[aur-theme-region="tools"]` |

Names follow `^[a-z][a-z0-9-]*$`. Themes use Angular's static `ng-content select`
for the regions they place. Quoted/unquoted region attribute-value selectors are
equivalent. Only these selectors and a catch-all `*` are supported, not arbitrary
CSS selectors or runtime HTML. Duplicate equivalent selectors are rejected.
Wrappers are part of the contract; do not assume original template roots are
direct children of the shell.

Every shell must declare the content selector and one catch-all `<ng-content />`.
Unclaimed supplied wrappers go to that catch-all once, in heading/content/footer
then region input order. Themes must keep it visible and accessible, especially
for actions. Assignment cannot prove that CSS does not hide or obscure a region.
This is not the proposed 1.0 typed-menu overflow implementation.

Example shell (imports from Angular/public UI Runtime only):

```ts
@Component({
  imports: [ThemeNavigationOutlet, ThemePanelOutlet],
  template: `
    <header><ng-content select="[aur-shell-heading]" /></header>
    <aur-theme-navigation [items]="navigation()" [linkActivation]="linkActivation()"
      (selected)="navigationSelected.emit($event)" />
    <main><aur-theme-panel>
      <ng-content select="[aur-shell-content]" />
    </aur-theme-panel></main>
    <aside aria-label="Tools"><ng-content select='[aur-theme-region="tools"]' /></aside>
    <footer><ng-content select="[aur-shell-footer]" /></footer>
    <div><ng-content /></div>
  `,
})
export class IndependentShell implements ThemeShellComponent {
  readonly navigation = input<readonly ThemeNavigationItem[]>([]);
  readonly navigationSelected = output<ThemeNavigationSelection>();
  readonly linkActivation = input<ThemeLinkActivationHandler>();
}
```

The compiled synthetic example is `apps/testbed/src/composition.ts`. Independent
packages still require APF exports, styles, compatibility and conformance evidence.

## Navigation and application intent

The application supplies an ordered, acyclic tree with stable globally unique IDs,
meaningful labels and validated hrefs. There is no `applicationRoute`, permission
expression, HTTP operation or domain action model. Hosts forward inputs/intent;
they do not validate navigation data or authorize operations. Consumers must
recheck effective availability and authorization before execution.

Themes render native links for hrefs, buttons for action leaves and accessible
groups for branches. Preserve modified-click/open-in-new-tab link behavior.
Routing interception and discard protection belong to the consumer; do not
unconditionally preventDefault on every link. `selected` reports action intent;
it is not a second mandatory event for native href activation. Disabled entries
cannot dispatch or navigate; current links expose `aria-current`. Meaningful nav
labels, keyboard reachability, visible focus and no duplicate/missing items remain
theme obligations.

Proposed 1.0 `MenuDefinition`, `MenuSelection`, placements and `menus` components
are unchanged and unpublished. This compatibility tree neither limits multi-menu
design nor implements its overflow. A future optional adapter may project host
data, without rendering a menu through two paths. Form/grid ports and optional
library defaults are unaffected.

### Optional synchronous link activation (alpha.3)

`ThemeLinkActivation` exposes readonly `itemId`, the exact supplied `href`, a live
readonly `defaultPrevented` getter, and `preventDefault()`. Configure the optional
`[linkActivation]` input of `ThemeShellOutlet` or `ThemeNavigationOutlet` with a
`ThemeLinkActivationHandler`. This is a callback input, **not** an Angular output:
it provides a synchronous cancellation boundary without inspecting private output
subscriber state or requiring an extra enable flag. It is not navigation metadata
and is never stored on `ThemeNavigationItem`.

```ts
readonly handleLink: ThemeLinkActivationHandler = event => {
  event.preventDefault(); // Cancel now, before any asynchronous guard/router work.
  // The application may navigate, reject the request or await its own guard.
  // Resolve event.itemId/event.href through application-owned policy here.
};
```

A conforming navigation calls the public `activateThemeLink(item, $event,
linkActivation())` exactly once on its real anchor's `(click)`. Recursive trees
pass the callback unchanged. Shells forward their optional callback to
`ThemeNavigationOutlet`; that outlet binds it to the resolved navigation component.
There is no second `selected` emission for links, no event bus or router dependency.
Default navigation and Default/Cyberpunk shells implement this forwarding; all
five packaged themes share the same effective navigation via direct fallback.

The helper dispatches only an enabled nonempty-href, cancelable, ordinary primary
click without Ctrl/Meta/Shift/Alt (including browser-generated Enter clicks).
Already cancelled events, non-primary clicks, context menus, downloads and
non-self targets remain native without callback dispatch. Explicit `target` and
`download` values become native anchor attributes; an absent download attribute
is distinct from `download=""`. Effective base-element targets are also respected.
No domain classification is attempted: external links are native unless an
eligible callback explicitly cancels them. Hrefs/schemes and effective authorized
entries remain consumer-validated data.

Cancellation acts on the original DOM event only during the synchronous callback.
After it returns, `preventDefault()` is deliberately inert, including after an
`await`/Promise. A callback that merely observes leaves HTML behavior intact. An
SPA consumer must cancel first, then decide whether to route or reject; the
runtime does not run guards, manage history, call a router, force reloads or
recover from consumer exceptions. Keep actual anchors for URLs, copying, browser
context menus, history and assistive technology.

The capability is additive: existing interfaces make the input optional, and old
consumers/themes work when it is unused. When a callback is configured, opt-in
hosts require the compiled `linkActivation` input before replacing their current
component (also when a callback is added later). Missing capability throws the
existing structural-validation error rather than silently losing interception.
No new public diagnostic type or registry admission rule is introduced. Reflection
cannot prove semantic forwarding; third-party packages must supply behavioral
conformance evidence. Alpha.3 theme peers require runtime `0.3.0-alpha.3` exactly.

## View, state and focus lifetime

Shell embedded views belong to the host, outside resolved visual shell instances.
Their wrappers move when the component changes. Panel likewise owns its projection
outside the visual panel. CSS-only identity changes do not recreate unchanged
components, and reactive navigation updates rebind without replacement.

A region name with the same TemplateRef retains its view and raw DOM state even
when relocated. Replacing/removing a supplied template intentionally destroys only
that view. Host destruction destroys all its views. This is Angular ownership,
not durable state storage: editing, validation, dirty/save state must still live
outside replaceable visuals. Theme-local state may be destroyed.

Shell and panel hosts share an internal retained-node focus policy. They capture
focus before replacement and restore it after Angular rendering only when that
same application-owned node is still connected and focus is unassigned/on body.
An already focused node requires no focus operation; a different active element
always wins. Pending restorations for the same node are coalesced, including
nested shell/panel replacement. Unchanged resolved components do not schedule
restoration. Angular's after-render lifecycle skips callbacks during SSR and
cancels callbacks when their injection context is destroyed.

This preserves native focus, DOM identities and application-owned values; it does
not recreate destroyed controls or map logical focus to a new navigation/field
control (even one with the same ID). Consumers own that separate policy.
No recovery from arbitrary Angular constructor/template/event failure, reload
persistence or complete document lifecycle is promised. Pre-mount rejection and
post-mount failure remain distinct as required by the package contract.

## Evidence, compatibility and remaining extraction work

`./bin/test` compiles type probes and tests structural metadata/invalid-port
rejection plus legacy admission. `./bin/check` builds/verifies APF, peer isolation,
the unchanged legacy disposable consumer and the installed-package testbed.

The `?scenario=composition` fixture runs at 1280×800 and 390×844 with synthetic data
and two independent shell/navigation/panel implementations. It covers complete
default, sparse panel-only and CSS-only selection, unknown fallback, navigation
input/intent updates, named/unclaimed regions, native keyboard controls, retained
node focus, application view/DOM identity and replacement of one supplied template.
It uses one provider composition and public installed exports, with no ERBAS,
generator, backend or production theme dependency. Candidate screenshots are not
approved visual baselines or proof of all 1.0 requirements.

All 20 required keys, protected complete default, one-hop resolution,
`activate(id): boolean`, field bindings and provider isolation remain unchanged.
These invariants remain intact in alpha.3. Independent Default and optional theme
packages now exist; see [package versioning](package-versioning.md). Full 1.0
menu/overflow and cross-consumer acceptance remain open.

Before real default-theme extraction, a separate task must adapt its imports,
replace router-specific navigation with consumer handling, project consumer-owned
shell extensions into regions, reconcile old bindings/projection attributes and
package all 20 default artifacts plus CSS/assets. Package compatibility,
separation of consumer-targeted CSS (such as resource-screen selectors),
licensing/provenance, five-theme consumer/browser evidence and human visual review
remain required; this task does not automatically adapt or migrate ERBAS themes.
