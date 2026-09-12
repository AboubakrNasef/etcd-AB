# Lesson 10: API and Protocol Contracts

## Goal

Read the server from public contracts inward.

## Important files

- [api/](../../api/)
- [api/v3rpc/](../etcdserver/api/v3rpc/)
- [api/v3rpc/interceptor.go](../etcdserver/api/v3rpc/interceptor.go)
- [api/v3rpc/kv.go](../etcdserver/api/v3rpc/kv.go)
- [api/v3rpc/watch.go](../etcdserver/api/v3rpc/watch.go)
- [api/v3rpc/lease.go](../etcdserver/api/v3rpc/lease.go)
- [api/v3rpc/maintenance.go](../etcdserver/api/v3rpc/maintenance.go)

## Contract-first sequence

~~~text
protobuf -> generated binding -> RPC implementation
         -> interceptor/validation/auth -> proposal or read-index
         -> apply or MVCC query -> protobuf response
~~~

Generated files show contract shape; handwritten RPC files show policy and
control flow. Protobuf is not the storage engine.

## Streaming watches

Watch RPCs remain active across events. Study context cancellation, backpressure,
event conversion, and cleanup. Stream lifecycle matters as much as its first
response.

## Exercise

Choose one RPC and document request type, validation, authorization, read/write
behavior, response type, and cancellation behavior.

## Checkpoint

Which behavior is guaranteed by the protocol contract, and which is an
implementation detail?
