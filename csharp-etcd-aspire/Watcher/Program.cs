using CSharpEtcdAspire.Watcher;
using dotnet_etcd;
using Etcdserverpb;
using Google.Protobuf;
using Grpc.Core;

var builder = WebApplication.CreateBuilder(args);
builder.AddServiceDefaults();
builder.Services.AddSingleton(new MongoEventStore(
    builder.Configuration.GetConnectionString("etcd-watch")
    ?? throw new InvalidOperationException("Aspire did not provide the etcd-watch MongoDB connection string.")));
builder.Services.AddHostedService<EtcdWatchWorker>();
builder.Services.AddSingleton(_ => new EtcdClient(
    builder.Configuration["ETCD_ENDPOINTS"]
    ?? throw new InvalidOperationException("ETCD_ENDPOINTS is not configured."),
    configureChannelOptions: options => options.Credentials = ChannelCredentials.Insecure));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();
app.UseSwagger();
app.UseSwaggerUI();
app.MapDefaultEndpoints();

var api = app.MapGroup("/api");
api.MapPost("/kv/put", async (PutKeyRequest request, EtcdClient client, CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.Key))
        return (IResult)Results.BadRequest(new { error = "key is required." });

    var response = await client.PutAsync(request.Key, request.Value ?? string.Empty,
        cancellationToken: cancellationToken);
    return (IResult)Results.Ok(new { request.Key, request.Value, revision = response.Header.Revision });
});

api.MapPost("/kv/get", async (GetKeyRequest request, EtcdClient client, CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.Key))
        return (IResult)Results.BadRequest(new { error = "key is required." });

    var response = await client.GetAsync(request.Key, cancellationToken: cancellationToken);
    var item = response.Kvs.FirstOrDefault();
    return item is null
        ? (IResult)Results.NotFound(new { request.Key, revision = response.Header.Revision })
        : Results.Ok(new EtcdKeyValue(item.Key.ToStringUtf8(), item.Value.ToStringUtf8(), item.CreateRevision,
            item.ModRevision, item.Version, item.Lease));
});

api.MapPost("/kv/delete", async (DeleteKeyRequest request, EtcdClient client, CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.Key))
        return (IResult)Results.BadRequest(new { error = "key is required." });

    var response = await client.DeleteAsync(request.Key, cancellationToken: cancellationToken);
    return (IResult)Results.Ok(new { request.Key, deleted = response.Deleted, revision = response.Header.Revision });
});

api.MapPost("/kv/transaction", async (TransactionRequest request, EtcdClient client, CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.Key))
        return (IResult)Results.BadRequest(new { error = "key is required." });

    var key = ByteString.CopyFromUtf8(request.Key);
    var transaction = new TxnRequest();
    transaction.Compare.Add(new Compare
    {
        Key = key,
        Target = Compare.Types.CompareTarget.Value,
        Result = Compare.Types.CompareResult.Equal,
        Value = ByteString.CopyFromUtf8(request.ExpectedValue ?? string.Empty)
    });
    transaction.Success.Add(new RequestOp
    {
        RequestPut = new PutRequest
        {
            Key = key,
            Value = ByteString.CopyFromUtf8(request.Value ?? string.Empty)
        }
    });
    var response = await client.TransactionAsync(transaction, cancellationToken: cancellationToken);
    return (IResult)Results.Ok(new { succeeded = response.Succeeded, revision = response.Header.Revision });
});

api.MapPost("/maintenance/compact", async (CompactRequest request, EtcdClient client, CancellationToken cancellationToken) =>
{
    if (request.Revision <= 0)
        return (IResult)Results.BadRequest(new { error = "revision must be greater than zero." });

    var response = await client.CompactAsync(new CompactionRequest { Revision = request.Revision },
        cancellationToken: cancellationToken);
    return (IResult)Results.Ok(new { revision = response.Header.Revision });
});

api.MapPost("/lease/grant", async (GrantLeaseRequest request, EtcdClient client, CancellationToken cancellationToken) =>
{
    if (request.TtlSeconds <= 0)
        return (IResult)Results.BadRequest(new { error = "ttlSeconds must be greater than zero." });

    var response = await client.LeaseGrantAsync(new LeaseGrantRequest { TTL = request.TtlSeconds },
        cancellationToken: cancellationToken);
    return (IResult)Results.Ok(new { id = response.ID, ttlSeconds = response.TTL });
});

api.MapPost("/lease/revoke", async (RevokeLeaseRequest request, EtcdClient client, CancellationToken cancellationToken) =>
{
    if (request.Id == 0)
        return (IResult)Results.BadRequest(new { error = "id is required." });

    await client.LeaseRevokeAsync(new LeaseRevokeRequest { ID = request.Id }, cancellationToken: cancellationToken);
    return (IResult)Results.Ok(new { revoked = request.Id });
});

api.MapGet("/cluster/status", async (EtcdClient client, CancellationToken cancellationToken) =>
{
    var response = await client.StatusAsync(new StatusRequest(), cancellationToken: cancellationToken);
    return (IResult)Results.Ok(new
    {
        response.Header.Revision,
        response.Version,
        response.DbSize,
        response.Leader,
        response.RaftIndex,
        response.RaftTerm
    });
});

api.MapGet("/cluster/members", async (EtcdClient client, CancellationToken cancellationToken) =>
{
    var response = await client.MemberListAsync(new MemberListRequest(), cancellationToken: cancellationToken);
    return (IResult)Results.Ok(response.Members.Select(member => new
    {
        member.ID,
        member.Name,
        clientUrls = member.ClientURLs,
        peerUrls = member.PeerURLs,
        member.IsLearner
    }));
});

app.Run();

internal sealed record PutKeyRequest(string Key, string? Value);
internal sealed record GetKeyRequest(string Key);
internal sealed record DeleteKeyRequest(string Key);
internal sealed record TransactionRequest(string Key, string? ExpectedValue, string? Value);
internal sealed record CompactRequest(long Revision);
internal sealed record GrantLeaseRequest(long TtlSeconds);
internal sealed record RevokeLeaseRequest(long Id);
internal sealed record EtcdKeyValue(
    string Key,
    string Value,
    long CreateRevision,
    long ModRevision,
    long Version,
    long Lease);
