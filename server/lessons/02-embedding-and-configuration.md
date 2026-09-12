# Lesson 02: Embedding and Configuration

## Goal

Learn how configuration becomes listeners, services, data paths, TLS behavior,
and lifecycle coordination.

## Important files

- [embed/config.go](../embed/config.go)
- [embed/etcd.go](../embed/etcd.go)
- [embed/serve.go](../embed/serve.go)
- [config/config.go](../config/config.go)
- [storage/datadir/datadir.go](../storage/datadir/datadir.go)

## Configuration flow

Read embed/config.go in this order: defaults; URL and address parsing; TLS and
discovery; data-directory and cluster-state settings; validation; derived
values.

Configuration determines client URLs, peer URLs, metrics, TLS, timing, request
limits, initial-cluster behavior, and data locations. Bad derived values can
fail startup before Raft begins, so startup debugging starts here.

## Construction flow

embed/etcd.go composes the instance. Follow listener creation, storage opening,
core-server bootstrap, API installation, and background loops. Services must
not advertise readiness before state is safe to serve.

## Endpoint separation

embed/serve.go connects HTTP and gRPC handlers to listeners. Keep client
traffic and peer traffic separate: clients make requests; peers exchange Raft
and snapshot communication.

## Exercise

Pick a data directory and one client URL. Trace each value from its config field
to the code that consumes it. Identify one immediate and one startup-time
validation.

## Checkpoint

Why is embedding a lifecycle responsibility rather than merely a constructor?
