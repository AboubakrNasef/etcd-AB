using CSharpEtcdAspire.Watcher;
using Xunit;

namespace CSharpEtcdAspire.Watcher.Tests;

public sealed class EventIdentityTests
{
    [Fact]
    public void EventsAtSameRevisionHaveDistinctStableIds()
    {
        Assert.Equal("42:0", EtcdEventDocument.CreateId(42, 0));
        Assert.Equal("42:1", EtcdEventDocument.CreateId(42, 1));
        Assert.Equal("42:0", EtcdEventDocument.CreateId(42, 0));
    }

    [Fact]
    public void CompactedRevisionIsReportedWithoutResettingTheCursor()
    {
        var exception = new EtcdCompactedException(42, 50);

        Assert.Equal(42, exception.RequestedRevision);
        Assert.Equal(50, exception.CompactRevision);
        Assert.Contains("compacted", exception.Message);
    }
}
