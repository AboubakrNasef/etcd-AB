using System.Threading.Channels;
using Google.Protobuf;
using Grpc.Core;
using Etcdserverpb;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using dotnet_etcd;

namespace CSharpEtcdAspire.Watcher;

public sealed class EtcdWatchWorker(
    MongoEventStore store,
    IConfiguration configuration,
    ILogger<EtcdWatchWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var endpoints = configuration["ETCD_ENDPOINTS"]
            ?? throw new InvalidOperationException("ETCD_ENDPOINTS is not configured.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await WatchAsync(endpoints, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (EtcdCompactedException exception)
            {
                logger.LogError(exception, "Cannot resume etcd watch: the saved revision was compacted.");
                return;
            }
            catch (Exception exception)
            {
                logger.LogWarning(exception, "etcd watch stopped; retrying from the last MongoDB cursor.");
                await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken);
            }
        }
    }

    private async Task WatchAsync(string endpoints, CancellationToken cancellationToken)
    {
        using var client = new EtcdClient(
            endpoints,
            configureChannelOptions: options => options.Credentials = ChannelCredentials.Insecure);
        var revision = await store.GetLastRevisionAsync(cancellationToken);
        var responses = Channel.CreateBounded<WatchResponse>(new BoundedChannelOptions(128)
        {
            FullMode = BoundedChannelFullMode.Wait,
            SingleReader = true,
            SingleWriter = false
        });

        var request = new WatchRequest
        {
            CreateRequest = new WatchCreateRequest
            {
                Key = ByteString.Empty,
                RangeEnd = ByteString.CopyFrom(new byte[] { 0 }),
                StartRevision = revision == 0 ? 0 : revision + 1,
                PrevKv = true
            }
        };

        var watchId = await client.WatchAsync(
            request,
            response => responses.Writer.WriteAsync(response, cancellationToken).AsTask().GetAwaiter().GetResult(),
            cancellationToken: cancellationToken);

        try
        {
            var eventOrdinals = new Dictionary<long, int>();
            await foreach (var response in responses.Reader.ReadAllAsync(cancellationToken))
            {
                if (response.CompactRevision != 0)
                    throw new EtcdCompactedException(request.CreateRequest.StartRevision, response.CompactRevision);
                if (response.Canceled)
                    throw new InvalidOperationException($"etcd canceled the watch: {response.CancelReason}");

                var documents = new List<EtcdEventDocument>(response.Events.Count);
                foreach (var change in response.Events)
                {
                    var eventRevision = change.Kv.ModRevision;
                    foreach (var oldRevision in eventOrdinals.Keys.Where(key => key < eventRevision).ToArray())
                        eventOrdinals.Remove(oldRevision);
                    eventOrdinals.TryGetValue(eventRevision, out var ordinal);
                    eventOrdinals[eventRevision] = ordinal + 1;
                    documents.Add(new EtcdEventDocument(
                        EtcdEventDocument.CreateId(eventRevision, ordinal),
                        eventRevision,
                        change.Type.ToString().ToLowerInvariant(),
                        change.Kv.Key.ToStringUtf8(),
                        change.Type == Mvccpb.Event.Types.EventType.Delete ? null : change.Kv.Value.ToStringUtf8(),
                        change.PrevKv?.Value.ToStringUtf8(),
                        DateTime.UtcNow));
                }

                var responseRevision = response.Header?.Revision ?? revision;
                await store.SaveEventsAsync(documents, Math.Max(revision, responseRevision), cancellationToken);
                revision = Math.Max(revision, responseRevision);
            }
        }
        finally
        {
            client.CancelWatch(watchId);
            responses.Writer.TryComplete();
        }
    }
}

public sealed class EtcdCompactedException(long requestedRevision, long compactRevision)
    : Exception($"Watch revision {requestedRevision} was compacted at revision {compactRevision}.")
{
    public long RequestedRevision { get; } = requestedRevision;
    public long CompactRevision { get; } = compactRevision;
}
