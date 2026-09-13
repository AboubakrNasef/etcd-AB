# Raft in etcd — 10-minute lessons

Follow these lessons in order. Each takes about ten minutes and includes a
goal, a small diagram, a code connection, and a recap.

1. [Why etcd needs Raft](raft-in-etcd/01-why-etcd-needs-raft.md)
2. [Nodes, terms, roles, and quorum](raft-in-etcd/02-nodes-terms-roles-quorum.md)
3. [How elections begin](raft-in-etcd/03-how-elections-begin.md)
4. [Pre-vote and voting](raft-in-etcd/04-prevote-and-voting.md)
5. [How etcd runs Raft](raft-in-etcd/05-how-etcd-runs-raft.md)
6. [Messages and rafthttp](raft-in-etcd/06-messages-and-rafthttp.md)
7. [WAL and recovery](raft-in-etcd/07-wal-and-recovery.md)
8. [Proposals and replication](raft-in-etcd/08-proposals-and-replication.md)
9. [Commit and apply](raft-in-etcd/09-commit-and-apply.md)
10. [Heartbeats, snapshots, and membership](raft-in-etcd/10-heartbeats-snapshots-membership.md)
11. [Putting everything together](raft-in-etcd/11-putting-everything-together.md)

The main etcd integration files are [`bootstrap.go`](../server/etcdserver/bootstrap.go),
[`raft.go`](../server/etcdserver/raft.go), [`server.go`](../server/etcdserver/server.go),
and [`rafthttp/peer.go`](../server/etcdserver/api/rafthttp/peer.go). The core
algorithm is in the `go.etcd.io/raft/v3` module.

The central model is:

```text
client command -> Raft proposal -> replicated log -> quorum commit
               -> etcd state-machine apply -> client response
```
