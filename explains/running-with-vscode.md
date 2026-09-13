# Running the Application with VS Code

The repository includes `.vscode/launch.json` with three Go debug profiles:

- **Launch etcd** starts the server from `server/`.
- **Launch etcdctl** starts the command-line client from `etcdctl/`.
- **Launch etcdutl** starts the offline administration tool from `etcdutl/`.

## Start a local server

1. Open the repository root in VS Code.
2. Open **Run and Debug**.
3. Choose **Launch etcd**.
4. Press **F5**.

The profile uses the repository root as its working directory. A single local
member listens on client port `2379` and peer port `2380` by default.

## Exercise the API

Use another terminal while the debugger is running:

```powershell
go run ./etcdctl endpoint health
go run ./etcdctl put learning "first value"
go run ./etcdctl get learning
```

Set breakpoints in `server/etcdmain/`, `server/embed/`, and
`server/etcdserver/` to connect the runtime behavior to the repository guide's
startup and request-flow diagrams.

## Debug the tools

Choose **Launch etcdctl** or **Launch etcdutl** when you need to step through
the corresponding Go program. Stop any running server before restarting it or
before using an operation that needs exclusive access to local data.

Press **Shift+F5** to stop the active debug session. A normal development run
uses the generated `default.etcd` data directory; remove it after stopping the
server if you want to repeat the first-start behavior.
