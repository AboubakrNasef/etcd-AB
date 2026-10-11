namespace CSharpEtcdAspire.Watcher;

public sealed record EtcdEventDocument(
    string Id,
    long Revision,
    string EventType,
    string Key,
    string? Value,
    string? PreviousValue,
    DateTime OccurredAtUtc)
{
    public static string CreateId(long revision, int ordinalWithinRevision) =>
        $"{revision}:{ordinalWithinRevision}";
}
