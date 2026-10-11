import { useMemo } from 'react'
import { useAppStore } from '../store'

export function ResultsPanel() {
  const mode = useAppStore((state) => state.mode)
  const result = useAppStore((state) => state.result)
  const selected = useAppStore((state) => state.selected)
  const search = useAppStore((state) => state.search)
  const setSearch = useAppStore((state) => state.setSearch)
  const selectRecord = useAppStore((state) => state.selectRecord)
  const records = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return (result?.records ?? []).filter((record) => !needle || JSON.stringify(record).toLowerCase().includes(needle))
  }, [result, search])
  if (!result) return null
  return <section className="workspace">
    <div className="workspace-head"><div><p className="eyebrow">INSPECTING</p><h2>{result.fileName}</h2></div><div className="stats"><div><strong>{result.records.length}</strong><span>records</span></div><div><strong>{result.errors?.length ?? 0}</strong><span>issues</span></div></div></div>
    <div className="search-row"><input className="search" placeholder={mode === 'wal' ? 'Search decoded records...' : 'Search keys and values...'} value={search} onChange={(event) => setSearch(event.target.value)} /><span>{records.length} shown</span></div>
    <div className="record-grid">
      <div className="record-list">
        {records.map((record) => <button key={`${record.number}-${record.index ?? record.revision ?? ''}`} className={`record-row ${selected === record ? 'active' : ''}`} onClick={() => selectRecord(record)}>
          <span className="record-number">{String(record.number).padStart(3, '0')}</span><span className="record-type">{record.data?.key ? String(record.data.key) : record.recordType}</span><span className="record-index">{record.revision ? `${record.revision}.${record.subRevision ?? 0}` : record.index ? `#${record.index}` : '-'}</span>
        </button>)}
        {!records.length && <div className="empty">No records match this search.</div>}
      </div>
      <div className="detail-panel">{selected ? <>
        <div className="detail-head"><div><span className="type-chip">{selected.recordType}</span><h3>{selected.revision ? `Revision ${selected.revision}.${selected.subRevision ?? 0}` : selected.index ? `Entry #${selected.index}` : `Record ${selected.number}`}</h3></div><span className="term">{selected.revision ? (selected.tombstone ? 'tombstone' : 'key value') : `term ${selected.term || '-'}`}</span></div>
        <pre>{JSON.stringify(selected, null, 2)}</pre>
      </> : <div className="empty">Select a record to inspect it.</div>}</div>
    </div>
  </section>
}
