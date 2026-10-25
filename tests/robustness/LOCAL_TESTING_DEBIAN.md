# Run one robustness scenario on Debian

This guide runs the `Issue14370` regression scenario once on a Debian machine or VM. The scenario starts a single-member etcd process, sends KV traffic, panics at the Raft WAL save failpoint, restarts etcd, and validates the recorded client history.

For a code walkthrough with flow diagrams and Delve step-through instructions, see [ISSUE14370_WALKTHROUGH.md](ISSUE14370_WALKTHROUGH.md#step-through-the-test-with-delve). For Windows/WSL setup, see [LOCAL_TESTING.md](LOCAL_TESTING.md).

## 1. Install Debian prerequisites

Open a terminal on Debian and install GNU Make, Git, and the tools used to download Go:

```bash
sudo apt update
sudo apt install -y build-essential git curl ca-certificates
```

Use a checkout on the VM's Linux filesystem. From the repository root, confirm the environment and architecture:

```bash
uname -s
uname -m
pwd
```

Expect `Linux`. The repository pins Go `1.26.7` in `.go-version`.

### If Git reports “dubious ownership”

VMware shared folders under `/mnt/hgfs` can appear to Git as owned by a different user. No separate login is needed. Run this as your normal Debian user (not with `sudo`) to trust this one checkout:

```bash
git config --global --add safe.directory /mnt/hgfs/Programming/0.Practice/etcd/etcd-AB
git rev-parse --show-toplevel
cat .go-version
```

The last two commands should print the repository path and `1.26.7`. If `git rev-parse` still fails, stop before running Make: `REPOSITORY_ROOT` will be empty and Make will look for paths such as `/tools/mod/go.mod`.

## 2. Install the repository's Go version

The Debian package may provide a different Go version, so install the pinned Go release from the [official Go downloads page](https://go.dev/dl/). The commands below are for `x86_64`; on `aarch64`, change `amd64` to `arm64` in the archive name.

```bash
curl -fL https://go.dev/dl/go1.26.7.linux-amd64.tar.gz -o /tmp/go1.26.7.linux-amd64.tar.gz
mkdir -p "$HOME/.local/go1.26.7"
tar -C "$HOME/.local/go1.26.7" --strip-components=1 -xzf /tmp/go1.26.7.linux-amd64.tar.gz
echo 'export PATH="$HOME/.local/go1.26.7/bin:$HOME/go/bin:$PATH"' >> "$HOME/.bashrc"
export PATH="$HOME/.local/go1.26.7/bin:$HOME/go/bin:$PATH"
go version
go env GOOS
make --version
git --version
```

Confirm Go reports `1.26.7` and `linux` before proceeding. The installation follows the [official Go Linux installation guide](https://go.dev/doc/install).

## 3. Build etcd with failpoints

From the repository root:

```bash
make gofail-enable
make build
make gofail-disable
```

The robustness harness launches `bin/etcd`, so it must be built with failpoints enabled. `make gofail-disable` restores the ordinary source tree afterward. Run it even if `make build` fails, before retrying or switching branches.

## 4. Run only Issue14370 once

```bash
PERSIST_RESULTS=true RESULTS_DIR="$HOME/etcd-robustness-results" \
GO_TEST_FLAGS='-v --run=TestRobustnessRegression/Issue14370 --count=1' \
make test-robustness
```

This runs the named regression subtest one time using the current checkout. `PERSIST_RESULTS=true` keeps the report after a passing run, and `RESULTS_DIR` puts it under `$HOME/etcd-robustness-results` instead of `/tmp`. Find the exact timestamped report directory in the `Saving robustness test report` log line.

A passing run shows the current build survived the injected crash; it does not reproduce the historical bug. The historical `test-robustness-issue14370` target builds etcd `v3.5.4` and retries up to 100 times.

## 5. Inspect the result

Open `history.html` when present; `client-*` contains recorded requests and watch observations, and `server-*` contains the etcd member's data directory.
