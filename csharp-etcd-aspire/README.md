# C# etcd + Aspire + MongoDB demo

This local demo starts a three-member etcd cluster, MongoDB, and a background watcher through Aspire. The watcher starts observing the whole keyspace when the app starts and stores put/update/delete changes in MongoDB.

MongoDB runs without authentication for this local demo. Its database files are stored in `data/mongo/` under this project and persist across runs. Aspire connection strings no longer use placeholder credentials.

Each etcd member exports OpenTelemetry traces to the Aspire Dashboard OTLP/gRPC receiver. An OpenTelemetry Collector scrapes each member's Prometheus `/metrics` endpoint and forwards the metrics to the dashboard. The dashboard receiver is configured for unauthenticated OTLP on port `4317` so containers can reach it through `host.docker.internal`. This is for local learning only: port `4317` listens on all host interfaces and accepts unauthenticated telemetry.

etcd's container output is available under each resource's **Console Logs** in the dashboard. These are separate from OTLP **Structured Logs**. etcd's Raft peer traffic on port `2380` is not shown as spans; check the member console logs for peer connection messages or the scraped `etcd_network_peer_sent_bytes_total` and `etcd_network_peer_received_bytes_total` metrics.

## Requirements

- .NET 10 SDK
- Docker Desktop or another Docker-compatible container runtime
- Aspire workload/CLI (the AppHost starts with `dotnet run`)

## Run

From this directory:

```powershell
dotnet run --project AppHost/CSharpEtcdAspire.AppHost.csproj
```

Open the Aspire Dashboard URL printed in the terminal. The dashboard contains `etcd1`, `etcd2`, `etcd3`, `mongo`, and `watcher` resources. Select `watcher` and use its **Put key/value** and **Get key** commands.

The Put command accepts a key and value; leave value blank to store an empty string. For example, put `demo/name` = `etcd-from-csharp`, then get `demo/name`. The same commands can be run with Aspire CLI:

```powershell
aspire resource watcher put --key demo/name --value etcd-from-csharp
aspire resource watcher get --key demo/name
```

## Connect with etcdctl

The three client endpoints are available on the host at ports `23791`, `23792`, and `23793`:

```powershell
etcdctl --endpoints=http://localhost:23791 put demo/name etcd-from-etcdctl
etcdctl --endpoints=http://localhost:23792 get demo/name
```

## etcd traces

Open **Traces** in the Aspire Dashboard and filter for service `etcd`. The three members use service instance IDs `etcd1`, `etcd2`, and `etcd3`. The demo samples all etcd spans to make the request flow easy to see; this adds tracing overhead and is intended for local learning.

## Watch history in MongoDB

The watcher stores events in `etcd-watch.events` and its resume cursor in `etcd-watch.watch-cursors`. Events include the key, event type, current value, previous value, and etcd revision. Event documents are upserted by deterministic IDs before the cursor advances, so replay after a restart does not duplicate them.

When the watcher first starts, it begins at the current etcd revision and does not import existing keys. If it is offline longer than etcd's compaction window, etcd may have discarded the missing history; the watcher logs the compacted revision and stops instead of silently resetting the cursor.

To stop the demo, stop the AppHost process with Ctrl+C. etcd keeps data in named volumes, and MongoDB keeps data in `data/mongo/`. Switching MongoDB from its previous named volume does not copy that volume's data; the old volume remains untouched.
