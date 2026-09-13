# etcd WAL Explorer

Standalone local UI for selecting one etcd `.wal` file and viewing its framed
records, Raft entries, metadata, hard state, snapshots, CRCs, and decoded
internal requests.

## Run

### One command on Windows

From this directory:

```powershell
.\run.ps1
```

This starts the Go decoder API and React development server in separate
terminals. If `web/node_modules` is missing, it runs `npm install` first.

If GNU Make is available, the equivalent command is:

```powershell
make
```

Or explicitly:

```powershell
make dev
```

Start the decoder API from this directory:

```powershell
Set-Location server
$env:GOWORK = 'off'
go run .
```

The API listens on `http://127.0.0.1:8787`.

In a second terminal, start the React UI:

```powershell
Set-Location web
npm install
npm run dev
```

Open `http://127.0.0.1:5173` and choose a copied WAL segment. The UI is
read-only and uploads the selected file to the local API for decoding.

The app accepts a single WAL segment. For complete history, use
`go run ./tools/etcd-dump-logs <data-dir>`, which reads the complete
`member/wal` directory and understands segment ordering.
