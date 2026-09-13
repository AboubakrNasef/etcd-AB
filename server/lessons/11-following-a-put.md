# Lesson 11: Following a Put Request End to End

## Goal

Combine the lessons by tracing one real mutation.

## Trace

1. Start with the KV Put protobuf definition in [api/](../../api/) and record
   request and response fields.
2. Open [api/v3rpc/key.go](../etcdserver/api/v3rpc/key.go). Mark validation,
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

## File-by-file explanation

### KV protobuf definition

The contract defines Put request and response fields. Start here to distinguish
client-visible behavior, such as previous-value handling, from implementation
details.

### api/v3rpc/key.go

This is the network entry point. It decodes, validates limits and fields,
applies auth/interceptors, and delegates instead of writing storage directly.
Mark every early return because these become observable API errors.

### etcdserver/v3_server.go

This facade turns the RPC request into an internal operation. Follow whether it
chooses a read, proposal, or coordinated path and how it converts the result.

### etcdserver/server.go and raft.go

server.go associates the request with lifecycle and a waiter. raft.go feeds the
operation into Raft, persists Ready data, receives commitment, and forwards
committed entries. Together they explain order versus execution.

### apply/apply.go

The applier decodes the committed operation and dispatches it to the correct
state-machine method. This is where Put is authoritatively allowed to change
replicated state.

### storage/mvcc/kvstore.go

MVCC assigns the logical revision, updates the key index, persists the value,
and prepares watch-visible events. Read it with backend code to separate logical
revision behavior from physical transactions.

The Raft stages in this trace are explained in detail in [Lesson 13](./13-raft-in-this-project.md).
