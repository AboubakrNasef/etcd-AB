# Lesson 08: Membership and Maintenance

## Goal

See how cluster topology and operational APIs preserve the same invariants as
ordinary KV operations.

## Important files

- [membership/](../etcdserver/api/membership/)
- [api/membership/](../etcdserver/api/membership/)
- [api/rafthttp/](../etcdserver/api/rafthttp/)
- [api/v3rpc/maintenance.go](../etcdserver/api/v3rpc/maintenance.go)

## Membership state

Membership tracks members, learners, IDs, URLs, cluster identity, configuration
changes, and persisted membership metadata. A member change affects the cluster
and must follow the replicated change path.

## Peer transport

rafthttp carries Raft messages and snapshots between members. It is distinct
from client-facing gRPC. When debugging, decide first whether failure is
client-to-server or member-to-member.

## Maintenance APIs

Maintenance includes status, alarms, defragmentation, hashes, and related
operations. These APIs inspect or coordinate durable state without casually
bypassing consistency rules.

## Exercise

Trace member-add from the membership RPC to apply and persisted membership.
Separately trace status and explain why it may be a read rather than a mutation.

## Checkpoint

Why must changing the member list be a cluster operation rather than a local
configuration edit?

For the relationship between membership, peer transport, and Raft, see [Lesson 13](./13-raft-in-this-project.md).

## Useful tests

- [cluster_test.go](../etcdserver/api/membership/cluster_test.go) covers
  cluster-level membership operations.
- [membership_test.go](../etcdserver/api/membership/membership_test.go) and
  [member_test.go](../etcdserver/api/membership/member_test.go) cover member
  validation and persistence.
- [functional_test.go](../etcdserver/api/rafthttp/functional_test.go) shows
  peer transport behavior.
- [snapshot_test.go](../etcdserver/api/rafthttp/snapshot_test.go) covers peer
  snapshot transfer.

## File-by-file guide

### etcdserver/api/membership/

Read the cluster object, member persistence, learner handling, and validation
helpers. These maintain the in-memory and durable description of who belongs to
the cluster. Follow member IDs and URLs into peer transport.

### api/membership/

This adapts membership requests into server operations. Trace validation,
proposal creation, response conversion, and errors for unsafe changes. It is a
client surface, not the authoritative membership store.

### api/rafthttp/

This transports Raft messages and snapshots. Follow a message from the local
Raft node to a peer endpoint and back into the remote node. Separate connection,
retry, stream, and snapshot code while reading.

### api/v3rpc/maintenance.go

This implements status, alarms, defragmentation, and hash RPCs. Classify each
method as a local read, coordinated operation, or replicated change.
