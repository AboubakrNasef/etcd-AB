# Run one robustness scenario locally

These steps run the `Issue14370` regression scenario once. It starts a single-member etcd cluster, generates KV traffic, and injects a panic before Raft saves data. The test then checks whether the client history agrees with the data persisted by etcd.

For a detailed walkthrough with flow diagrams, see [ISSUE14370_WALKTHROUGH.md](ISSUE14370_WALKTHROUGH.md).

For Debian VM setup, see [LOCAL_TESTING_DEBIAN.md](LOCAL_TESTING_DEBIAN.md).

On Windows, run every command below inside WSL. Do not run `make gofail-enable` from PowerShell or Git Bash with Windows Go: GoFail receives repository-relative paths, and the native Windows setup can fail to resolve them.

From PowerShell, enter WSL:

```powershell
wsl
```

Then, in the WSL shell, go to this checkout. Your reported path is already correct:

```bash
cd /mnt/d/Programming/0.Practice/etcd/etcd-AB
uname -s
pwd
```

Expect `Linux` and `/mnt/d/Programming/0.Practice/etcd/etcd-AB`. If your checkout is elsewhere, replace the `cd` path with its WSL path. The repository pins Go `1.26.7` in `.go-version`.

### Install Go in WSL

Your `go: command not found` output means Go is not installed in this WSL distribution. Go can be installed under your home directory without `sudo`. These commands are for WSL on `x86_64`; for ARM64, use `go1.26.7.linux-arm64.tar.gz` instead of the `amd64` archive.

```bash
command -v curl tar make git
curl -fL https://go.dev/dl/go1.26.7.linux-amd64.tar.gz -o /tmp/go1.26.7.linux-amd64.tar.gz
mkdir -p "$HOME/.local/go1.26.7"
tar -C "$HOME/.local/go1.26.7" --strip-components=1 -xzf /tmp/go1.26.7.linux-amd64.tar.gz
echo 'export PATH="$HOME/.local/go1.26.7/bin:$HOME/go/bin:$PATH"' >> "$HOME/.bashrc"
export PATH="$HOME/.local/go1.26.7/bin:$HOME/go/bin:$PATH"
go version
go env GOOS
```

The final commands should report Go `1.26.7` and `linux`. `curl` and `tar` are needed to install Go; `make` and `git` are needed to run the repo workflow. This follows the [official Go Linux installation steps](https://go.dev/doc/install); the archive is available from the [official downloads page](https://go.dev/dl/).

If `make` is missing and `sudo` is unavailable, you can try downloading and extracting its Debian/Ubuntu package into your home directory. `apt-get download` does not install system-wide or require root, but it does need working package indexes and network access:

```bash
mkdir -p "$HOME/tmp/make-package" "$HOME/.local/make"
cd "$HOME/tmp/make-package"
apt-get download make
dpkg-deb -x ./make_*.deb "$HOME/.local/make"
export PATH="$HOME/.local/make/usr/bin:$PATH"
echo 'export PATH="$HOME/.local/make/usr/bin:$PATH"' >> "$HOME/.bashrc"
make --version
```

This uses APT's [download command](https://manpages.ubuntu.com/manpages/noble/man8/apt-get.8.html). If `apt-get download` or `dpkg-deb` is unavailable, or `make --version` reports a missing shared library, ask the WSL administrator to install GNU Make.

## 1. Build etcd with failpoints

```bash
make gofail-enable
make build
make gofail-disable
```

The robustness harness starts the `bin/etcd` executable, so the binary must be built while failpoints are enabled. Disable failpoints afterward to restore the normal source tree state.

If `make build` fails, still run `make gofail-disable` before retrying or switching branches so the generated failpoint changes are removed.

## 2. Run only Issue14370 once

```bash
GO_TEST_FLAGS='-v --run=TestRobustnessRegression/Issue14370 --count=1' make test-robustness
```

`--run` selects this named subtest; `--count=1` runs it once. The test may pass: the checked-in scenario is configured to exercise the failure path, while reproducing the historical bug requires the old etcd binary used by the dedicated `test-robustness-issue14370` target.

## 3. Inspect the scenario and result

- Scenario configuration: [`scenarios/scenarios.go`](scenarios/scenarios.go), search for `Issue14370`.
- Test flow: [`main_test.go`](main_test.go) starts the cluster, runs traffic and injects the failpoint, then validates the recorded history.
- If validation fails, find the `Saving robustness test report` path in the test output. Open `history.html` in that directory; `client-*` contains request histories and `server-*` contains etcd data.

For the full historical reproduction (100 attempts using an older etcd binary), see the `test-robustness-issue14370` target in [`Makefile`](Makefile).
