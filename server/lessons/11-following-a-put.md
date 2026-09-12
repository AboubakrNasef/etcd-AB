# Lesson 11: Following a Put Request End to End

## Goal

Combine the lessons by tracing one real mutation.

## Trace

1. Start with the KV Put protobuf definition in [api/](../../api/) and record
   request and response fields.
2. Open [api/v3rpc/kv.go](../etcdserver/api/v3rpc/kv.go). Mark validation,
   authorization, tracing, and read-only paths.
3. Follow into [v3_server.go](../etcdserver/v3_server.go) and [server.go](../etcdserver/server.go).
   Find proposal creation and request waiting.
4. Read [raft.go](../etcdserver/raft.go). Distinguish committed entries from
   merely proposed entries.
5. Follow into [apply.go](../etcdserver/apply/apply.go) and [kvstore.go](../storage/mvcc/kvstore.go).
   Record where revision and backend transaction are chosen.
6. Find watch event creation, previous-value handling, metrics, response
   construction, and tests.

## Final diagram

Draw the concrete call chain with function names from your checkout. It must
contain RPC, proposal, commitment, apply, MVCC, backend, watch, and response.

## Checkpoint

Which step guarantees healthy members see the Put in the same order? Which step
changes the logical database?

The Raft stages in this trace are explained in detail in [Lesson 13](./13-raft-in-this-project.md).
