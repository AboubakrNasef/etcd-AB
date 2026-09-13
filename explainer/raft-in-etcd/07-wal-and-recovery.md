# Lesson 7 — WAL and recovery

Estimated time: 10 minutes

Raft's safety-critical durable state is:

```text
HardState { term, vote, commit }
log entries
snapshots and metadata
```

etcd persists it in the Ready loop:

```go
if err := r.storage.Save(rd.HardState, rd.Entries); err != nil {
    r.lg.Fatal("failed to save Raft hard state and entries", zap.Error(err))
}
```

This is in [`raft.go`](../../../server/etcdserver/raft.go), through the
storage adapter and WAL.

There is no separate “election started” text record. The election is inferred
from term, vote, log, and later messages. Timer values and current role are
runtime state.

```mermaid
flowchart TD
    A[open WAL] --> B[read snapshot and HardState]
    B --> C[restore MemoryStorage]
    C --> D[raft.RestartNode]
    D --> E[replay committed work]
    E --> F[resume ticks]
```

## Recap

`persisted`, `committed`, and `applied` describe different stages.
## Five-node diagram

```mermaid
flowchart LR
    A[A WAL] --> R[recover term, vote, commit, entries]
    B[B WAL] --> R
    C[C WAL] --> R
    D[D WAL] --> R
    E[E WAL] --> R
    R --> N[RestartNode]
    N --> Q[quorum can elect and continue]
```
