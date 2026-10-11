# C# etcd Aspire Demo Design

## Goal

Add a self-contained C# project folder to this etcd checkout that demonstrates a three-member etcd cluster, Aspire resource orchestration, key-value commands, and persistence of etcd watch events to MongoDB.

The demo records watch events from when its watcher first starts. It does not import keys that existed before that point.

## Components

- **Aspire AppHost** starts three etcd containers and MongoDB, and runs the C# watcher service.
- **Watcher service** is a .NET hosted service. It connects to all etcd client endpoints and watches the entire keyspace (empty prefix), with previous key/value data enabled.
- **MongoDB** stores an event document for each etcd put, update, or delete. Documents include event type, key, current value when present, previous value when present, etcd revision, and event time.
- **Aspire Dashboard commands** provide Put and Get actions with key/value inputs. They use the C# etcd client against the cluster and show the operation result in the dashboard.

The etcd containers form one cluster with explicit initial-cluster membership. Aspire maps distinct client ports to the host so the watcher and dashboard commands can reach all members. Peer traffic stays on the cluster's internal network.

## Event delivery and recovery

The watcher stores a revision cursor in MongoDB and resumes from the last fully stored revision after a restart. It inserts event documents before advancing the cursor, and uses a stable event identity so replaying the last revision does not create duplicate records. For deletes, the watcher records the previous value supplied by etcd. Transaction events retain their shared etcd revision and are stored individually.

The watcher does not promise recovery past etcd history compaction. If it remains offline until etcd compacts revisions it has not consumed, those events are unavailable from etcd's watch history.

## User flow

1. Start the AppHost with `dotnet run` from the new project folder.
2. Aspire starts the three etcd members, MongoDB, and watcher, then opens the dashboard.
3. Invoke the Put command with a key and value, then invoke Get with that key.
4. Confirm the returned value and inspect MongoDB to see the corresponding watch event documents.

## Scope and constraints

- Keep all new project files under `csharp-etcd-aspire/`.
- Use the maintained `dotnet-etcd` package for etcd v3 gRPC operations and the MongoDB .NET driver for event storage.
- Target the current stable .NET LTS SDK available for the project; use the matching Aspire AppHost SDK and packages.
- Keep the existing etcd Go project and `.dev` observability setup unchanged.
- No authentication or TLS is configured; this is a local development demo.

## Verification

- Build the new Aspire solution.
- Start it and confirm all three etcd members and MongoDB become healthy.
- Use the Aspire Dashboard Put and Get commands and confirm the value round-trips.
- Confirm MongoDB receives the corresponding create/update/delete events and preserves the etcd revision.
- Restart the watcher and verify it resumes without duplicate event documents.
