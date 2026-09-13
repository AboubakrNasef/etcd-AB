# Lesson 07: WAL, Snapshots, and Backend

## Goal

Understand restart safety and how etcd limits recovery work.

## Important files

- [wal/wal.go](../storage/wal/wal.go)
- [wal/](../storage/wal/)
- [backend/backend.go](../storage/backend/backend.go)
- [schema/](../storage/schema/)
- [api/snap/](../etcdserver/api/snap/)
- [api/snap/](../etcdserver/api/snap/)
- [verify/verify.go](../verify/verify.go)

## Three durable roles

WAL records Raft hard state and entries, with syncing, rotation, reopening,
corruption detection, and recovery.

Backend stores materialized logical state and metadata in schema-defined buckets.
Backend transactions provide durable atomicity.

Snapshot packages usable state at a point in Raft history so a node need not
replay every old entry; snapshots can be transferred between members.

## Recovery relationship

The WAL says what Raft knew. The backend says what application materialized.
Consistent-index and snapshot metadata connect those timelines. Bootstrap uses
them together; none is a complete replacement for the others.

## Exercise

Explain why deleting old WAL entries without a suitable snapshot is unsafe.
Then explain why a snapshot cannot replace current Raft hard state.

## Checkpoint

## File-by-file guide

### storage/wal/wal.go

Read open/reopen, record reading, append, sync, rotation, and close in that
order. Note how hard state, entries, and snapshots are represented. This file
answers what consensus history survives a crash.

### storage/wal/

The package also contains record formats, protobuf types, checksums, locking,
and recovery tests. Start with public WAL operations, then encoding helpers;
tests explain incomplete records, corruption, and segment boundaries.

### storage/backend/backend.go

This is the lower-level bbolt transaction engine. Follow database opening,
read/write transactions, commit, batching, and close. Distinguish physical
backend transactions from logical MVCC revisions.

### storage/schema/

Schema files define durable buckets and record layouts. Read schema before
decoding code. Schema changes are compatibility-sensitive because old data must
remain readable.

### etcdserver/api/snap/

This package manages local snapshot files and handles. Follow creation, saving,
restoring, temporary files, and cleanup. It manages artifacts, not the whole
server lifecycle.

### etcdserver/api/snap/

This peer-facing API serves and receives snapshot data. Compare it with
storage/snap: one transports snapshots; the other manages local artifacts.

### verify/verify.go

Verification checks backend and data-directory invariants. Use it to learn which
files, buckets, and metadata must agree after recovery or maintenance.

What is the difference between a logical database snapshot and an arbitrary
copy of the backend file?

Raft-specific WAL and snapshot flow is expanded in [Lesson 13](./13-raft-in-this-project.md).
