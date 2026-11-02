+# runScenario explained

This note walks through runScenario in [main_test.go](main_test.go): what it starts, how its goroutines coordinate, and what it returns. The function coordinates one robustness scenario. It does not read the WAL or run the history validator; its caller, testRobustness, does that afterward.

## At a glance

runScenario starts three workers under one cancellable context:

1. **Failpoint worker** waits, injects the configured failure, and records when injection began and ended.
2. **Traffic worker** runs the configured workload and waits for the failpoint worker's timing report before stopping.
3. **Watch worker** passively watches each cluster endpoint until traffic reports its maximum revision.

After all workers finish, runScenario checks the final cluster hash and returns all client reports.

```mermaid
sequenceDiagram
    participant R as runScenario
    participant F as Failpoint worker
    participant T as Traffic worker
    participant W as Watch worker
    participant E as etcd cluster
    R->>R: Create context, baseTime, IDs, channels, client sets
    par Failpoint worker
        R->>F: Start worker
        F->>F: Wait before injection (base delay ± jitter)
        F->>E: Inject failure; wait for recovery
        F->>T: Send FailpointInjection timing
    and Traffic worker
        R->>T: Start SimulateTraffic
        T->>E: Send KV and compaction requests
        T->>T: Receive failpoint timing, stop generators
        T->>E: Send final successful put
        T->>W: Send maximum observed revision
    and Watch worker
        R->>W: Start passive watches
        W->>E: Collect events and progress
        W->>W: Finish after maximum revision is observed
    end
    R->>R: Wait for workers
    R->>E: CheckEndOfTestHashKV
    R-->>R: Return traffic + watch + failpoint reports
```

## Setup and shared state

At entry, the function derives a child context with context.WithCancel. The deferred cancel releases it when the function returns; the failpoint worker also calls it immediately if injection fails, prompting the other workers to stop.

baseTime is captured once and passed to every client and the failpoint injector. They measure event times as durations from this common point, so request and failure timestamps can be compared even when recorded by different clients. The nearby code comment calls out Go's monotonic clock behavior.

identity.NewIDProvider() is also shared. It gives clients and write requests distinct IDs across the traffic clients, watch clients, and failpoint reports.

The function creates two independent ClientSet values:

- **trafficSet** owns clients created by generated traffic.
- **watchSet** owns passive watch clients.

Each set is deferred for cleanup. Calling Reports later closes its clients, waits for outstanding client work, and snapshots their recorded operations.

## Worker 1: failpoint timing and recovery

The first g.Go function owns failpointInjected, a buffered channel with room for one report.FailpointInjection. Its deferred close lets the traffic worker detect that the injector exited without sending a result.

The worker:

1. Sleeps for randomizeTime(WaitBeforeFailpoint, WaitJitter). The defaults are one second and 200 ms of jitter, so the delay is from 800 ms to just under 1.2 seconds.
2. Calls failpoint.Inject with the scenario's failpoint, shared base time, and ID provider. That helper checks cluster health, performs the configured injection, checks health afterward, and returns the injection's start/end times plus any reports produced by the injection.
3. If injection returns an error, reports it with t.Error and cancels the shared context.
4. Sleeps for the similarly randomized WaitAfterFailpoint interval.
5. If a failpoint report exists, sends its timing through failpointInjected and saves its client reports for the final return value.

For Issue14370, failpoint.Inject uses RaftBeforeSavePanic. Its implementation activates the Go failpoint, waits for the etcd child to exit, and starts it again. The report's Start and End values span that injection call, including process exit, restart, and the post-injection health check. The report reaches the traffic worker only after the additional WaitAfterFailpoint delay; that delay is not included in End.

## Worker 2: generated traffic

The second g.Go function calls traffic.SimulateTraffic with the scenario's profile and traffic recipe. For Issue14370, this means KV requests and periodic compaction. The traffic helper starts the configured client loops and waits on failpointInjected.

Receiving the timing report tells SimulateTraffic that the failure and restart phase has finished. It closes its internal finish channel and waits for traffic loops to stop. It then waits one more second and sends a final successful Put. That final operation gives later validation a known successful operation after recovery.

Once SimulateTraffic returns its client reports, this worker:

1. Calls report.OperationsMaxRevision to find the greatest revision reported by those operations.
2. Sends that revision on maxRevisionChan.
3. Logs completion and closes maxRevisionChan on return.

maxRevisionChan also has capacity one, so the send can complete even if the watch worker has not received it yet. The final successful put is included in the traffic reports used to compute this maximum.

## Worker 3: passive watch collection

The third g.Go function gets the cluster's client endpoints with processEndpoints(clus) and passes them to client.CollectClusterWatchEvents.

That helper creates one recording watch client per endpoint and a forwarding goroutine. The forwarder reads the maximum revision from maxRevisionChan and sends it to every member watcher. Each watcher collects events from the next revision, requests progress about every 100 ms, and finishes after it has observed the target revision. If compaction cancels a watch, it resumes from the compact revision.

Issue14370 has no generated watch workload, but this collector still records what a watch client could observe while KV traffic and the failure are in progress.

## Joining workers and checking the cluster

g.Wait waits for all three worker functions and returns the first non-nil error they return. If it gets an error, runScenario records it with t.Error; it still attempts CheckEndOfTestHashKV.

The hash helper reads a cluster revision and compares each member's hash and compact revision at that point. Any mismatch is reported with t.Error. With a one-member scenario, it checks the recovered member's state but cannot compare independent peers.

The function then combines reports in this order:

1. trafficSet.Reports() — generated KV/compaction client histories.
2. watchSet.Reports() — passive watch histories.
3. failpointClientReport — any client report returned by the failpoint implementation.

That combined slice is returned to testRobustness, which saves the report, reads persisted requests from the WAL, and calls validate.ValidateAndReturnVisualize.

## Error and cancellation behavior

- **Failpoint injection error:** the worker calls t.Error and cancels the shared context. The traffic helper can also fail if the failpoint channel closes before it receives a report.
- **Traffic setup or final-write failure:** SimulateTraffic uses test assertions for required setup and final-write conditions. These mark the test failed.
- **Watch collection error:** the watch worker returns the error; g.Wait reports it through t.Error.
- **Final hash mismatch:** CheckEndOfTestHashKV returns an error, which is also recorded with t.Error.

The group is a plain errgroup.Group, not errgroup.WithContext; a worker returning an error does not automatically cancel its siblings. The explicit cancellation in this function is on failpoint-injection error, and the derived context is always canceled when runScenario exits.

## What the function does not do

runScenario does not load or parse the WAL, decide whether the operation history is linearizable, or persist the final report. Those steps belong to testRobustness in the same file.

