# Neutral paged choice selector (AUR-SELECTOR-001)

`ChoiceSelector` (`aur-choice-selector`) is a controlled, data-only selector. It
uses the existing theme ENUM artifact and lossless document bridge, not another
registry, editing tree or validation engine. It has no HTTP, relationship metadata,
authorization, pagination query or asynchronous data-provider API.

## Public ports

`ChoiceSelectorContext` extends `FieldRendererContext` and requires `selector`:

```ts
const selector: ChoiceSelectorOptions = {
    options: [
        { value: '', label: 'Empty identifier' },
        { value: 'opaque /?#', label: 'Repeated label' },
        { value: '9007199254740993', label: 'Repeated label' },
    ],
    current: { value: 'outside-page', label: 'Previously selected' },
    previous: false,
    next: true,
    pageLabel: 'Page one',
    busy: false,
    // error: 'Could not load the next page',
};
```

Options have unique **string** identities and independent display labels. Labels
may repeat. Empty, whitespace, Unicode and numeric-looking IDs are exact strings;
no parsing, normalization, JSON conversion or label-to-ID inference occurs. Native
numbers and duplicate IDs are rejected. Applications own conversion between these
opaque strings and their exact wire types. The component snapshots/freezes supplied
page data; applications replace immutable inputs when a page changes.

`current` is optional application-supplied display evidence for one exact identity.
Its label is used only when its value matches the selected string. A selection
outside `options` is retained as a disabled Current option when this label is known.
Otherwise it remains visible as an unknown draft, with its original document input
unchanged. Neither replacing options nor supplying a stale page emits an edit.
An old DOM option absent from the current page is ignored on selection. The consumer
must still reject stale asynchronous responses and associate current labels with
the right identities; AUR does not order requests or cache pages.

The standalone component takes `[context]` and exposes:

- `editChange: EditingInput` when `context.documentInput` is supplied.
- `valueChange: FieldValue` otherwise, preserving legacy scalar integration.
- `pageChange: 'previous' | 'next'`, without changing the selection.

Exactly one editing channel fires per explicit selection. No output fires just
because inputs render or refresh. Legacy mode cannot express absence or distinguish
raw text from a scalar string; Unset is therefore hidden, and explicit draft typing
emits scalar text. Set null and Empty text remain explicit scalar choices.
Ordinary forms use controlled inputs/events, for example:

```html
<aur-choice-selector
    [context]="choiceContext"
    (valueChange)="setValue($event)"
    (pageChange)="loadPage($event)"
/>
```

No `ControlValueAccessor`/`ngModel` adapter is introduced.

## Document forms and keyed grids

Set `FieldRendererContext.selector` on an existing **artifact** field, for example
`field.STRING`. `FormComposition` and `DetailGrid` select the public component
without introducing a new field artifact. `selector` takes precedence over the
plain `choices` catalogue for that opted-in field. Existing non-selector ENUM and
legacy scalar behavior is unchanged.

Use `bindDocumentEditor` field options or collection `fields` options to supply the
page. Existing `fieldEdit`/`gridEdit`/`collectionEdit` outputs still carry the same
typed paths and stable row keys and apply through the existing intent adapters.
The session remains the only mutable document. Collection `fields` options are
shared per property; consumers can immutably derive individual row contexts when
rows need different current labels, option pages or paging states.

Paging is presentation, not a document mutation:

- `FormComposition.fieldPage` emits `FormFieldPage {id,path,direction}`.
- `DetailGrid.gridPage` emits `DetailGridPage
  {collectionId,collectionPath,key,field,path,direction}`.
- `FormComposition.collectionPage` forwards the same keyed grid intent.

Applications handle these events by loading and supplying a new page. Do not send
page intents to the document edit adapters. No offset, cursor or default is invented.

## States, themes and limitations

Absent, null, empty string, known/unknown values and raw drafts retain their
`EditingInput` distinctions. Unknown/raw values stay visible and editable; typing
keeps a raw input even if it matches a loaded option. Only explicit selection or
the existing presence buttons changes representation. Page membership is not a
validation or authorization rule; the existing document validation plan is separate.

Busy blocks edits and page intents, with aria-busy and a loading status. The select
stays focusable, with disabled options and aria-disabled during loading. Error text
is announced and associated with the control without discarding its value. Readonly
and disabled inputs suppress edits and paging, including synthetic change events.
Field feedback uses stable IDs and aria-invalid/aria-describedby on both selection
and draft controls. Native select keyboard behavior, retained focus and relative
control sizing use the existing five reference themes and their panel composition.
Consumers load those themes' public CSS and provide the existing theme runtime.

Optional-control fields/requests cannot be combined with this selector. Their
bounded scalar capability guards remain in force; lossless optional-control support
is not added or silently bypassed. Third-party ENUM overrides must honor selector
options, current display, busy/feedback and permission context to provide equivalent
presentation. No full FIELD catalogue, relation protocol, backend compatibility,
other-browser/assistive-technology acceptance or human visual certification follows.

Unit/type tests cover immutable data, exact IDs, state/channel separation and keyed
page intents. The installed-APF testbed `?scenario=selector` exercises ordinary forms,
document forms and grids at desktop/mobile widths across all five themes. It supplies
synthetic pages locally; it is not a backend or a permanent demonstration application.
