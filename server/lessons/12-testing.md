# Lesson 12: Testing and Study Exercises

## Goal

Use tests as executable documentation and build a repeatable learning method.

## Focused Windows commands

~~~powershell
Set-Location server
go test ./storage/mvcc/...
go test ./lease/...
go test ./etcdserver/...
go build .
~~~

If the checkout has Windows-specific generated or symlink issues, fix the
checkout first; do not infer server behavior from a compiler failure in an
unrelated example file.

## Test-reading order

1. Read the public interface.
2. Find the simplest successful test.
3. Find an invalid-input test.
4. Find a restart, cancellation, or concurrency test.
5. Read mocks after understanding the real dependency.

## Exercises

- Trace a serializable read and contrast it with a linearizable read.
- Find how transaction comparisons choose a branch.
- List restart artifacts from backend, WAL, snapshot, and membership.
- Follow watch cancellation into watcher cleanup.
- Trace member changes through every validation boundary.

## Completion standard

You understand the server when you can follow a Put, read, watch, lease expiry,
and membership change while naming the boundaries between API, Raft, apply, MVCC,
and persistence.

## Direct test links by topic

- Startup: [embed/config_test.go](../embed/config_test.go) and
  [embed/etcd_test.go](../embed/etcd_test.go)
- Raft/lifecycle: [etcdserver/raft_test.go](../etcdserver/raft_test.go) and
  [etcdserver/server_test.go](../etcdserver/server_test.go)
- Apply/transactions: [apply/auth_test.go](../etcdserver/apply/auth_test.go)
  and [txn/txn_test.go](../etcdserver/txn/txn_test.go)
- MVCC: [kvstore_test.go](../storage/mvcc/kvstore_test.go),
  [watcher_test.go](../storage/mvcc/watcher_test.go), and
  [kvstore_compaction_test.go](../storage/mvcc/kvstore_compaction_test.go)
- Durability: [backend_test.go](../storage/backend/backend_test.go) and
  [snapshotter_test.go](../etcdserver/api/snap/snapshotter_test.go)
- Membership/peers: [membership_test.go](../etcdserver/api/membership/membership_test.go)
  and [functional_test.go](../etcdserver/api/rafthttp/functional_test.go)

## File-by-file guide

### MVCC tests

Tests beside storage/mvcc describe revisions, ranges, deletes, compaction,
watches, and concurrency. Start with success, then read the edge case that
changes one input or revision boundary.

### Lease and auth tests

These show how time, permissions, users, roles, and attached keys interact with
the server. Use them to distinguish local bookkeeping from committed changes.

### etcdserver tests

These cover lifecycle, proposal waiting, bootstrap, membership, snapshots, and
collaborator integration. Setup helpers reveal the minimum composition needed
to reproduce behavior.

### Mocks and test doubles

Mocks isolate one invariant by replacing Raft, storage, or waiters. Use them
after understanding the real interface; they do not prove production sequencing
or durability guarantees.
