# Guide 3a: bbolt usage in etcd

This guide explains what bbolt is, what etcd stores in it, and how it fits beside Raft and the WAL.

## What bbolt is

[bbolt](https://github.com/etcd-io/bbolt) is an embedded, disk-backed key/value database implemented as a B+ tree. It runs inside the etcd process and stores data in the member's backend database file (usually `member/snap/db`). It is not a separate server and clients do not connect to it directly.

etcd uses bbolt as the storage engine for its backend. The backend organizes data into buckets, including:

- `key`: MVCC key-value records, indexed by key and revision so etcd can serve current and historical reads;
- `meta`: revision, compaction, and consistent-index metadata;
- `lease`: lease records;
- `alarm`, `cluster`, `members`, `members_removed`, `auth`, `authUsers`, and `authRoles`: corresponding server state.

Bucket definitions live in [server/storage/schema/bucket.go](../server/storage/schema/bucket.go). The bbolt-backed backend is opened and managed in [server/storage/backend/backend.go](../server/storage/backend/backend.go).

## How a write reaches bbolt

```text
client request -> Raft proposal -> quorum commit -> WAL persistence
               -> apply committed operation -> MVCC transaction -> bbolt backend
```

Raft establishes the replicated order and commitment of writes. The WAL records Raft entries for recovery. Once a committed entry is applied, etcd updates MVCC state in the local bbolt backend. Each cluster member has its own backend; Raft replication keeps the members' applied state aligned.

Reads query the local MVCC/backend state. Serializable reads can use that local state directly. Linearizable reads first wait for confirmation that the member has applied through a safe Raft read index.

## How etcd uses bbolt transactions

The MVCC layer groups changes from an applied operation in a backend write transaction. This keeps the operation's key changes and metadata updates atomic. The backend batches and commits these transactions, while read transactions provide a consistent view as writes continue.

### Why a key has multiple revisions

When a key is updated, etcd stores its new value at a new MVCC revision. Older versions can remain in the `key` bucket so historical reads and watches can use them. The current value is the newest non-deleted version; deleting a key writes a tombstone at a new revision, rather than immediately erasing all earlier records.

MVCC compaction sets a revision boundary and removes historical versions that are no longer needed at or before that boundary. It preserves the latest live value for each key, even if that value's revision is older than the compaction boundary. A deletion is represented by a tombstone revision so etcd can distinguish a deleted key from one that never existed. After compaction, reads at compacted revisions are rejected, and watchers cannot resume from that history.

Compaction removes records logically but does not necessarily shrink `member/snap/db`. Defragmentation rewrites the database to reclaim file space left by deleted or compacted records. The storage layer also uses bbolt during startup and maintenance: it opens or recovers the backend, reads consistency metadata, and defragments the database when requested.

## Keep these storage roles separate

| Component | What it stores or decides |
|---|---|
| Raft | The agreed order and commitment of operations across members |
| WAL | Durable Raft log entries and hard state used during recovery |
| Raft snapshot | A compact Raft recovery point that limits log replay |
| bbolt backend | The locally applied MVCC data and server metadata |
| MVCC revision | The logical version number exposed by etcd's key-value API |

A bbolt file is not a substitute for a Raft snapshot or WAL. It contains applied state, while the WAL and snapshot let etcd establish which committed operations justify that state after a restart. See [Guide 3: Raft, storage, and recovery](03-raft-and-storage.md) for the full persistence and recovery path.

## Read the implementation

1. Start with [server/storage/backend/backend.go](../server/storage/backend/backend.go) to see how bbolt is opened and wrapped by etcd's backend interface.
2. Read [server/storage/mvcc/kvstore.go](../server/storage/mvcc/kvstore.go) and [server/storage/mvcc/kvstore_txn.go](../server/storage/mvcc/kvstore_txn.go) to follow MVCC reads and writes.
3. Inspect [server/storage/schema/bucket.go](../server/storage/schema/bucket.go) for the bucket names and their purpose.
4. Return to [server/storage/storage.go](../server/storage/storage.go) and [server/etcdserver/bootstrap.go](../server/etcdserver/bootstrap.go) to connect the backend with snapshots, WAL replay, and startup recovery.

## Checkpoint

Explain why etcd needs both Raft/WAL and bbolt, which layer serves a key lookup, and why deleting or compacting old MVCC revisions does not guarantee that the backend file becomes smaller.
