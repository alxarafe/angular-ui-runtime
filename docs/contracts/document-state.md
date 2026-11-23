# Immutable document editing core (AUR-STATE-001-CORE)

This increment exports framework-independent functions and readonly data types from
`@alxarafe/ui-runtime`. The state modules have no Angular runtime dependencies.
They own accepted and current values, editing operations, revision and derived dirty
state only. They do not implement validation, persistence, reconciliation, undo,
navigation protection or user-confirmed discard.

## Model and public API

`DocumentNode` is a recursive union of `DocumentField`, `DocumentObject` and
`DocumentCollection`. Objects have fixed, named `properties`; collections have
`DocumentRow[]`, each with a nonempty unique `key` and an object `value`. Nested
objects and collections use the existing `ValuePath`: property segments traverse
objects and row segments select stable keys. Positions never identify rows.

A field contains `equality: FieldEquality` and `input: EditingInput`:

- `ValueSlot` is `{kind:'absent'}` or `{kind:'value', value: FieldValue}`.
- `EditingInput` additionally admits `{kind:'raw', text:string}`.
- `FieldValue` remains exactly `string | boolean | null`. Neither an absent slot
  nor a raw draft is coerced into a scalar value.
- Equality is explicitly `{type:'exact'}`, `{type:'INTEGER'}` or
  `{type:'DECIMAL', allowExponent:boolean}`. These describe comparison only, not
  a second field definition/constraint or validation engine. All other semantic
  types, including temporal values, use exact lexical equality in this increment.

Every node may carry effective `readOnly` and `disabled` flags. They block edits
through that node, including nested descendants. Collections also require explicit
`ordered`, `allowAdd`, `allowRemove` and `allowReorder` booleans. Structural operations
check the collection's capabilities; per-field flags prohibit field changes, not
removal of an otherwise removable containing row. Applications supply effective
permissions and keep rendering contexts aligned with them; this is not an
application authorization engine.

`createDocumentState(document, initialRevision = 0)` defensively snapshots the tree
into independent, deeply frozen `original` and `current` documents. The original
may contain absent/value slots but not raw drafts. Structural admission does not
certify numeric syntax or semantic validity. Accepted values remain the caller's
responsibility. All metadata, property maps, rows, arrays and inputs are copied.
Plain objects only, cycles, malformed nodes/flags/keys and unknown model members
are rejected. Nesting is bounded to 128 edges. Empty objects/collections are valid.

`DocumentState` exposes only `original`, `current`, `revision` and `dirty`. State
instances are opaque at runtime: operations require a state returned by this core,
not a reconstructed object or JSON copy. Create a new state from an explicitly
accepted document when initializing another editing lifetime. No save or validation
state, touched flags or speculative session facade is published.

`applyDocumentChange(state, change)` returns a new frozen state with the same
original document. It admits these `DocumentChange` variants:

| kind | Data | Effect |
| --- | --- | --- |
| `field` | `path`, `input` | Replace a field's absent/value/raw input. |
| `add-row` | collection `path`, prepared `row` | Append a defensively copied row; caller supplies key, values and comparison/capability metadata. |
| `remove-row` | collection `path`, `key` | Remove exactly the keyed row. |
| `move-row` | collection `path`, `key`, `before: string \| null` | Move before an existing key or to the end. Requires an ordered, reorder-enabled collection. |

A move before itself is a permitted no-op. Unknown properties, malformed paths,
stale keys, duplicate/missing keys, wrong node targets, missing prepared rows and
prohibited operations throw without altering any previous state or advancing its
revision. An add request never invents a row or defaults. Inserted object shapes
and their effective metadata are application-prepared, not inferred from existing
rows. The core is a neutral tree, not a schema validator.

`resetDocumentState(state)` explicitly restores the accepted snapshot, including
its keys, ordering and lexical inputs. It is an in-memory primitive, **not** a
user-confirmed discard workflow. Calling code must obtain whatever authorization
its future lifecycle requires. Original and current may share frozen subtrees after
operations/reset; no mutable objects are shared with caller input.

The revision counts successful operations, including clean lexical edits, no-ops
and resets. The optional starting revision must be a nonnegative safe integer.
Advancing beyond `Number.MAX_SAFE_INTEGER` throws, including on reset. Revisions
are local counters, not server versions. There is no history or mutable dirty flag.

## Exact equality and dirty state

Dirty is derived from a recursive effective-content comparison of original/current:

- Absence, null, empty string, whitespace and booleans/text are distinct.
- Raw drafts retain their exact text and remain distinct from scalar slots,
  including mathematically equivalent text. No last-parsed-value fallback exists.
- Numeric value slots compare by exact mathematical value when both lexical forms
  can be safely interpreted under the same explicit comparison semantics. The
  current spelling is retained; comparison never normalizes the stored draft.
- Uninterpretable numeric values use exact lexical identity only. Different unsafe
  or invalid spellings are never assumed equivalent. Unchanged invalid text can be
  clean without being valid. Dirty and validity are independent.
- Ordered collections compare effective row contents in sequence. Unordered
  collections compare multisets, preserving duplicate multiplicity. Their array
  permutations alone do not dirty the document, but imperative moves are rejected
  for unordered collections. A caller can restore effective contents through
  remove/add operations with new UI keys.
- UI row keys and capabilities are not data equality inputs. Application identities
  that matter semantically must be included as field values. Equal row contents
  can exchange keys without dirtying data. Fields' comparison semantics and a
  collection's orderedness must agree for equality.

`exactNumericEqual(left, right, NumericSemantics): boolean | undefined` is reusable
by future validation work. `undefined` means syntax or work bounds prevent safe
interpretation, never success/validity. INTEGER accepts an optional sign and decimal
digits only. DECIMAL accepts an optional sign, integer digits, optional fractional
part with at least one digit, and an optional signed exponent only when enabled.
Examples: `+001` equals `1`; `12.3400` equals `1234e-2` with exponents enabled.
`.5`, `1.`, whitespace, infinity, NaN and incomplete exponents are unsupported.

The helper bounds each lexical input to 4,096 UTF-16 units and exponent text to six
characters with absolute exponent at most 4,096. It compares normalized coefficient
text and a bounded BigInt exponent without expanding powers or passing field values
through JavaScript Number/floating point. These are conservative work bounds, not
precision, scale, range or validity constraints. The unordered multiset comparison
is quadratic in row count; this increment makes no large-document performance
claim. There is no temporal/timezone normalization or calendar validation.

## FORM/GRID integration and future consumers

Existing components and events remain unchanged. A parent can wrap a
`FormFieldChange` or `DetailGridChange` cell value into a value slot:

```ts
state = applyDocumentChange(state, {
  kind: 'field', path: intent.path,
  input: { kind: 'value', value: intent.value },
});
```

Adapt remove/move using `collectionPath`, `key` and `before`. Adapt add only after
preparing a complete row. The current FORM/GRID scalar channel retains incomplete
numeric strings as values; it does not acquire an implicit raw/presence channel.
Callers using the explicit raw operation supply `{kind:'raw',text}` themselves.
Legacy renderer projection of absence/raw requires an explicit application mapping;
the core never substitutes null. Identity/path matching at an application event
boundary remains the parent's responsibility; core operations enforce actual tree
paths and capabilities rather than trusting a renderer's enabled state.

The installed-APF testbed `/default-theme/?scenario=state` uses one parent signal
holding `DocumentState`, one header and two independently editable detail collections
inside the public `FormComposition`. It projects scalar slots into renderer contexts
and adapts FORM/GRID events without modifying their contracts. State stays outside
visual components and survives five packaged themes and a structural grid frame.

Future VALID work can consume the same field inputs and typed paths, reuse bounded
numeric equality and attach validation results separately. No `valid:true` default
is present. Save/reconciliation must explicitly establish an authoritative accepted
tree, map keys and address revisions; none of those transitions exists here. Reset
alone does not satisfy STATE-004 confirmation requirements.

`tests/state.test.mjs` covers immutable snapshots, exact equality, nested edits,
multiple collections, multiset permutations, key stability, permissions, rejection,
revision safety and reset. `tests/browser/specs/state.spec.mjs` covers the installed
public components at desktop/mobile sizes, dirty invalid-looking numeric drafts,
reordering both collections, semantic reversion, add/remove and theme switching.
Only tested parts of STATE-001/STATE-002 are claimed; STATE-003–STATE-006 and all
semantic document-validation acceptance remain pending.
