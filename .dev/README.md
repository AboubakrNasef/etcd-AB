# Local traces and searchable etcd logs

Start Grafana Tempo, Loki, Grafana, and Grafana Alloy from this directory:

```powershell
make
```

In VS Code, run **Launch etcd with Grafana tracing and logs**. It sends traces
to Tempo and writes structured JSON logs to `logs/etcd.log`; Alloy tails that
file and forwards entries to Loki.

- Open the automatically provisioned **etcd observability** dashboard in
  Grafana at <http://localhost:3000> (login: `admin` / `admin`). It includes
  recent etcd traces and searchable logs. Grafana loads the dashboard and both
  data sources from files in this directory.
- In Explore, select **Loki** and query `{job="etcd"}`; filter text with,
  for example, `{job="etcd"} |= "starting"`.
- In Explore, select **Tempo** and search for service `etcd`.
- `make logs` follows the Docker services. `make down` stops them while keeping
  Tempo, Loki, Grafana, and Alloy data volumes.

The log file is local and may contain operational details. Remove
`logs/etcd.log` when you no longer need its contents.
