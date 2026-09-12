# Lesson 07: WAL, Snapshots, and Backend

## Goal

Understand restart safety and how etcd limits recovery work.

## Important files

- [wal/wal.go](../storage/wal/wal.go)
- [wal/](../storage/wal/)
- [backend/backend.go](../storage/backend/backend.go)
- [schema/](../storage/schema/)
- [snap/](../storage/snap/)
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

What is the difference between a logical database snapshot and an arbitrary
copy of the backend file?

Raft-specific WAL and snapshot flow is expanded in [Lesson 13](./13-raft-in-this-project.md).
