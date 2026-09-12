# Lesson 12: Testing and Study Exercises

## Goal

Use tests as executable documentation and build a repeatable learning method.

## Focused Windows commands

~~~powershell
Set-Location server
go test ./storage/mvcc/...
go test ./lease/...
go test ./etcdserver/...
go build .
~~~

If the checkout has Windows-specific generated or symlink issues, fix the
checkout first; do not infer server behavior from a compiler failure in an
unrelated example file.

## Test-reading order

1. Read the public interface.
2. Find the simplest successful test.
3. Find an invalid-input test.
4. Find a restart, cancellation, or concurrency test.
5. Read mocks after understanding the real dependency.

## Exercises

- Trace a serializable read and contrast it with a linearizable read.
- Find how transaction comparisons choose a branch.
- List restart artifacts from backend, WAL, snapshot, and membership.
- Follow watch cancellation into watcher cleanup.
- Trace member changes through every validation boundary.

## Completion standard

You understand the server when you can follow a Put, read, watch, lease expiry,
and membership change while naming the boundaries between API, Raft, apply, MVCC,
and persistence.
