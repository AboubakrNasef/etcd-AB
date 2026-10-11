# etcd robustness tests: an explainer

## What they test

Robustness tests check whether an etcd cluster continues to satisfy its data and API guarantees while failures happen. A normal unit test usually calls one function under controlled conditions. A robustness test runs real etcd member processes, sends client traffic while the cluster is running, disrupts a member or a server operation, and then checks the history the clients observed against the state the cluster persisted.

The goal is to catch failures that depend on timing or interactions between components, such as a request being acknowledged but not durably stored, a watch missing an event, or members disagreeing after a restart.

## What happens in one scenario

The test harness in [`main_test.go`](main_test.go) runs each scenario in roughly this order:

1. Start an etcd process cluster using the scenario's configuration.
2. Start concurrent client activity. Depending on the scenario, this can include key-value operations, watches, and compaction.
3. Inject a failure while traffic is running. Examples include killing a member, panicking at a server failpoint, delaying an operation, or disrupting peer communication.
4. Let the cluster recover and finish collecting client results and watch events.
5. Read the requests persisted by the cluster and validate them against the client reports. Save diagnostic information for the test result.

The validator checks whether completed and in-flight operations can be explained by a valid sequential history that respects their real-time ordering and etcd's semantics. This is a form of linearizability checking. In plain terms, it asks: “Could these client results have come from one correctly ordered etcd history?”

## Exploratory and regression scenarios

The suite has two main groups:

- **Exploratory** scenarios choose an available failpoint at runtime for a given cluster and traffic profile. This lets the suite exercise different failure points without writing a separate test for every combination.
- **Regression** scenarios name a specific failure and workload associated with a previously found bug. They preserve a repeatable check so the same class of bug is less likely to return.

Scenario definitions, including cluster and traffic profiles, live in [`scenarios/`](scenarios/). Failure injection mechanisms are implemented in [`failpoint/`](failpoint/), traffic generation in [`traffic/`](traffic/), and history checking in [`validate/`](validate/).

## Running the suite

From the repository root, run:

```bash
make test-robustness
```

The suite starts multiple processes and performs failure-oriented workloads, so it takes longer than a focused unit test. The repository's Go and test prerequisites apply; see [`explains/04-tests-and-experiments.md`](../../explains/04-tests-and-experiments.md) for the broader testing workflow.

To focus on the regression group, pass Go test flags through the Make target:

```bash
GO_TEST_FLAGS='-run TestRobustnessRegression' make test-robustness
```

The suite Makefile also contains targets for reproducing selected historical issues and for running tests against specific etcd builds. See [`Makefile`](Makefile) for those options. The test runner's output and saved report identify the scenario and failure point to investigate.

## Where to read next

- [`main_test.go`](main_test.go): starts the cluster, runs traffic and failure injection, and invokes validation.
- [`scenarios/scenarios.go`](scenarios/scenarios.go): defines exploratory and regression scenarios.
- [`traffic/traffic.go`](traffic/traffic.go): coordinates generated client traffic.
- [`failpoint/`](failpoint/): contains ways to trigger crashes, delays, and network disruption.
- [`validate/validate.go`](validate/validate.go): checks client reports against persisted requests.
- [`explains/04-tests-and-experiments.md`](../../explains/04-tests-and-experiments.md): explains how to choose and run tests while investigating etcd behavior.
