# Lesson 2 — Nodes, terms, roles, and quorum

Estimated time: 10 minutes

| Concept | Meaning |
|---|---|
| Node ID | Permanent cluster identity. |
| Term | Logical election number. |
| Vote | Member selected in the current term. |
| Commit index | Highest entry known committed. |
| Applied index | Highest entry executed by the state machine. |
| Role | Follower, candidate, pre-candidate, or leader. |

```mermaid
stateDiagram-v2
    [*] --> Follower
    Follower --> PreCandidate: timeout + PreVote
    Follower --> Candidate: timeout
    PreCandidate --> Candidate: pre-vote quorum
    Candidate --> Leader: vote quorum
    Candidate --> Follower: valid leader / higher term
    Leader --> Follower: higher term
```

Terms reject stale messages and prevent an old leader from continuing after a
new election. For `N` voters:

```text
quorum = floor(N / 2) + 1
```

A three-member cluster needs two votes and tolerates one failure. A live node
without a majority cannot safely elect itself.

## Recap

Term and vote must survive restart, so they are part of Raft `HardState`.

## Five-node diagram

```mermaid
flowchart TD
    T[term 7] --> A[A follower]
    T --> B[B follower]
    T --> C[C leader]
    T --> D[D follower]
    T --> E[E follower]
    A --- Q[quorum: 3 of 5]
    B --- Q
    C --- Q
```
