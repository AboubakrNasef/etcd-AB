# Running the Application with VS Code

This guide shows how to start the local etcd server while stepping through the
source code in the debugger.

## Prerequisites

- Install the Go version declared by [go.work](../../go.work).
- Install VS Code with the Go extension.
- Open the repository root, not only the `server` directory.

## Start etcd

1. Open **Run and Debug** in VS Code.
2. Select **Launch etcd** from the configuration list.
3. Press **F5**.
4. Set breakpoints in `server/main.go`, `server/etcdmain/`, `server/embed/`, or
   `server/etcdserver/` as needed.

The existing configuration in `.vscode/launch.json` uses the repository root as
the working directory and starts the server package directly. The default etcd
ports are `2379` for client traffic and `2380` for peer traffic.

## Check the running server

Open a second terminal at the repository root and run:

```powershell
go run ./etcdctl endpoint health
go run ./etcdctl put lesson "hello from VS Code"
go run ./etcdctl get lesson
```

You can also select **Launch etcdctl** in VS Code when you want to debug the
client command itself.

## Stop and reset

Press **Shift+F5** to stop the debug session. If a later run needs a clean
single-member database, stop etcd first and remove the generated `default.etcd`
directory before starting again.

## What to observe

Start with `server/main.go`, follow startup into `server/etcdmain/`, and then
continue through `server/embed/`. For a write, place breakpoints around the
proposal path, the Raft loop, and the apply path to see why a request becomes
visible only after commitment and application.
