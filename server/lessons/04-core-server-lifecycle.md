# Lesson 04: Core Server Lifecycle

## Goal

Understand the orchestration hub that turns Raft events into applied state and
coordinates readiness, snapshots, membership, and shutdown.

## Important files

- [etcdserver/server.go](../etcdserver/server.go)
- [etcdserver/raft.go](../etcdserver/raft.go)
- [etcdserver/wait.go](../etcdserver/wait.go)
- [etcdserver/snapshot.go](../etcdserver/snapshot.go)
- [etcdserver/v3_server.go](../etcdserver/v3_server.go)

## How to read server.go

First identify the server object and collaborators, startup and shutdown, the
Raft event loop, proposal submission, committed-entry application, and
snapshot/membership hooks. Then follow one event through those areas.

## Proposal and commitment

An API method can create a proposal, but it becomes authoritative only when
Raft commits it. The lifecycle loop receives committed entries in order and
passes them to the applier. wait.go connects the original proposal with its
result or error.

## v3_server.go

This is a facade over the core lifecycle. It exposes KV, transactions, watches,
leases, auth, alarms, and downgrade behavior to the RPC layer. Read it as an
adapter and policy boundary, not as the storage engine.

## Shutdown

Listeners stop accepting work, background loops are signaled, Raft and storage
close safely, and waiters are released rather than left blocked. Follow context
cancellation and channel closure closely.

## Exercise

Find one successful proposal path and one rejected path. List where each can
fail: validation, authorization, Raft, apply, storage, or shutdown.

## Checkpoint

Which component knows that an operation is committed, and which knows how to
apply its meaning?

For the complete Raft explanation, continue with [Lesson 13](./13-raft-in-this-project.md).
