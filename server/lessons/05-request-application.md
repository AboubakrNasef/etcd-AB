# Lesson 05: Committed Request Application

## Goal

Learn how a committed Raft entry becomes deterministic changes to server state.

## Important files

- [apply/interface.go](../etcdserver/apply/interface.go)
- [apply/apply.go](../etcdserver/apply/apply.go)
- [apply/backend.go](../etcdserver/apply/backend.go)
- [apply/txn.go](../etcdserver/apply/txn.go)
- [apply/capped.go](../etcdserver/apply/capped.go)
- [apply/auth.go](../etcdserver/apply/auth.go)

## The applier boundary

interface.go is an architectural map. Its dependencies include MVCC KV,
alarm store, auth store, lessor, cluster, Raft status, snapshot support, and
consistent-index support. These are the state machines a committed operation may
affect.

## Application sequence

~~~text
committed entry -> decode -> identify operation
                 -> apply deterministic side effects
                 -> persist/update indexes -> response/events
~~~

The applier processes operations in Raft order. It must not invent a second
ordering from goroutine scheduling or arrival time.

## Backend and transactions

apply/backend.go handles durable state beyond a simple KV mutation: membership,
auth, alarms, and related metadata. Transaction code groups comparisons and
operations so one committed request has one coherent result.

## Quotas

The capped applier guards the backend capacity boundary. Study it to see how
limits are enforced without duplicating quota policy in every RPC.

## Checkpoint

Compare a simple Put with a transaction. Identify what is common in application
and what is special about comparisons and multiple operations.
