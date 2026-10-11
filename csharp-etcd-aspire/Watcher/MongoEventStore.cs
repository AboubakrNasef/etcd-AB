using MongoDB.Driver;

namespace CSharpEtcdAspire.Watcher;

public sealed class MongoEventStore
{
    private const string CursorId = "etcd-watch";
    private readonly IMongoCollection<EtcdEventDocument> _events;
    private readonly IMongoCollection<WatchCursor> _cursors;

    public MongoEventStore(string connectionString)
    {
        var database = new MongoClient(connectionString).GetDatabase("etcd-watch");
        _events = database.GetCollection<EtcdEventDocument>("events");
        _cursors = database.GetCollection<WatchCursor>("watch-cursors");
    }

    public async Task<long> GetLastRevisionAsync(CancellationToken cancellationToken)
    {
        var cursor = await _cursors
            .Find(item => item.Id == CursorId)
            .FirstOrDefaultAsync(cancellationToken);

        return cursor?.Revision ?? 0;
    }

    public async Task SaveEventsAsync(
        IReadOnlyList<EtcdEventDocument> events,
        long lastRevision,
        CancellationToken cancellationToken)
    {
        foreach (var item in events)
        {
            await _events.ReplaceOneAsync(
                stored => stored.Id == item.Id,
                item,
                new ReplaceOptions { IsUpsert = true },
                cancellationToken);
        }

        await _cursors.ReplaceOneAsync(
            cursor => cursor.Id == CursorId,
            new WatchCursor { Id = CursorId, Revision = lastRevision },
            new ReplaceOptions { IsUpsert = true },
            cancellationToken);
    }

    private sealed record WatchCursor
    {
        public string Id { get; init; } = CursorId;
        public long Revision { get; init; }
    }
}
