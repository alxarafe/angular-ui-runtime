# Typed multiple menus (AUR-MENU-001)

This additive subsystem implements MENU-001/002 and the functional overflow portion
of MENU-003. It uses the existing `ThemeShellOutlet`, theme resolver and named shell
projection regions. The fourteen mandatory artifacts, legacy navigation interfaces,
registration rules and independent application extension facilities are unchanged.

## Public definitions and admission

`MenuDefinition` has readonly `id`, `kind`, `label`, `items`. `MenuKind` is exactly
`primary | secondary | account`. Any number of menus can share a kind. Identity,
semantic kind, display label and placement are independent. Input menu/sibling order
is authoritative; labels are never keys. Item IDs must be unique within the entire
menu tree, but may repeat across separate menus.

`MenuItem` has readonly `id`, `label`, optional `action`, `href`, `target`, `download`,
`disabled`, `current` and ordered `children`. Actions are opaque application references;
selection emits only `{menuId, itemId}: MenuSelection`. Leaves require either an action
or a nonempty href. Branches may be groups with no action. Action and href are mutually
exclusive; target/download require href. Empty menus are admitted and omitted without
losing actionable entries; empty child arrays do not turn an inert leaf into a group.
Disabled ancestors block all descendant activation without deleting descendants.

`snapshotMenus(definitions)` validates the entire collection before rendering changes,
then defensively copies and deeply freezes it. It rejects duplicate menu IDs, duplicate
item IDs anywhere within a menu, cycles, unknown members, invalid kinds, empty IDs/labels,
wrong flags, malformed arrays and inert leaves. Invalid input throws, rather than
partially mounting a collection. Trees deeper than 128 child edges are rejected for
bounded traversal; there is no fixed menu-count limit. Application updates must supply
new input references; modifying an already supplied object in place is unsupported.

## Placement and opt-in shell mode

```html
<aur-theme-shell [content]="content" [menus]="effectiveMenus"
  [menuPlacements]="[{ menuId: 'operations', region: 'tools' }]"
  [menuLinkActivation]="handleMenuLink"
  (menuSelected)="handleSelection($event)"
  (menuDiagnostics)="recordDiagnostics($event)" />
```

`menus === undefined` selects existing legacy mode. Supplying an array, even `[]`,
selects typed-menu mode. The host binds an empty tree to the legacy shell navigation,
and suppresses its legacy selection output. Supplying both menus and nonempty legacy
navigation emits `mixed-navigation`; typed menus win. No simultaneous projection into
the legacy navigation tree occurs. The new menus use a host-owned default presentation,
not an additional theme registry or a new required component artifact.

`MenuPlacement` is `{menuId, region}`. Regions are shell selectors of the existing form
`[aur-theme-region="tools"]`. Explicit named projection support is the theme's opt-in
placement capability. A catch-all alone does not claim a placement. Region names follow
`^[a-z][a-z0-9-]*$`. Existing application-owned `[regions]` templates take precedence;
menus assigned to an occupied region use overflow instead of displacing that template.

`composeMenus(definitions, placements?, regions?)` exposes the pure placement decision:
frozen ordered `menus` entries contain a `menu` snapshot and `region: string | null`;
null denotes overflow. Frozen `diagnostics` report `invalid-placement`,
`conflicting-placement` and `unavailable-region`. Unknown menu IDs are diagnosed.
Multiple assignments to one menu conflict even when they name the same region; that
menu falls back exactly once. Invalid placements for known menus likewise fall back.
Malformed placement collections throw. Diagnostics are programmatic, not rendered as
technical UI. Menu input order is preserved within every region and overflow; placement
order never sorts menus. Visual region locations naturally determine cross-region
reading order rather than a single flattened DOM order.

Every admitted nonempty menu and each tree item has exactly one mounted instance,
either projected into a supported region or retained in the mandatory host overflow.
Host-owned menu views, disclosure state and application views survive structural and
CSS-only theme changes. A theme losing its region moves the same menu to overflow;
if that menu contains focus, overflow opens so the focused control remains available.
The fallback lives outside replaceable shell views and does not rely on a shell's
catch-all. Themes must keep their explicitly claimed regions visible and usable;
AUR cannot prove arbitrary third-party CSS does not obscure a claimed region.

## Interaction and application boundary

The overflow is a labelled region with a native toggle exposing `aria-expanded`, a
close button and Escape handling that restores focus to the toggle. It is not modal
and does not trap focus. Closed overflow keeps owned DOM mounted but hidden from
keyboard/assistive navigation. Each menu is a named `nav`; native `details/summary`
provide labelled nested disclosures and expanded/collapsed semantics. Native Tab,
Shift+Tab, Enter and Space interactions apply; this is navigation, not an ARIA desktop
menubar and does not implement arrow-key roving. Controls wrap long labels, inherit
font sizes, have visible focus outlines and minimum touch height.

Hrefs render real anchors, actions native buttons, disabled entries disabled buttons,
and current controls expose `aria-current="page"`. Group summaries remain operable
for inspection when descendants are disabled. `MenuLinkActivationHandler` receives
`menuId` plus the existing link activation fields and synchronous `preventDefault`.
It reuses `activateThemeLink`: modified clicks, downloads and non-self targets remain
native, and links do not also emit action selection. Cancel synchronously before
awaiting an application-owned guard/router operation. The application validates URL
schemes, supplies effective authorized entries, checks availability and executes every
action or navigation. AUR performs no authorization, routing, HTTP or persistence.

## Evidence and limits

`tests/menus.test.mjs` covers zero/one/many (including two of every kind), repeated
labels, immutable snapshots, duplicate IDs, cycles, malformed input, empty menus,
conflicting/unsupported assignments and deterministic exactly-once placement.
`tests/fixtures/menus.type-test.ts` checks public declarations and legacy compatibility.
The installed APF `?scenario=menus` fixture and `tests/browser/specs/menus.spec.mjs`
exercise all five reference themes plus an independently authored region-aware shell,
retained menu/document nodes, ordering/counts, nested keyboard controls, focus on
closing overflow, disabled/current states, link interception and enlarged high-contrast
controls at desktop/mobile Chromium widths. Existing legacy navigation tests continue
unchanged. Human visual/accessibility certification, other browsers/assistive technology
and independent consumer authorization/router integrations remain unverified. MENU-004
therefore remains partial, as does MENU-003's full visual acceptance gate.
