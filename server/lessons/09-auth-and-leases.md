# Lesson 09: Authentication and Leases

## Goal

Understand authorization and time-based liveness as cross-cutting state machines.

## Authentication files

- [auth/store.go](../auth/store.go)
- [api/v3rpc/auth.go](../etcdserver/api/v3rpc/auth.go)
- [apply/auth.go](../etcdserver/apply/auth.go)

The auth store owns users, roles, permissions, password checks, revisions, and
token-provider integration. RPC code identifies and checks callers; apply
executes committed changes to auth state. Keep these responsibilities separate.

## Lease files

- [lease/lease.go](../lease/lease.go)
- [lease/lessor.go](../lease/lessor.go)
- [api/v3rpc/lease.go](../etcdserver/api/v3rpc/lease.go)

A lease represents time-bounded ownership. The lessor manages creation,
keep-alives, expiry, and attached keys. Expiry may be detected by a local timer,
but resulting replicated key changes must respect the ordered state model.

## Interaction with KV

Authentication determines who may read or propose. Leases determine how long
attached keys remain valid. Both appear in API validation, apply dependencies,
MVCC behavior, and tests.

## Exercise

For a lease-backed key, identify the API call, replicated operation, lessor
state, MVCC key, and event produced when the lease expires.

## Checkpoint

Which lease operations must be replicated, and which timer work can remain local?
