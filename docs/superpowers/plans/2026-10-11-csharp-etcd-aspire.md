# C# etcd Aspire Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a runnable C# Aspire demo with a three-member etcd cluster, MongoDB-backed watch history, and dashboard Put/Get commands.

**Architecture:** An Aspire AppHost starts three etcd containers, MongoDB, and one .NET 10 watcher project. Aspire Dashboard commands use `dotnet-etcd` to Put/Get through the cluster; the watcher observes the whole keyspace and stores events and a replay cursor in MongoDB.

**Tech Stack:** .NET 10, Aspire 13.6.1, `dotnet-etcd` 9.1.0, Aspire MongoDB hosting integration 13.6.1, MongoDB.Driver 3.12.0, xUnit 2.9.3.

**Spec:** `docs/superpowers/specs/2026-10-11-csharp-etcd-aspire-design.md`

## Global Constraints

- Keep all new project files under `csharp-etcd-aspire/`.
- Use .NET 10 and matching Aspire 13.6.1 packages.
- Run three etcd members with explicit initial-cluster membership and distinct host client ports.
- Watch from the app's first start; do not import pre-existing keys.
- Save put, update, and delete event documents with etcd revision and previous value where present.
- Resume from MongoDB's last fully stored revision and make replay idempotent.
- History lost to etcd compaction while the watcher is offline cannot be recovered.
- Keep the existing Go etcd project and `.dev` observability files unchanged.
- Configure this as a local demo without authentication or TLS.

## Review Focus

- Empty values must stay distinguishable from missing values; verify with an empty Put/Get and Mongo document in Task 5, Step 3.
- Deletes must retain the previous value and have no current value; verify in Task 5, Step 4.
- Events from one transaction can share a revision; pin stable distinct IDs in `EventIdentityTests.EventsAtSameRevisionHaveDistinctStableIds`.
- A Mongo outage must not advance the resume cursor before event persistence; verify recovery in Task 5, Step 5.
- A compacted resume revision must be reported and must not silently reset history; verify in Task 5, Step 6.

---

### Task 1: Scaffold Aspire app and three-member etcd cluster

**Files:**
- Create: `csharp-etcd-aspire/CSharpEtcdAspire.slnx`
- Create: `csharp-etcd-aspire/AppHost/CSharpEtcdAspire.AppHost.csproj`
- Create: `csharp-etcd-aspire/AppHost/Program.cs`
- Create: `csharp-etcd-aspire/Watcher/CSharpEtcdAspire.Watcher.csproj`
- Create: `csharp-etcd-aspire/Watcher/Program.cs`

**Interfaces:**
- Produces Aspire resources named `etcd1`, `etcd2`, `etcd3`, `mongo`, and `watcher`.
- Exposes etcd client endpoints on host ports `23791`, `23792`, and `23793`; peer URLs remain container-internal on `2380`.
- Adds an HTTP `/health` probe for each etcd client endpoint so Aspire can report member readiness.
- Passes `ETCD_ENDPOINTS=http://localhost:23791,http://localhost:23792,http://localhost:23793` to the watcher.
- Uses `etcd1=http://etcd1:2380,etcd2=http://etcd2:2380,etcd3=http://etcd3:2380` for initial membership.
- Adds Mongo database `etcd-watch` and passes its connection string to `watcher` via Aspire resource references.

- [ ] **Step 1: Create the solution and project files targeting `net10.0`**

Use Aspire AppHost SDK `13.6.1` and the `Aspire.Hosting.MongoDB` package at `13.6.1`. Add the watcher project to the solution, reference it from AppHost, and add `dotnet-etcd` 9.1.0 to AppHost for dashboard operations.

- [ ] **Step 2: Add the three etcd container resources**

Configure stable member names, initial cluster state, internal peer URLs, client listeners, `/health` checks, data volumes, and the three host port mappings. Do not point any member at the existing checkout's `default.etcd` data.

- [ ] **Step 3: Add MongoDB and watcher references with readiness dependencies**

Use Aspire MongoDB hosting and make the watcher wait for MongoDB and all three etcd resources before starting. Pass the Mongo connection and `ETCD_ENDPOINTS` into the watcher.

- [ ] **Step 4: Build the AppHost**

Run: `dotnet build csharp-etcd-aspire/CSharpEtcdAspire.slnx`
Expected: PASS with all project references and Aspire resource APIs resolving.

### Task 2: Add Mongo event model and idempotent store

**Files:**
- Create: `csharp-etcd-aspire/Watcher/EtcdEventDocument.cs`
- Create: `csharp-etcd-aspire/Watcher/MongoEventStore.cs`
- Create: `csharp-etcd-aspire/Watcher.Tests/CSharpEtcdAspire.Watcher.Tests.csproj`
- Create: `csharp-etcd-aspire/Watcher.Tests/EventIdentityTests.cs`
- Modify: `csharp-etcd-aspire/CSharpEtcdAspire.slnx`

**Interfaces:**
- `EtcdEventDocument`: `Id`, `Revision`, `EventType`, `Key`, nullable `Value`, nullable `PreviousValue`, and `OccurredAtUtc`.
- `EtcdEventDocument.CreateId(long revision, int ordinalWithinRevision) -> string` returns a stable ID for replay and a distinct ID for each event sharing a revision.
- `MongoEventStore`: `SaveEventsAsync(IReadOnlyList<EtcdEventDocument>, long lastRevision, CancellationToken)` and `GetLastRevisionAsync(CancellationToken)`.
- Cursor collection uses `_id = "etcd-watch"`; event documents use deterministic IDs built from revision and ordinal within the revision.

- [ ] **Step 1: Create a `net10.0` test project referencing the watcher project**

Use `Microsoft.NET.Test.Sdk` 18.10.1, `xunit` 2.9.3, and `xunit.runner.visualstudio` 3.1.5; add the test project to the solution.

- [ ] **Step 2: Add a failing test for event identity**

Assert distinct stable IDs for same-revision events and stable IDs on replay.

- [ ] **Step 3: Run the targeted tests and confirm failure**

Run: `dotnet test csharp-etcd-aspire/Watcher.Tests/CSharpEtcdAspire.Watcher.Tests.csproj`
Expected: FAIL because the deterministic event identity is not implemented.

- [ ] **Step 4: Implement the event document and deterministic identity**

Use revision and ordinal in that revision so transaction events remain distinct and a replay computes the same Mongo `_id`.

- [ ] **Step 5: Implement `MongoEventStore`**

Add MongoDB.Driver 3.12.0 to the watcher. Upsert event documents by `_id`; update the cursor only after all event writes complete. Keep event and cursor collections in the `etcd-watch` database.

- [ ] **Step 6: Run the targeted tests**

Run: `dotnet test csharp-etcd-aspire/Watcher.Tests/CSharpEtcdAspire.Watcher.Tests.csproj`
Expected: PASS for stable and distinct event IDs.

### Task 3: Implement the all-keyspace watcher and restart recovery

**Files:**
- Create: `csharp-etcd-aspire/Watcher/EtcdWatchWorker.cs`
- Modify: `csharp-etcd-aspire/Watcher/Program.cs`
- Modify: `csharp-etcd-aspire/Watcher/CSharpEtcdAspire.Watcher.csproj`
- Create: `csharp-etcd-aspire/Watcher.Tests/WatchWorkerTests.cs`

**Interfaces:**
- `EtcdWatchWorker : BackgroundService` receives the etcd endpoint list and `MongoEventStore` through dependency injection.
- Start a watch on the empty prefix with previous key/value enabled; use the saved revision on reconnect and start at the current point when no cursor exists.
- Convert every event in each watch response to an `EtcdEventDocument`, preserving response order within a revision.

- [ ] **Step 1: Add a failing test for compacted revision handling**

Assert the worker reports a compacted revision clearly and does not reset the cursor or pretend history is complete.

- [ ] **Step 2: Run the targeted test and confirm failure**

Run: `dotnet test csharp-etcd-aspire/Watcher.Tests/CSharpEtcdAspire.Watcher.Tests.csproj --filter CompactedRevisionIsReported`
Expected: FAIL because watch recovery is not implemented.

- [ ] **Step 3: Implement the watch loop**

Add `dotnet-etcd` 9.1.0 to the watcher. Watch the entire keyspace, persist each response before storing its revision cursor, and retry transient connection failures with cancellation-aware delay. Do not retry compaction as a transient error.

- [ ] **Step 4: Run the unit test suite and build**

Run: `dotnet test csharp-etcd-aspire/Watcher.Tests/CSharpEtcdAspire.Watcher.Tests.csproj`
Expected: PASS.

Run: `dotnet build csharp-etcd-aspire/CSharpEtcdAspire.slnx`
Expected: PASS.

### Task 4: Add Aspire Dashboard Put/Get commands and usage guide

**Files:**
- Modify: `csharp-etcd-aspire/AppHost/CSharpEtcdAspire.AppHost.csproj`
- Modify: `csharp-etcd-aspire/AppHost/Program.cs`
- Create: `csharp-etcd-aspire/README.md`

**Interfaces:**
- Register dashboard commands named `put` and `get` on the `watcher` resource.
- `put` accepts `key` and `value`; `get` accepts `key` and returns the value or a clear not-found message.
- Commands target the three host endpoints and use the same client settings as the watcher.

- [ ] **Step 1: Register the Put/Get dashboard command inputs and callbacks**

Use Aspire `WithCommand` with required string inputs. Each callback connects to the cluster, runs one operation, disposes its client, and returns the result in the dashboard.

- [ ] **Step 2: Write the README**

Document prerequisites, `dotnet run`, resource names, client ports, how to invoke Put/Get in Aspire Dashboard, and how to inspect the Mongo event collection and cursor.

- [ ] **Step 3: Build and run unit tests**

Run: `dotnet build csharp-etcd-aspire/CSharpEtcdAspire.slnx`
Expected: PASS.

Run: `dotnet test csharp-etcd-aspire/Watcher.Tests/CSharpEtcdAspire.Watcher.Tests.csproj`
Expected: PASS.

### Task 5: Verify the full local flow

**Files:**
- No new files; only fix issues found in Tasks 1–4.

- [ ] **Step 1: Start the Aspire AppHost**

Run: `dotnet run --project csharp-etcd-aspire/AppHost/CSharpEtcdAspire.AppHost.csproj`
Expected: Aspire Dashboard shows all three etcd members, MongoDB, and watcher as running/healthy.

- [ ] **Step 2: Exercise dashboard Put and Get**

Put `demo/name=etcd-from-csharp`; Get `demo/name`.
Expected: Get returns `etcd-from-csharp`.

- [ ] **Step 3: Inspect MongoDB history**

Query the `etcd-watch.events` collection for `demo/name`. Also Put/Get `demo/empty` with an empty string and query that event.
Expected: one put event for `demo/name`; the empty value round-trips and is stored as `""`, not null.

- [ ] **Step 4: Verify update, delete, and restart replay**

Put a second value, delete the key with `etcdctl` against one member, and inspect the collection.
Expected: update and delete events are recorded; delete includes the previous value and has no current value.

- [ ] **Step 5: Verify restart and MongoDB outage recovery**

Restart only the watcher and confirm event counts do not change. Stop MongoDB, issue a Put while the watcher is unable to save, restart MongoDB, and confirm the event appears once and the cursor advances afterward.

- [ ] **Step 6: Verify compaction is reported**

Stop the watcher, generate a key change, compact that revision with `etcdctl`, then restart the watcher.
Expected: the watcher reports the compacted revision and does not reset the cursor silently.

- [ ] **Step 7: Stop the AppHost and report the verified commands and results**

Stop the launched process after verification and include any environmental limitation if the local container runtime prevents startup.
