using CSharpEtcdAspire.Watcher;

var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddSingleton(new MongoEventStore(
    builder.Configuration.GetConnectionString("etcd-watch")
    ?? throw new InvalidOperationException("Aspire did not provide the etcd-watch MongoDB connection string.")));
builder.Services.AddHostedService<EtcdWatchWorker>();
await builder.Build().RunAsync();
