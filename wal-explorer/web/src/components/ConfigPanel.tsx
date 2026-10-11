import { useAppStore } from '../store'

export function ConfigPanel() {
  const mode = useAppStore((state) => state.mode)
  const entryType = useAppStore((state) => state.entryType)
  const startIndex = useAppStore((state) => state.startIndex)
  const endIndex = useAppStore((state) => state.endIndex)
  const file = useAppStore((state) => state.file)
  const loading = useAppStore((state) => state.loading)
  const error = useAppStore((state) => state.error)
  const setEntryType = useAppStore((state) => state.setEntryType)
  const setStartIndex = useAppStore((state) => state.setStartIndex)
  const setEndIndex = useAppStore((state) => state.setEndIndex)
  const inspect = useAppStore((state) => state.inspect)
  const isWal = mode === 'wal'
  return <div className="config-card">
    <div className="card-heading"><span>{isWal ? 'Decode configuration' : 'Database inspection'}</span><span className="tiny-label">READ ONLY</span></div>
    {isWal ? <>
      <label>Entry type<select value={entryType} onChange={(event) => setEntryType(event.target.value)}><option value="all">All records</option><option value="EntryNormal">Normal entries</option><option value="EntryConfChange">Config changes</option></select></label>
      <div className="field-row">
        <label>Start index<input inputMode="numeric" placeholder="optional" value={startIndex} onChange={(event) => setStartIndex(event.target.value)} /></label>
        <label>End index<input inputMode="numeric" placeholder="optional" value={endIndex} onChange={(event) => setEndIndex(event.target.value)} /></label>
      </div>
    </> : <p className="mode-description">Reads the etcd key bucket, including stored revisions and tombstones. Upload limit: 128 MB.</p>}
    <button className="decode-button" disabled={!file || loading} onClick={inspect}>{loading ? 'Inspecting...' : isWal ? 'Decode WAL' : 'Inspect database'} <span>&#8594;</span></button>
    {error && <div className="error">{error}</div>}
  </div>
}
