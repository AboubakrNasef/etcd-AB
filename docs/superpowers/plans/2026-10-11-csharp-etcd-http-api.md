# C# etcd HTTP API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose etcd's documented v3 HTTP gateway through the existing Aspire watcher service with Swagger UI, while retaining MongoDB watch history.

**Architecture:** Enable etcd's built-in gateway on each member. Host the existing worker in an ASP.NET Core app and proxy HTTP requests to configured gateway endpoints with streamed responses. Serve the upstream RPC, Lock, and Election Swagger documents through Swagger UI.

**Tech Stack:** .NET 10 ASP.NET Core, Aspire 13.6.1, etcd v3.7.1 HTTP gateway, Swashbuckle.AspNetCore.SwaggerUI 10.3.0, existing dotnet-etcd and MongoDB.Driver packages.

**Spec:** `docs/superpowers/specs/2026-10-11-csharp-etcd-http-api-design.md`

## Global Constraints

- Keep the existing watch worker and Mongo event persistence in the same process.
- Cover gateway services KV, Watch, Lease, Cluster, Maintenance, Auth, Lock, and Election.
- Forward status codes and etcd JSON error bodies; stream watch responses without buffering.
- Do not modify upstream etcd source code.
- The local demo API has no authentication; keep it for trusted local use.
- Do not launch the app or run tests/builds as part of implementation.

## Review Focus

- HTTP methods, query strings, Authorization, and JSON bodies must reach etcd unchanged; inspect proxy header/body handling.
- Hop-by-hop and Host headers must not be copied; inspect request and response header filters.
- Long-running watch responses must stream and stop when the caller disconnects; inspect cancellation and copy behavior.
- Failed gateway connections must produce an intelligible service error without retrying a possibly completed write; inspect endpoint selection and failure handling.
- Swagger's three documents must route requests through the C# proxy; inspect each document's server/base-path behavior.

---

### Task 1: Vendor the upstream Swagger documents

**Files:**
- Create: `csharp-etcd-aspire/Watcher/Swagger/rpc.swagger.json`
- Create: `csharp-etcd-aspire/Watcher/Swagger/v3lock.swagger.json`
- Create: `csharp-etcd-aspire/Watcher/Swagger/v3election.swagger.json`
- Modify: `csharp-etcd-aspire/README.md`

**Interfaces:**
- Produces: static Swagger 2.0 documents copied from `Documentation/dev-guide/apispec/swagger/` in this checkout; record that the source is etcd `3.8.0-alpha.0` while the Aspire image is `v3.7.1`.

- [ ] Copy the three upstream JSON specs without changing their operation schemas, adding `/etcd` as Swagger 2.0 `basePath`; document their source version and current image-version difference.
- [ ] Record their source paths and update instructions in the README.

### Task 2: Serve the watcher as an ASP.NET Core API

**Files:**
- Modify: `csharp-etcd-aspire/Watcher/CSharpEtcdAspire.Watcher.csproj`
- Modify: `csharp-etcd-aspire/Watcher/Program.cs`
- Modify: `csharp-etcd-aspire/Watcher/EtcdWatchWorker.cs` only if its configuration key needs adjustment.

**Interfaces:**
- Consumes: the existing `MongoEventStore` and `EtcdWatchWorker` registrations.
- Produces: a `WebApplication` hosting the existing worker, service defaults, Swagger UI at `/swagger`, and Minimal API spec endpoints at `/openapi/etcd/{document}`.

- [ ] Switch the project to the ASP.NET Core Web SDK and add the Swagger UI package compatible with net10.0.
- [ ] Configure `WebApplication.CreateBuilder(args)`, retain MongoDB and watcher registrations, and call `AddServiceDefaults`.
- [ ] Map Minimal API GET routes for the three Swagger JSON files and configure Swagger UI with `rpc`, `lock`, and `election` documents, each targeting `/etcd`.
- [ ] Map the service default health endpoints and run the web application.

### Task 3: Proxy etcd gateway requests

**Files:**
- Create: `csharp-etcd-aspire/Watcher/EtcdGatewayProxy.cs`
- Modify: `csharp-etcd-aspire/Watcher/Program.cs`

**Interfaces:**
- Consumes: `ETCD_GATEWAY_ENDPOINTS`, a comma-separated list of HTTP gateway base URLs.
- Produces: `MapEtcdGatewayProxy(IEndpointRouteBuilder endpoints)`, mapping `/etcd/{**path}` to the etcd gateway.

- [ ] Add `HttpClient` registration and endpoint parsing/validation for `ETCD_GATEWAY_ENDPOINTS`.
- [ ] Map the proxy route for the HTTP methods supported by etcd's gateway and preserve path, query string, request body, and end-to-end headers while excluding hop-by-hop and Host headers.
- [ ] Select a configured member per request; do not retry a request after sending it.
- [ ] Send using `HttpCompletionOption.ResponseHeadersRead`, copy response status and end-to-end headers, and stream the body with request cancellation.
- [ ] Return a clear 502 response when the selected gateway cannot be reached.

### Task 4: Enable and wire the etcd gateway in Aspire

**Files:**
- Modify: `csharp-etcd-aspire/AppHost/Program.cs`

**Interfaces:**
- Consumes: the three etcd member resources and watcher API resource.
- Produces: gateway-enabled members and watcher environment configuration using container DNS names.

- [ ] Add `--enable-grpc-gateway=true` to each etcd member's arguments.
- [ ] Configure the watcher with `ETCD_GATEWAY_ENDPOINTS` pointing at `http://localhost:23791,http://localhost:23792,http://localhost:23793`; Aspire runs the project as a host process.
- [ ] Add a named HTTP endpoint to the watcher project so Aspire exposes its API and Swagger UI.
- [ ] Keep existing MongoDB reference, watch-worker endpoint configuration, and etcdctl host port mappings intact.

### Task 5: Document use

**Files:**
- Modify: `csharp-etcd-aspire/README.md`

**Interfaces:**
- Documents: watcher Swagger URL, API proxy path, covered service specs, and example operations.

- [ ] Document the Aspire dashboard resource URL for Swagger and give examples for Put, Get, transaction, compaction, and starting a watch through `/etcd/v3/...`.
- [ ] State that the service is unauthenticated and intended for local use, and explain the Swagger specs track etcd v3.7.1.

## Implementation boundary

Make code and documentation changes only. Do not start Aspire, etcd, MongoDB, or run tests/builds in this implementation pass.
