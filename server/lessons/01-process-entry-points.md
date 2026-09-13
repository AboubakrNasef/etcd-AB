# Lesson 01: Process Entry Points

## Goal

Understand how etcd.exe becomes a configured server without confusing the
executable wrapper with the implementation.

## Source order

1. [main.go](../main.go)
2. [etcdmain/main.go](../etcdmain/main.go)
3. [etcdmain/config.go](../etcdmain/config.go)
4. [etcdmain/help.go](../etcdmain/help.go)

## Root main

The root package is main, but it is intentionally small. It makes the
repository buildable as the etcd executable and delegates to etcdmain. This
stable boundary keeps startup behavior in a testable package.

## etcdmain

This package owns command-line behavior, logging setup, help, signal handling,
and the transition into the embedded server. Trace the call that creates or
loads embedding configuration. That is the handoff from “a process was
invoked” to “a server instance should exist”.

The command layer translates user intent. It should not bypass lifecycle
coordination or write directly to backend state.

## Reading exercise

Find where arguments are consumed, invalid flags are rejected, readiness is
reported, and signal-driven shutdown begins.

~~~text
main.go -> etcdmain -> embed.StartEtcd
~~~

## Checkpoint

What responsibility belongs in etcdmain but not root main.go?

## Useful tests

- [config_test.go](../etcdmain/config_test.go) covers command configuration and
  flag behavior.
- [etcd_test.go](../embed/etcd_test.go) shows command startup becoming an
  embedded server.

## File-by-file guide

### main.go

This is the executable boundary. Read its imports and startup call first. It
exists so Go can build the etcd binary while keeping behavior in a reusable
package. For flags, listeners, or Raft, continue into the next package.

### etcdmain/main.go

This process coordinator initializes logging, interprets command mode, handles
signals, and invokes embedding. Follow error handling here as process-level
failure; later failures belong to server lifecycle code.

### etcdmain/config.go

This maps command-line input into typed configuration. Follow one flag through
parsing, defaulting, validation, and assignment. Lower layers should consume
these typed settings instead of reading flags again.

### etcdmain/help.go

Help text describes the public process contract. Use it to discover modes and
flags, then verify behavior in config.go. It is not a state-machine component,
but it explains what operators are allowed to request.
