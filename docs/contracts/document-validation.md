# Document validation aggregation (AUR-VALID-AGG-001)

This increment publishes `validateDocument`, one framework-independent function
that validates a complete `DocumentObject` against a separately supplied declarative
validation plan. It reuses `validateField` for every semantic field and reuses the
existing immutable `DocumentState` tree. It does not read `DocumentState.original`,
mutate the supplied document/state or store validity on STATE.

The implementation is the first document-validation increment only. It does not
implement persistence, submission, reconciliation, server confirmation, navigation
protection or a validation cache/subscription.

## Public API

```ts
export type ValidationFieldDefinition = FieldValidationRequest['definition'];

export interface FieldValidationPlan {
    readonly kind: 'field';
    readonly definition: ValidationFieldDefinition;
}
export interface ObjectValidationPlan {
    readonly kind: 'object';
    readonly properties: Readonly<Record<string, ValidationPlanNode>>;
}
export interface CollectionValidationPlan {
    readonly kind: 'collection';
    readonly row: ObjectValidationPlan;
}
export type ValidationPlanNode =
    | FieldValidationPlan
    | ObjectValidationPlan
    | CollectionValidationPlan;

export interface DocumentValidationRequest {
    readonly document: DocumentObject;
    readonly plan: ObjectValidationPlan;
}

export type DocumentValidationState =
    | 'valid' | 'pending' | 'invalid' | 'definition-error';

export interface DocumentFieldValidation {
    readonly path: ValuePath;
    readonly result: FieldValidationResult;
}

export interface DocumentValidationResult {
    readonly state: DocumentValidationState;
    readonly fields: readonly DocumentFieldValidation[];
    readonly issues: readonly ValidationIssue[];
    readonly diagnostics: readonly DocumentDiagnostic[];
    readonly patternDiagnostics: readonly PatternDiagnostic[];
    readonly checks: readonly DeferredCheck[];
}
```

Callers normally validate the current immutable snapshot:

```ts
const result = validateDocument({ document: state.current, plan });
```

`DocumentValidationRequest` is purpose-built; the existing `FieldValidationRequest`
is unchanged apart from the reused semantic definition union. No Angular component,
renderer, tab layout, theme or application metadata is required.

## Declarative validation plan

The plan mirrors the relevant document shape:

- A **field plan** supplies the existing field definition union. The document field
  owns the editing input and comparison semantics; the plan owns semantic validation.
- An **object plan** supplies named child plan nodes. Its property map is the
  structural counterpart of the document object's property map.
- A **collection plan** supplies one reusable object plan for all rows. The same row
  schema object may be shared by several collections or rows when their definitions
  are identical.

The plan is not a general schema language, metadata dictionary, plugin engine or
second STATE model. Semantic definitions stay out of `DocumentField`. Hostile or
ambiguous plan values are rejected at runtime with structured diagnostics.

The complete plan is inspected before any document value is evaluated. Object and
collection plans are walked with ancestor identity, so cycles, malformed nested row
schemas and the 128-edge limit are detected even when a collection has no rows.
Field-plan definitions are resolved with the same definition-resolution logic used
by `validateField`, so invalid capacities, temporal constraints, portable patterns
and other semantic declarations fail even without a field instance. Shared acyclic
row/object plans remain valid. This pass never calls `validateField`, reads document
values or invents placeholder inputs.

**Known limitation:** heterogeneous row definitions are not supported in this
increment. Every row of one collection must satisfy the same row-object plan.
Individual row-specific schemas are not guessed or encoded.

## Deterministic traversal

Traversal follows the document shape:

1. Root object.
2. Nested object properties.
3. Field nodes.
4. Collection nodes.
5. Row object values in document row order.
6. Nested objects and collections inside rows.

Object property names are visited in lexicographic UTF-16 order using the union of
document and plan property names. That makes reported field order deterministic and
independent of property insertion order. Collection rows retain the document's
current row order, so reordering changes presentation/traversal order while paths
keep the same stable keys.

Every applicable field is visited, including fields outside a selected tab, inside
collapsed sections, inside nonvisible collections, and read-only/disabled fields.
Visual placement and permissions are not validation filters. Empty objects and empty
collections produce no fictitious field results.

Before semantic evaluation, every visited document node is checked against the STATE
structural contract: supported `kind`, capability flags, field equality/input
metadata, object property maps, collection flags/rows and nonempty unique row keys
with object values. Raw edit drafts remain admissible. Malformed nodes yield
`invalid-document`; the check mirrors STATE without reusing `createDocumentState`
and never changes STATE semantics.

The traversal never reads or modifies `DocumentState.original`. Revalidation is
explicit: callers invoke `validateDocument` again with the current snapshot. No
mutable cache or STATE subscription is created.

## Typed paths and row identity

Paths reuse `ValuePath`:

```ts
[
    { kind: 'property', name: 'customer' },
    { kind: 'property', name: 'code' },
]
[
    { kind: 'property', name: 'lines' },
    { kind: 'row', key: 'stable-line-key' },
    { kind: 'property', name: 'quantity' },
]
```

Collection rows are always identified by their stable key, never by array index.
Paths survive unrelated insertion, deletion and reordering while the referenced row
still exists. Typed paths are not serialized into ambiguous dotted strings, and no
field value, pattern source or private metadata is interpolated into human-readable
diagnostics.

## Result precedence and aggregation

The aggregate precedence is:

```text
definition-error > invalid > pending > valid
```

- `definition-error` means at least one fatal structural problem or one fatal field
  definition diagnostic exists.
- `invalid` means no fatal definition result exists and at least one field is invalid.
- `pending` means every field is locally valid or pending and at least one deferred
  server check remains.
- `valid` means every applicable field is locally valid and no deferred check remains.
  An empty document with an empty matching plan is valid.

Sibling evidence is never discarded. The result always exposes:

- `fields`: every visited field result with its detached typed path, in traversal
  order.
- `issues`: all local issues flattened in field/traversal/issue order.
- `diagnostics`: all fatal definition diagnostics, including structural diagnostics
  and each field's existing `definition-error` diagnostics.
- `patternDiagnostics`: nonfatal pattern execution diagnostics.
- `checks`: every deferred server-pattern obligation.

For example, an invalid field, a pending field and a valid field produce an
`invalid` document while the pending field's check and diagnostic remain in the
aggregate arrays. Fatal definition errors likewise do not hide sibling issues or
checks.

## Structural and definition diagnostics

Structural diagnostics have `source: 'definition'`, a typed path and one of these
codes:

| Code | Meaning |
| --- | --- |
| `invalid-request` | The request is not exactly a document plus an object plan. |
| `invalid-document` | The supplied node/input/row violates the STATE structural admission contract. |
| `missing-definition` | A document node has no matching plan node. |
| `unknown-definition` | A plan node addresses a nonexistent document property. |
| `kind-mismatch` | Field/object/collection kinds disagree. |
| `malformed-plan` | A plan node has unknown kind, unsupported members or a bad property map. |
| `malformed-row-schema` | A collection row schema is not an object plan. |
| `plan-cycle` | Caller-owned plan objects form a cycle. |
| `depth-limit` | Document/plan nesting exceeds the STATE limit of 128 edges. |

A missing structural node is not treated as `{kind:'absent'}`. Absence remains a real
field input semantic, handled by `validateField`. Structural mismatches are fatal
definition problems, not user-facing value errors. A malformed individual semantic
definition keeps the existing `definition-error` meaning and its existing diagnostic
codes (`definition`, `capacity`, `constraint`, `constraint-limit`,
`multiple-of-definition`, `contradictory-bounds`). Sibling diagnostics are collected
where safe rather than failing at the first independent problem.

Plan cycle detection uses ancestor identity, so sharing a row schema across sibling
collections/rows is allowed while cyclic references are rejected. The independent
plan pass detects these cycles even inside empty collections. Traversal recursion is
bounded by the 128-edge limit. Structural diagnostics are emitted once per code,
path and message even when a plan node is reached from multiple rows.

A definition diagnostic discovered by plan prevalidation uses the schema path, not
a concrete row path. For example, an invalid `quantity` definition inside the
`lines` row schema is reported at `lines / quantity` without inventing a row key,
even when the collection is empty. The invalid schema field is not instantiated for
each row, so its fatal diagnostic is not repeated; sibling fields still produce their
normal results, issues and pending checks. A definition error on a non-collection
field is also reported at its normal field path and deduplicated when the field is
instantiated.

## Immutability and privacy

The aggregate envelope, field-result array, each field wrapper, aggregated issue,
diagnostic and check arrays, newly created path arrays and path segments, and all
reused `validateField` results are frozen. Paths returned by `validateDocument` are
detached from caller-owned arrays and plan objects. Caller definitions and plan
objects are neither mutated nor frozen. Input values are not duplicated beyond the
frozen parsed slots that `validateField` already returns.

## Relationship to STATE and future work

`validateDocument` derives a result from an immutable document snapshot. It does not
change `original`, `current`, `revision`, `dirty`, row identities, row order or edit
capabilities, and no aggregate validity flag is added to `DocumentState`.

Clean documents may be valid, pending or invalid; dirty documents may be valid,
pending or invalid. Restoring original values changes dirty state independently of
validity, and validation never advances revision.

The result path model is ready for future application-owned extensions: an empty path
can later represent a root error, a path ending in a row segment a row error, and a
path ending in a property segment a field error. **This increment does not implement
root/row business rules, an application issue plugin engine or transport-specific
backend error mapping.**

No submission protocol exists yet. Consequently this increment does not claim that
saving is blocked. Deferred checks remain application-owned obligations until a
future confirmation/reconciliation workflow is specified and implemented.
