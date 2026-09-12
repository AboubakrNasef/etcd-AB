# Lesson 03: Bootstrap and Recovery

## Goal

Understand how a fresh node and a restarted node enter the same running-server
architecture.

## Important files

- [etcdserver/bootstrap.go](../etcdserver/bootstrap.go)
- [storage/storage.go](../storage/storage.go)
- [storage/backend.go](../storage/backend.go)
- [storage/datadir/datadir.go](../storage/datadir/datadir.go)
- [etcdserver/membership/](../etcdserver/membership/)

## Startup questions

Bootstrap must determine whether this is a new or existing member, what Raft
state and entries were recorded, and what logical database state was applied.
bootstrap.go converts those facts into the objects needed by the lifecycle.

## Conceptual sequence

~~~text
data directory -> locate WAL/snapshot -> read hard state and entries
               -> open backend -> restore membership/index
               -> create Raft storage/node -> construct server
~~~

Label each operation as recovery, initialization, or composition. This makes a
large startup function easier to understand.

## Fresh and existing clusters

A fresh cluster needs initial member IDs and cluster metadata. An existing node
must preserve identity and continue from persisted state. Cluster flags,
membership records, WAL metadata, and backend contents must agree.

## Recovery invariant

The node must not accept new work until it reconstructs correct Raft progress
and logical state. Consistent-index metadata connects durable backend
application with the Raft log.

## Exercise

Read bootstrap tests beside bootstrap.go. For each test, record which artifact
it creates or reopens: data directory, WAL, snapshot, backend, or membership.

## Checkpoint

What would be unsafe about accepting a write before recovery establishes the
last applied point?
