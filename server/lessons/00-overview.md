# Lesson 00: Overview and Mental Model

## Goal

Build a map before opening the largest files. Learn the difference between an
API request, a Raft entry, an applied operation, an MVCC revision, and durable
storage.

## One-sentence architecture

The server exposes a versioned gRPC API, uses Raft to agree on the order of
cluster-wide changes, applies committed changes to MVCC, and persists both
consensus history and logical state.

## Main write path

~~~text
RPC -> validation/auth -> proposal -> Raft commitment -> WAL persistence
    -> apply -> MVCC/backend/lease/auth side effects -> watch/response
~~~

The central rule is that an RPC handler does not directly perform a
cluster-wide mutation. It proposes an operation; the apply path performs it
after commitment.

## Vocabulary

- Proposal: an operation submitted toward Raft.
- Commitment: agreement that places an entry in the authoritative log.
- Apply: execution of a committed entry by the local state machine.
- Revision: a logical version of MVCC state.
- WAL: durable Raft metadata and entries.
- Backend: durable materialized database state.
- Snapshot: compact state from which recovery can continue.

## Package map

etcdmain starts the command. embed constructs the instance. etcdserver
orchestrates lifecycle. apply executes committed operations. storage/mvcc
represents versioned state. storage/wal, storage/backend, and storage/snap
provide durability. membership and rafthttp operate the cluster. auth and
lease provide security and time-based ownership.

## Checkpoint

Explain why proposal accepted is not the same as write completed. Mention both
commitment and application.
