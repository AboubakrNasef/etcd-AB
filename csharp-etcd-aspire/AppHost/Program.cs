using Aspire.Hosting.ApplicationModel;
using dotnet_etcd;
using Grpc.Core;

var builder = DistributedApplication.CreateBuilder(args);

const string cluster = "etcd1=http://etcd1:2380,etcd2=http://etcd2:2380,etcd3=http://etcd3:2380";
const string image = "quay.io/coreos/etcd:v3.7.1";
const string token = "csharp-aspire-demo";

var etcd1 = AddEtcdMember(builder, "etcd1", 23791, image, cluster, token);
var etcd2 = AddEtcdMember(builder, "etcd2", 23792, image, cluster, token);
var etcd3 = AddEtcdMember(builder, "etcd3", 23793, image, cluster, token);
var collectorConfig = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../Observability/otel-collector.yaml"));
builder.AddContainer("otel-collector", "otel/opentelemetry-collector-contrib:0.162.0")
    .WithArgs("--config=/etc/otelcol-contrib/config.yaml")
    .WithBindMount(collectorConfig, "/etc/otelcol-contrib/config.yaml", isReadOnly: true)
    .WaitFor(etcd1)
    .WaitFor(etcd2)
    .WaitFor(etcd3);
var usr= builder.AddParameter("etcd", "etcd");
var pwd= builder.AddParameter("etcdpwd", "etcd");
var mongo = builder.AddMongoDB("mongo", 27034);
 
var database = mongo.AddDatabase("etcd-watch");

var watcher = builder.AddProject<Projects.CSharpEtcdAspire_Watcher>("watcher")
    .WithReference(database)
    .WithEnvironment("ETCD_ENDPOINTS", "http://localhost:23791,http://localhost:23792,http://localhost:23793")
    .WaitFor(database)
    .WaitFor(etcd1)
    .WaitFor(etcd2)
    .WaitFor(etcd3);

watcher.WithCommand(
    "put",
    "Put key/value",
    async context =>
    {
        var key = context.Arguments.GetString("key")!;
        var value = context.Arguments.GetString("value") ?? string.Empty;
        using var client = CreateEtcdClient();
        var result = await client.PutAsync(key, value, cancellationToken: context.CancellationToken);
        return CommandResults.Success($"Put '{key}' at revision {result.Header.Revision}.");
    },
    commandOptions: new CommandOptions
    {
        Arguments =
        [
            new InteractionInput { Name = "key", InputType = InputType.Text, Required = true },
            new InteractionInput { Name = "value", InputType = InputType.Text }
        ]
    });

watcher.WithCommand(
    "get",
    "Get key",
    async context =>
    {
        var key = context.Arguments.GetString("key")!;
        using var client = CreateEtcdClient();
        var result = await client.GetAsync(key, cancellationToken: context.CancellationToken);
        return result.Kvs.Count == 0
            ? CommandResults.Failure($"Key '{key}' was not found.")
            : CommandResults.Success(result.Kvs[0].Value.ToStringUtf8());
    },
    commandOptions: new CommandOptions
    {
        Arguments = [new InteractionInput { Name = "key", InputType = InputType.Text, Required = true }]
    });

builder.Build().Run();

static EtcdClient CreateEtcdClient() => new(
    "http://localhost:23791,http://localhost:23792,http://localhost:23793",
    configureChannelOptions: options => options.Credentials = ChannelCredentials.Insecure);

static IResourceBuilder<ContainerResource> AddEtcdMember(
    IDistributedApplicationBuilder builder,
    string name,
    int clientPort,
    string image,
    string cluster,
    string token)
{
    return builder.AddContainer(name, image)
        .WithArgs(
            "etcd",
            $"--name={name}",
            "--data-dir=/etcd-data",
            "--log-outputs=stderr",
            "--listen-peer-urls=http://0.0.0.0:2380",
            $"--initial-advertise-peer-urls=http://{name}:2380",
            $"--listen-client-urls=http://0.0.0.0:{clientPort}",
            $"--advertise-client-urls=http://localhost:{clientPort}",
            $"--initial-cluster={cluster}",
            "--initial-cluster-state=new",
            $"--initial-cluster-token={token}",
            "--enable-distributed-tracing=true",
            "--distributed-tracing-address=host.docker.internal:4317",
            "--distributed-tracing-service-name=etcd",
            $"--distributed-tracing-instance-id={name}",
            "--distributed-tracing-sampling-rate=1000000")
        .WithEndpoint(port: clientPort, targetPort: clientPort, name: "client", scheme: "http", isProxied: false)
        .WithEndpoint(targetPort: 2380, name: "peer", scheme: "http", isExternal: false)
        .WithVolume($"{name}-data", "/etcd-data")
        .WithHttpHealthCheck("/health", endpointName: "client");
}
