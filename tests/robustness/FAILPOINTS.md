# Failpoint usage in robustness tests

In this test framework, a **failpoint** is any controlled fault or disruptive action run while client traffic is active. Some failpoints enable a GoFail hook inside etcd; others kill a process, change peer traffic, or change cluster membership. The common interface is in [`failpoint/failpoint.go`](failpoint/failpoint.go).

## Where failpoints fit

Each `TestScenario` in [`scenarios/scenarios.go`](scenarios/scenarios.go) contains one `Failpoint`, a cluster configuration, a traffic recipe, and a traffic profile. The regression suite uses named failpoints; the exploratory suite chooses one at random from those available for the scenario.

The runner in [`main_test.go`](main_test.go) starts the failure worker and traffic worker concurrently. The failure worker waits briefly for traffic, then calls `failpoint.Inject`. The injector:

1. Gives the injection a one-minute timeout by default (a failpoint can override it).
2. Checks that every member is healthy before the injection.
3. Runs the fault and checks health again after the fault function returns.
4. Records the failpoint name and its start/end times in a `FailpointReport`.

The traffic worker waits for that report before stopping its generators. It uses the recorded interval to report traffic statistics before, during, and after the fault. If an injection performs client operations, their reports are included in the history used by the validator. See [`report/failpoint.go`](report/failpoint.go) and [`traffic/traffic.go`](traffic/traffic.go).

## Main implementation groups

### GoFail hooks inside etcd

[`failpoint/gofail.go`](failpoint/gofail.go) configures a named GoFail hook over the member's HTTP failpoint endpoint. Panic variants set the hook to `panic`, wait for the selected etcd process to exit, and restart it against its existing data directory. If LazyFS is enabled, the harness clears its unflushed cache after the crash.

The hook name and target are defined together. Targets include any member, the leader, or a follower. Examples include:

- `RaftBeforeSavePanic` / `RaftAfterSavePanic` for Raft WAL save boundaries.
- `DefragBeforeCopyPanic` and `DefragBeforeRenamePanic` for defragmentation, with a defrag request sent to trigger the hook.
- `Compact...Panic` variants for compaction boundaries, with a compaction request used to reach the hook.
- `RaftBeforeApplySnapPanic` and related snapshot hooks, which first arrange for a follower to fall behind and receive a snapshot.

Sleep variants use GoFail's `sleep` action instead of `panic`. Most activate the hook over HTTP and deactivate it after the configured delay. `BeforeApplyOneConfChangeSleep` first kills and restarts a member with the hook configured through its environment. These variants delay a code path without intentionally restarting etcd.

GoFail hooks must be present in the etcd binary for `Available` to accept them. The local setup guide explains how failpoint-enabled binaries are built: [`LOCAL_TESTING.md`](LOCAL_TESTING.md).

### Process kill and restart

[`failpoint/kill.go`](failpoint/kill.go) selects a member, kills the process, waits for exit, clears pending LazyFS data when applicable, and restarts the member. This exercises crash recovery without requiring a code hook.

### Peer network disruption

[`failpoint/network.go`](failpoint/network.go) uses the E2E peer proxy to blackhole, delay, or probabilistically drop peer packets. These require a multi-member cluster configured with peer proxies. Blackholing blocks traffic that goes through the proxy, but it does **not** stop all Raft replication: the implementation notes that pipeline traffic can still pass.

`BlackholeUntilSnapshot` additionally polls the affected member's revision against the cluster revision. It waits until the gap exceeds `SnapshotCount + SnapshotCatchUpEntries`, aiming to make the leader send a snapshot when the network is restored. It restores both proxy directions on return. [Issue20221](ISSUE20221_WALKTHROUGH.md) uses this variant.

### Triggered operations

Some GoFail hooks need a request to reach the hooked code. [`failpoint/trigger.go`](failpoint/trigger.go) supplies triggers such as defragmenting a member or compacting a revision. A trigger may record its request as a client operation. Availability checks avoid combinations that conflict with the scenario's existing compaction workload or cannot reach the required multi-batch condition.

### Membership and version changes

[`failpoint/cluster.go`](failpoint/cluster.go) contains larger cluster transitions:

- `MemberReplace` removes a member, stops it, deletes its data directory, adds it back, and starts it with the existing cluster configuration.
- `MemberDowngrade` and `MemberDowngradeUpgrade` use current and previous etcd binaries to change cluster/member versions. Availability checks require the binaries and supported version/configuration combinations.

These are disruptive cluster operations, not server-side GoFail hooks.

## Availability and selection

Every implementation provides `Available(config, member, profile)`. The check excludes unsupported combinations, such as follower-targeted hooks in a one-member cluster, network faults without a peer proxy, hooks missing from the binary, or snapshot waits that exceed the configured bounds.

`failpoint.Validate` requires the chosen failpoint to be available on every process in the cluster. `PickRandom` filters the shared failpoint list through that check, then selects one of the remaining options. The exploratory suite uses this selection; regression scenarios generally specify a fixed failpoint in their `TestScenario`.

This can make similar scenarios behave differently: a fixed regression scenario runs the configured disruption directly, while exploratory scenarios select only from the available set. The `allFailpoints` list in [`failpoint/failpoint.go`](failpoint/failpoint.go) is the inventory used for random selection; scenario-specific definitions can also reference failpoints that are not in that inventory.

## Follow one example

For a crash at the Raft save boundary, follow `Issue14370` in [`scenarios/scenarios.go`](scenarios/scenarios.go) into `runScenario` and `failpoint.Inject` in [`main_test.go`](main_test.go), then into `goPanicFailpoint.Inject` in [`failpoint/gofail.go`](failpoint/gofail.go). The hook itself is in [`server/etcdserver/raft.go`](../../server/etcdserver/raft.go). The harness waits for the child to exit and restarts it; afterward the shared robustness checks validate the recorded history.

For a peer network disruption that waits for a snapshot, follow `Issue20221` in [`ISSUE20221_WALKTHROUGH.md`](ISSUE20221_WALKTHROUGH.md) and [`failpoint/network.go`](failpoint/network.go).
