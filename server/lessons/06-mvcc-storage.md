# Lesson 06: MVCC Storage

## Goal

Understand the versioned logical key-value state that clients observe.

## Important files

- [kvstore.go](../storage/mvcc/kvstore.go)
- [kv.go](../storage/mvcc/kv.go)
- [index.go](../storage/mvcc/index.go)
- [watch.go](../storage/mvcc/watch.go)
- [compaction.go](../storage/mvcc/compaction.go)
- [hash.go](../storage/mvcc/hash.go)

## What MVCC provides

MVCC assigns logical revisions to changes. It supports current reads, retained
historical reads, transactions, watches, compaction, and consistency/hash
operations.

## Revision model

A revision is not a client request ID, WAL byte offset, or wall-clock time. It
identifies a version of the logical store. Apply supplies an ordered change;
MVCC records the resulting version and indexes keys so reads find the right
version.

## Index and store

The index answers which revisions belong to a key. The store coordinates the
logical operation with backend persistence and revision bookkeeping. Read
interfaces before implementations to understand guarantees.

## Watches and compaction

Watch observes applied changes. Compaction removes history older than a chosen
revision. Both depend on precise revision semantics, so study them after Put.
Hashing supports state comparisons across members.

## Exercise

Trace Put -> revision update -> backend write -> watch notification. Find the
test describing a request for compacted history.

## Checkpoint

Why should a watch event represent applied state rather than merely received
RPC input?
