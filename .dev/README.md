# Local traces and searchable etcd logs

Start Grafana Tempo, Loki, Grafana, and Grafana Alloy from this directory:

```powershell
make
```

In VS Code, run **Launch etcd with Grafana tracing and logs** or **Launch 3-node
etcd cluster with Grafana tracing and logs**. They send traces to Tempo and
write structured JSON logs under `logs/`; Alloy tails `etcd*.log` and forwards
entries to Loki.

- Open the automatically provisioned **etcd observability** dashboard in
  Grafana at <http://localhost:3000> (login: `admin` / `admin`). It includes
  recent etcd traces and searchable logs. Grafana loads the dashboard and both
  data sources from files in this directory.
- In Explore, select **Loki** and query `{job="etcd"}`; filter text with,
  for example, `{job="etcd"} |= "starting"`.
- In Explore, select **Tempo** and search for service `etcd`.
- `make logs` follows the Docker services. `make down` stops them while keeping
  Tempo, Loki, Grafana, and Alloy data volumes.

The log files are local and may contain operational details. Remove them when
you no longer need their contents.
