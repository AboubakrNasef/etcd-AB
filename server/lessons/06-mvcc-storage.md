# Lesson 06: MVCC Storage — A Detailed Walkthrough

## What you will learn

This lesson explains how the server stores keys as versions instead of as one
mutable map. You will follow the data model, revisions, key indexing, bbolt
records, reads, writes, transactions, watches, compaction, hashing, recovery,
and tests.

The package is under [storage/mvcc/](../storage/mvcc/).

## 1. Why etcd needs MVCC

A normal map answers only “what is the current value of foo?”. etcd must also
answer what a value was at a revision, which keys changed in a transaction,
which events a watch should receive, whether history was compacted, and whether
two members have the same logical state.

MVCC means Multi-Version Concurrency Control. Each mutation creates a new
version associated with a logical revision. The current value is the newest
visible version.

## 2. The three layers inside MVCC

~~~mermaid
flowchart TD
    API[ReadView and WriteView interfaces]
    STORE[store / kvstore]
    INDEX[In-memory key index]
    BACKEND[bbolt backend]
    EVENTS[watchable store and watchers]
    API --> STORE
    STORE --> INDEX
    STORE --> BACKEND
    STORE --> EVENTS
~~~

The API layer in [kv.go](../storage/mvcc/kv.go) describes reads, writes,
transactions, compaction, and revision behavior. The index selects visible
revisions. The backend stores encoded values durably. The event layer turns
applied changes into watch responses.

## 3. The core store object

Read [kvstore.go](../storage/mvcc/kvstore.go) first.

The store combines read/write views, compaction configuration, locks, backend,
key index, revision bookkeeping, lease integration, and hash/corruption
support. When reading a method, classify it as a read, individual write,
multi-operation transaction, restore, or background compaction operation.

### Constructor steps

1. Assign the backend.
2. Create the key index.
3. Restore current revision metadata.
4. Attach lease and configuration dependencies.
5. Rebuild or load persisted key information.
6. Return a store ready for reads and writes.

The constructor turns durable state into an in-memory MVCC object. It does not
load every value into a giant map; the index is rebuilt and values are fetched
from bbolt when needed.

Useful test: [store_test.go](../storage/mvcc/store_test.go).

## 4. Revisions

Read [revision.go](../storage/mvcc/revision.go).

A revision has two numbers:

~~~text
Revision {
    Main: logical revision of one atomic operation
    Sub:  position of one change inside that operation
}
~~~

### Main revision

The main revision advances when a write transaction changes state. A transaction
that changes several keys normally gives all changes one Main revision. This
tells clients the changes belong to one atomic operation.

### Sub revision

The sub-revision distinguishes changes inside one Main revision:

~~~text
Transaction at Main=8:
    foo -> Revision(8, 0)
    bar -> Revision(8, 1)
    baz -> Revision(8, 2)
~~~

The exact convention should be verified in the code and tests. The purpose is
stable: versions sharing Main are one atomic group but remain individually
ordered.

### Revision methods

Methods such as GreaterThan and comparison helpers provide the ordering rule
used by the index, compaction, and backend keys. Do not compare only Main:
changes can share Main and differ in Sub.

Useful tests: [kv_test.go](../storage/mvcc/kv_test.go) and
[key_index_test.go](../storage/mvcc/key_index_test.go).

## 5. KeyValue records

Read [kv.go](../storage/mvcc/kv.go).

An internal key-value record contains client value bytes plus metadata:

- create revision;
- modification revision;
- version count;
- lease association;
- key and value bytes.

This lets responses report when a key was created, when it changed, and how many
versions it has had. Conversion helpers translate internal records into
protobuf KeyValue messages. Separate serialization format, client response
format, and revision metadata in your notes.

Useful test: [kv_test.go](../storage/mvcc/kv_test.go).

## 6. Per-key history and generations

Read [key_index.go](../storage/mvcc/key_index.go).

A keyIndex stores one user key’s revision history. A generation begins when a key
is created and ends when it is tombstoned.

~~~text
put foo at (1,0)
put foo at (2,0)
delete foo at (3,0)
put foo at (4,0)

generation 1: (1,0), (2,0), tombstone (3,0)
generation 2: (4,0)
~~~

A deleted key and recreated key are different lifetimes. Generation boundaries
preserve that distinction.

Important methods:

- Put appends a revision to the current generation.
- Tombstone appends a deletion marker and starts the next generation.
- Get selects the newest version visible at or before a requested revision.
- Compact removes obsolete history while preserving the boundary version.
- Keep identifies revisions the backend must retain.

The difficult part is not appending. It is choosing the correct historical
version and retaining exactly what compaction still needs.

Useful tests:
[key_index_test.go](../storage/mvcc/key_index_test.go) and
[index_test.go](../storage/mvcc/index_test.go).

## 7. The tree index

Read [index.go](../storage/mvcc/index.go).

The tree index maps user keys to keyIndex objects:

~~~mermaid
flowchart LR
    KEY[User key] --> TREE[treeIndex]
    TREE --> KI[keyIndex for key]
    KI --> REV[Visible revision]
    REV --> DB[Backend record]
~~~

The index interface includes Get, Range, Revisions, CountRevisions, Put,
Tombstone, Compact, Keep, and Equal.

### Point lookup

Get first finds the keyIndex, then chooses the latest version whose revision is
not newer than atRev. If atRev is zero, current store revision is used.

### Range lookup

Range traverses keys in lexicographic order and asks each keyIndex for its
visible version at the requested revision. Limit and total-count options affect
the response, not state.

This is why range reads require both key ordering and revision filtering.

Useful tests:
[index_test.go](../storage/mvcc/index_test.go) and
[index_bench_test.go](../storage/mvcc/index_bench_test.go).

## 8. Read transactions

Read [kvstore_txn.go](../storage/mvcc/kvstore_txn.go).

A read transaction captures a revision and normally:

1. obtains current store revision;
2. chooses an explicit requested revision if supplied;
3. rejects unavailable or compacted history;
4. queries the in-memory index;
5. fetches selected values from backend;
6. assembles RangeResult and KeyValue objects.

This transaction is a consistency boundary: it must not observe half of one
write and half of another.

### FastKeysOnly

The FastKeysOnly path can answer requests needing keys and metadata without
reading every value from bbolt. When studying it, identify which response
fields come from index metadata and which require backend payloads.

Also inspect range end, limit, sort order, count-only, and requested revision.

Useful tests:
[kvstore_test.go](../storage/mvcc/kvstore_test.go),
[kv_test.go](../storage/mvcc/kv_test.go), and
[txn_test.go](../etcdserver/txn/txn_test.go).

## 9. Put, step by step

A Put reaches MVCC only after Raft apply. The MVCC portion is:

~~~mermaid
sequenceDiagram
    participant A as Apply
    participant S as MVCC store
    participant I as treeIndex
    participant B as Backend
    participant W as Watch layer
    A->>S: Put key/value
    S->>S: Begin write transaction
    S->>I: Find existing key/version
    I-->>S: Previous revision or not found
    S->>S: Advance main revision
    S->>I: Append revision
    S->>B: Write encoded KeyValue
    S->>W: Record change
    S-->>A: Result and revision
~~~

Steps:

1. Open or use a write transaction.
2. Find whether the key exists.
3. Derive new revision and metadata.
4. Append a revision reference to keyIndex.
5. Encode and write the value to backend.
6. Record the change for watches.
7. End the transaction and assemble response.

An existing key gets a new modification revision and version count. A new key
gets its creation revision. PrevKv reads the previous value from the same
logical view as the write.

Useful tests:
[kvstore_test.go](../storage/mvcc/kvstore_test.go) and
[put.go](../etcdserver/txn/put.go).

## 10. DeleteRange and tombstones

DeleteRange is documented in [kv.go](../storage/mvcc/kv.go). A nil end targets
one key; a non-nil end targets the half-open range [key, end).

Steps:

1. Find matching visible keys.
2. If none exist, avoid a meaningless state revision.
3. Advance main revision when actual deletion occurs.
4. Append a tombstone for every deleted key.
5. Write deletion metadata and event information.
6. End the transaction and report count/revision.

The tombstone records that a generation ended. A later Put starts a new
generation instead of continuing the deleted key’s version lifetime.

Useful tests:
[kvstore_test.go](../storage/mvcc/kvstore_test.go),
[key_index_test.go](../storage/mvcc/key_index_test.go), and
[watcher_test.go](../storage/mvcc/watcher_test.go).

## 11. Write transactions

Read [kvstore_txn.go](../storage/mvcc/kvstore_txn.go) and
[watchable_store_txn.go](../storage/mvcc/watchable_store_txn.go).

~~~text
Write() -> Put/Delete operations -> Changes() -> End()
~~~

A write transaction groups changes under one Main revision. At End it assigns
sub-revisions, persists backend records, generates events, releases locks, and
notifies watchers. The watchable wrapper waits until End so a watcher cannot
observe only half a transaction.

Useful tests:
[kvstore_test.go](../storage/mvcc/kvstore_test.go),
[store_test.go](../storage/mvcc/store_test.go), and
[watchable_store_test.go](../storage/mvcc/watchable_store_test.go).

## 12. Watches

Read [watchable_store.go](../storage/mvcc/watchable_store.go),
[watcher.go](../storage/mvcc/watcher.go), and
[watcher_group.go](../storage/mvcc/watcher_group.go).

~~~mermaid
flowchart TD
    CHANGE[Applied MVCC change] --> GROUP[Match key ranges]
    GROUP --> SYNC[Synced watchers]
    GROUP --> UNSYNC[Unsynced watchers]
    SYNC --> RESP[WatchResponse]
    UNSYNC --> CATCHUP[Read historical events]
    CATCHUP --> RESP
    RESP --> RPC[v3 watch stream]
~~~

A watcher specifies a key/range and starting revision. A synced watcher receives
new matching changes. An unsynced watcher first catches up from backend history.
Slow delivery may be delayed or placed into a victim path so the apply path is
not blocked forever. Cancellation must remove the watcher and release resources.

Useful tests:
[watcher_test.go](../storage/mvcc/watcher_test.go),
[watchable_store_test.go](../storage/mvcc/watchable_store_test.go), and
[watch_test.go](../etcdserver/api/v3rpc/watch_test.go).

## 13. Compaction

Read [kvstore_compaction.go](../storage/mvcc/kvstore_compaction.go).

Compaction does not delete everything older than a number. It retains the version
needed at the boundary, removes obsolete backend records, updates metadata, and
preserves future read consistency.

Steps:

1. Validate requested revision.
2. Record or schedule compaction.
3. Compact index and find removable revisions.
4. Scan backend keys in batches.
5. Delete only unneeded records.
6. Persist completed metadata.
7. Notify or unblock callers.

Batching and sleep intervals avoid holding long backend locks on large databases.

Useful tests:
[kvstore_compaction_test.go](../storage/mvcc/kvstore_compaction_test.go),
[store_test.go](../storage/mvcc/store_test.go), and
[compactor_test.go](../etcdserver/api/v3compactor/compactor_test.go).

## 14. Hashing

Read [hash.go](../storage/mvcc/hash.go).

Hashing walks persisted key space and hashes normalized logical content so members
can compare state. It is about MVCC content at a revision, not raw database-file
bytes.

Useful tests:
[hash_test.go](../storage/mvcc/hash_test.go) and
[hash utility](../storage/mvcc/testutil/hash.go).

## 15. Restore and startup

During startup, the store reconstructs current revision and key index from
backend records. Restore may load keys in chunks and use a temporary cache while
rebuilding the tree. This explains why kvstore.go contains restore logic as well
as normal reads and writes.

~~~mermaid
flowchart LR
    DB[Persisted backend records] --> INDEX[Rebuild key index]
    DB --> REV[Restore current and compact revisions]
    INDEX --> STORE[Usable MVCC store]
    REV --> STORE
    STORE --> APPLY[Apply remaining committed entries]
~~~

Useful tests:
[kvstore_compaction_test.go](../storage/mvcc/kvstore_compaction_test.go) and
[bootstrap_test.go](../etcdserver/bootstrap_test.go).

## 16. How MVCC connects to the server

~~~mermaid
flowchart TD
    RPC[KV RPC] --> APPLY[Raft apply layer]
    APPLY --> TXN[MVCC transaction]
    TXN --> IDX[Index revision lookup]
    TXN --> BOLT[bbolt backend]
    TXN --> EVENTS[Watchable store]
    EVENTS --> STREAM[Watch RPC]
    BOLT --> SNAP[Snapshot and recovery]
~~~

RPC decides what the client asked for. Raft decides when a mutation is
authoritative. Apply chooses the MVCC operation. MVCC owns revisions, versions,
events, and logical visibility. Backend makes records durable.

## 17. Recommended source order

1. [revision.go](../storage/mvcc/revision.go)
2. [kv.go](../storage/mvcc/kv.go)
3. [key_index.go](../storage/mvcc/key_index.go)
4. [index.go](../storage/mvcc/index.go)
5. [kvstore.go](../storage/mvcc/kvstore.go)
6. [kvstore_txn.go](../storage/mvcc/kvstore_txn.go)
7. [watchable_store.go](../storage/mvcc/watchable_store.go)
8. [watchable_store_txn.go](../storage/mvcc/watchable_store_txn.go)
9. [watcher.go](../storage/mvcc/watcher.go)
10. [kvstore_compaction.go](../storage/mvcc/kvstore_compaction.go)
11. [hash.go](../storage/mvcc/hash.go)

After each implementation file, read its matching test before opening the next.

## Final exercises

1. Put foo twice, delete it, then Put it again. Draw both generations.
2. Explain an old-revision range read versus current read.
3. Explain one Main revision with multiple Sub revisions.
4. Follow an old watch until it becomes synced.
5. Explain which version compaction must retain.
6. Explain why crash-safe MVCC requires backend and Raft recovery.
7. Find exact function names for Put, Range, DeleteRange, transaction End, watch
   dispatch, and compaction.

If you can answer these, MVCC is a versioned state machine with an index,
durable records, and event delivery around one revision model.
