# etcd WAL Explorer

Standalone local UI for inspecting etcd `.wal` files and `member/snap/db`
databases. WAL files show framed records and decoded Raft entries; database
files show stored key/value revisions.

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

Use the **Database** mode to select a copied `member/snap/db` file. It reads
the etcd `key` bucket, including historical revisions and tombstones. Stop
etcd before copying its database. Uploads are limited to 128 MB.

The app accepts a single WAL segment. For complete history, use
`go run ./tools/etcd-dump-logs <data-dir>`, which reads the complete
`member/wal` directory and understands segment ordering.
