import { ChangeEvent, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

type DecodedRecord = {
  number: number
  recordType: string
  term?: number
  index?: number
  entryType?: string
  data?: Record<string, unknown>
  raw?: string
  error?: string
}

type DecodeResult = {
  fileName: string
  records: DecodedRecord[]
  errors?: string[]
}

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<DecodeResult | null>(null)
  const [selected, setSelected] = useState<DecodedRecord | null>(null)
  const [entryType, setEntryType] = useState('all')
  const [startIndex, setStartIndex] = useState('')
  const [endIndex, setEndIndex] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const records = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return (result?.records ?? []).filter((record) => !needle || JSON.stringify(record).toLowerCase().includes(needle))
  }, [result, search])

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null)
  }

  async function decode() {
    if (!file) return
    setLoading(true)
    setError('')
    const form = new FormData()
    form.append('file', file)
    const query = new URLSearchParams()
    if (entryType !== 'all') query.set('entryType', entryType)
    if (startIndex) query.set('startIndex', startIndex)
    if (endIndex) query.set('endIndex', endIndex)
    try {
      const response = await fetch(`/api/decode?${query}`, { method: 'POST', body: form })
      const payload = (await response.json()) as DecodeResult | { error?: string }
      if (!response.ok) throw new Error(('error' in payload && payload.error) || 'Unable to decode WAL')
      const decoded = payload as DecodeResult
      setResult(decoded)
      setSelected(decoded.records[0] ?? null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to decode WAL')
      setResult(null)
      setSelected(null)
    } finally {
      setLoading(false)
    }
  }

  return <main className="shell">
    <header className="topbar"><div><p className="eyebrow">ETCD / STORAGE TOOL</p><h1>WAL Explorer</h1><p className="subtitle">Decode Raft records into something you can actually read.</p></div><div className="badge"><span className="dot" /> local-only</div></header>
    <section className="hero-grid">
      <div className="dropzone"><div className="file-mark">⌁</div><h2>Choose a WAL segment</h2><p>Select a copied <code>.wal</code> file. Keep the live etcd data directory stopped while inspecting it.</p><label className="file-button">{file ? 'Choose another file' : 'Browse WAL file'}<input type="file" accept=".wal,application/octet-stream" onChange={chooseFile} /></label>{file && <div className="file-name">{file.name}<span>{formatBytes(file.size)}</span></div>}</div>
      <div className="config-card"><div className="card-heading"><span>Decode configuration</span><span className="tiny-label">READ ONLY</span></div><label>Entry type<select value={entryType} onChange={(event) => setEntryType(event.target.value)}><option value="all">All records</option><option value="EntryNormal">Normal entries</option><option value="EntryConfChange">Config changes</option></select></label><div className="field-row"><label>Start index<input inputMode="numeric" placeholder="optional" value={startIndex} onChange={(event) => setStartIndex(event.target.value)} /></label><label>End index<input inputMode="numeric" placeholder="optional" value={endIndex} onChange={(event) => setEndIndex(event.target.value)} /></label></div><button className="decode-button" disabled={!file || loading} onClick={decode}>{loading ? 'Decoding…' : 'Decode WAL'} <span>→</span></button>{error && <div className="error">{error}</div>}</div>
    </section>
    {result ? <section className="workspace"><div className="workspace-head"><div><p className="eyebrow">INSPECTING</p><h2>{result.fileName}</h2></div><div className="stats"><div><strong>{result.records.length}</strong><span>records</span></div><div><strong>{result.errors?.length ?? 0}</strong><span>issues</span></div></div></div><div className="search-row"><input className="search" placeholder="Search decoded records…" value={search} onChange={(event) => setSearch(event.target.value)} /><span>{records.length} shown</span></div><div className="record-grid"><div className="record-list">{records.map((record) => <button key={`${record.number}-${record.index ?? ''}`} className={`record-row ${selected === record ? 'active' : ''}`} onClick={() => setSelected(record)}><span className="record-number">{String(record.number).padStart(3, '0')}</span><span className="record-type">{record.recordType}</span><span className="record-index">{record.index ? `#${record.index}` : '—'}</span></button>)}{!records.length && <div className="empty">No records match this search.</div>}</div><div className="detail-panel">{selected ? <><div className="detail-head"><div><span className="type-chip">{selected.recordType}</span><h3>{selected.index ? `Entry #${selected.index}` : `Record ${selected.number}`}</h3></div><span className="term">term {selected.term || '—'}</span></div><pre>{JSON.stringify(selected, null, 2)}</pre></> : <div className="empty">Select a record to inspect it.</div>}</div></div></section> : <section className="empty-state"><div className="empty-icon">⌁</div><h2>Your decoded records will appear here</h2><p>Pick a WAL segment above to see metadata, Raft state, entries, snapshots, CRCs, and decoded internal requests.</p></section>}
    <footer>WAL Explorer · uses etcd’s storage/wal decoder · nothing is written back to disk</footer>
  </main>
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`
}

createRoot(document.getElementById('root')!).render(<App />)
