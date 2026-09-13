# Lesson 6 — Messages and rafthttp

Estimated time: 10 minutes

```mermaid
sequenceDiagram
    participant R1 as member 1 Raft
    participant T1 as member 1 rafthttp
    participant T2 as member 2 rafthttp
    participant R2 as member 2 Raft
    R1->>T1: Ready.Messages
    T1->>T2: HTTP peer transport
    T2->>R2: Process(ctx, message)
    R2->>R2: Node.Step(ctx, message)
```

Important messages include:

| Message | Purpose |
|---|---|
| `MsgVote` / response | Election. |
| `MsgPreVote` / response | Pre-election. |
| `MsgApp` / response | Log replication. |
| `MsgHeartbeat` / response | Liveness and commit notification. |
| `MsgSnap` | Snapshot installation. |

`EtcdServer.Process` validates sender, receiver, and removed-member status,
then calls `s.r.Step(ctx, m)`. Read
[`server.go`](../../../server/etcdserver/server.go) and
[`rafthttp/peer.go`](../../../server/etcdserver/api/rafthttp/peer.go).

The HTTP layer carries protobuf messages; it does not decide elections.

## Recap

Debug message flow in order: transport delivery, `Process` validation, then
Raft's message handler.
## Five-node diagram

```mermaid
flowchart TD
    C[C leader] --> A[A peer]
    C --> B[B peer]
    C --> D[D peer]
    C --> E[E peer]
    A --> P[Process then Step]
    B --> P
    D --> P
    E --> P
    P --> R[Ready response]
```
