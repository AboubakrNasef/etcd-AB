# MVCC walkthrough: following one key through its history

This follow-up to [Lesson 06: MVCC Storage](06-mvcc-storage.md) traces one
key, `foo`, through repeated writes, reads at different revisions, deletion,
and recreation.

## The short answer: how can one key have two values?

MVCC does not replace a key's old value when the key is updated. Each put
stores a new version with a new revision. The key index tracks the revisions
for that key and selects the right one for a read.

For example, `foo` can have both of these stored versions:

```text
(1, 0) → "red"
(2, 0) → "blue"
```

They are two versions of the same key at different points in history. A
current read returns `"blue"`; a read at revision 1 returns `"red"`.

## Follow `foo` step by step

Assume each operation below changes the store. A revision is written as
`(Main, Sub)`: Main identifies the store revision, and Sub orders changes
within one atomic transaction.

### Step 1: Put `foo = "red"`

This is the first creation of `foo`, at revision `(1, 0)`. Its metadata is
conceptually:

```text
Key:             foo
Value:           red
CreateRevision:  1
ModRevision:     1
Version:         1
```

The in-memory index records the version's revision. The backend stores the
key-value record, including its value and metadata:

```text
foo
└── (1, 0) → "red"
```

### Step 2: Put `foo = "blue"`

The key already exists, so the store creates another version, at `(2, 0)`. It
does not change the old backend record in place. The new record's metadata is
conceptually:

```text
Key:             foo
Value:           blue
CreateRevision:  1
ModRevision:     2
Version:         2
```

`CreateRevision` remains 1 because this is still the same lifetime of `foo`.
`ModRevision` advances to 2, and `Version` counts this as its second put in
that lifetime.

The key's history now contains both records:

```text
foo
├── (1, 0) → "red"
└── (2, 0) → "blue"
```

The index uses the revisions to choose which record a read should fetch from
the backend. The two values coexist in storage; a read's revision determines
which one is visible.

### Step 3: Read `foo` at the current revision

A normal read uses the current store revision. The index selects the newest
version whose revision is at or before that point. At revision 2, it selects
`(2, 0)`, so the result is:

```text
foo = "blue"
```

### Step 4: Read `foo` at revision 1

A historical read asks for the newest version at or before revision 1. The
index selects `(1, 0)`, so the result is:

```text
foo = "red"
```

The same key therefore returns different values at different revisions:

| Read point | Selected version | Result |
| --- | --- | --- |
| Current, revision 2 | `(2, 0)` | `"blue"` |
| Revision 1 | `(1, 0)` | `"red"` |

### Step 5: Delete `foo`

Suppose a delete happens at `(3, 0)`. The store records a tombstone, which is a
deletion marker. It ends the current generation of `foo`:

```text
Generation 1:
  (1, 0) → "red"
  (2, 0) → "blue"
  (3, 0) → deleted (tombstone)
```

A current read at revision 3 treats `foo` as absent. A read at revision 2 can
still return `"blue"`, as long as revision 2 has not been compacted.

### Step 6: Recreate `foo = "green"`

Suppose a later put creates `foo` again at `(4, 0)`. This begins a new
generation, or lifetime, of the key:

```text
Generation 1: (1, 0) → "red"; (2, 0) → "blue"; (3, 0) → deleted
Generation 2: (4, 0) → "green"
```

The new generation has `CreateRevision: 4`, `ModRevision: 4`, and `Version: 1`.
The current read returns `"green"`; a read at revision 2 returns `"blue"` if
that history is still available.

## What is stored, and what is returned?

There are two useful parts to keep separate:

1. **Backend records** hold encoded key-value versions, identified by their
   revisions. This is where the version payloads live durably.
2. **The in-memory key index** tracks a key's revisions and selects the
   version visible at the requested read revision. The selected revision tells
   the store which backend record to fetch.

A current read does not combine values or return every version. It returns one
visible version for each key. To see an older value, request an older revision
that remains available.

Compaction removes history that is no longer needed for supported reads. Once
revision 1 has been compacted, for example, a read at revision 1 can no longer
return `"red"`.

## One atomic transaction can change several keys

The Main and Sub parts of a revision answer a related question. If one atomic
transaction changes three keys, they can share a Main revision and have
different Sub values:

```text
foo → (8, 0)
bar → (8, 1)
baz → (8, 2)
```

Main 8 groups the changes into one transaction. Sub orders the changes inside
that revision. For repeated writes to one key in one transaction, check the
transaction implementation and tests for the exact behavior; the simple
`foo` history above assumes each put is a separate revision.

## Trace summary

```text
Put foo="red"    → (1, 0) stores red
Put foo="blue"   → (2, 0) stores blue; red remains historical
Read current     → blue
Read at revision 1 → red, if revision 1 is not compacted
Delete foo       → (3, 0) tombstone ends generation 1
Put foo="green"  → (4, 0) begins generation 2
```

The mental model: each write adds a revision-stamped version; the index chooses
the newest version visible at the read revision; the backend supplies that
version's stored value.

To follow these steps in the code, start with
[key_index.go](../storage/mvcc/key_index.go) and
[index.go](../storage/mvcc/index.go), then trace writes and reads in
[kvstore.go](../storage/mvcc/kvstore.go) and
[kvstore_txn.go](../storage/mvcc/kvstore_txn.go). The source walkthrough is
also in [Lesson 06](06-mvcc-storage.md).
