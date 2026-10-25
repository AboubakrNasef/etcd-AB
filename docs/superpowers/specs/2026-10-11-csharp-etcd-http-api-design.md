# C# etcd HTTP API design

## Goal

Turn `CSharpEtcdAspire.Watcher` into an ASP.NET Core service that keeps its MongoDB-backed etcd watch worker and also exposes the documented etcd v3 HTTP/JSON gateway through Swagger UI. The API should forward requests to etcd so operations such as KV reads and writes, transactions, compaction, leases, membership, auth, locks, and elections do not need duplicate C# endpoint implementations.

## Scope

- Keep the existing etcd watch worker and MongoDB event persistence running in the same process.
- Enable etcd's built-in gRPC gateway on each cluster member.
- Add an HTTP reverse proxy in the watcher service that forwards the etcd v3 gateway paths, query string, request body, and relevant headers to the cluster.
- Preserve streamed gateway responses so watch operations can return as etcd streams.
- Serve Swagger UI with the etcd v3 API specification, adjusted so its requests target the C# proxy.
- Register the API endpoint with Aspire and update the project README with the API/Swagger URL and examples.

The supported surface is the set of gateway services registered by etcd: KV, Watch, Lease, Cluster, Maintenance, Auth, Lock, and Election. This does not promise access to gRPC-only methods outside that gateway.

## Design

The watcher project will use the ASP.NET Core shared framework and host both the HTTP API and the existing `EtcdWatchWorker` through one web host. The existing Mongo event store and deterministic watch cursor behavior remain unchanged.

Each etcd member will start its built-in HTTP gateway on its client listener. The watcher API will select a configured gateway endpoint and proxy the original HTTP request to it. The proxy must stream request and response bodies to support long-lived watch responses and must pass through etcd's status code and response headers. It will not interpret protobuf JSON payloads or map every operation into bespoke Minimal API handlers.

The repository's etcd v3 Swagger specifications will be served by the watcher service: `rpc.swagger.json`, `v3lock.swagger.json`, and `v3election.swagger.json`. Swagger UI will list all three documents and route their requests through the C# proxy. Keep the checked-in specs as the source of truth and document the upstream source version; update them to match the etcd image when either version changes.

Aspire runs the watcher as a host project process, so it will configure the service to reach the etcd gateway through the members' published `localhost` client ports. Host-side etcd endpoints remain available for `etcdctl` and existing dashboard commands.

## Error handling and limits

- Forward gateway errors and status codes without rewriting etcd's JSON error body.
- Return a clear service error if no gateway endpoint is configured or all configured endpoints fail.
- Do not buffer long-running watch responses in memory.
- The sample remains a local learning app with no authentication added at the C# API boundary. Do not expose it beyond a trusted local environment without adding authentication and authorization.
- Swagger represents the HTTP gateway contract. Streaming watch responses may have limited interactive Swagger UI support.

## Verification

Review the changed project/configuration files for consistent routes and container-network addresses. Build the AppHost and watcher projects if package restore is available. Runtime verification should confirm Swagger loads, a Put/Get round trip works through the proxy, a transaction and compaction request reach etcd, and a watch response streams while events continue to be recorded in MongoDB. Do not change upstream etcd source code.

## Files expected to change

- `csharp-etcd-aspire/Watcher/CSharpEtcdAspire.Watcher.csproj`
- `csharp-etcd-aspire/Watcher/Program.cs`
- New watcher API proxy source file(s)
- `csharp-etcd-aspire/AppHost/Program.cs`
- `csharp-etcd-aspire/README.md`
- Local copies of etcd's three v3 Swagger specifications
