import { useAppStore } from '../store'

export function ConfigPanel() {
  const mode = useAppStore((state) => state.mode)
  const entryType = useAppStore((state) => state.entryType)
  const startIndex = useAppStore((state) => state.startIndex)
  const endIndex = useAppStore((state) => state.endIndex)
  const fileCount = useAppStore((state) => state.files.length)
  const sourceCount = useAppStore(state => new Set(state.files.map(item => item.instanceId ?? item.id)).size)
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
    <button className="decode-button" disabled={!fileCount || loading} onClick={() => inspect()}>{loading ? 'Inspecting...' : isWal ? `Decode ${fileCount} WAL${fileCount === 1 ? '' : 's'}` : `Inspect ${fileCount} database${fileCount === 1 ? '' : 's'}`} <span>&#8594;</span></button>
    <button className="decode-button" disabled={sourceCount < 2 || loading} onClick={() => inspect('compare')}>{loading ? 'Inspecting...' : 'Compare instances / files'} <span>&#8644;</span></button>
    <p className="compare-note">{sourceCount} instances / standalone files selected. {sourceCount < 2 ? 'Add at least two to compare.' : 'Folder files are combined per instance.'}</p>
    {error && <div className="error">{error}</div>}
  </div>
}
