import { useMemo, useState } from 'react'
import { compareRecords, stableJSON } from '../compare'
import type { DecodeResult } from '../types'
import { useAppStore } from '../store'

const recordTypeLabels: Record<string, string> = {
  entry: 'Entries', hardState: 'Hard state', metadata: 'Metadata',
  snapshot: 'Snapshots', crc: 'CRC', keyValue: 'Key values',
}

export function ComparePanel({ results }: { results: DecodeResult[] }) {
  const [left, setLeft] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [right, setRight] = useState(1)
  const [filter, setFilter] = useState('differences')
  const mode = useAppStore(state => state.mode)
  const [recordType, setRecordType] = useState(mode === 'wal' ? 'entry' : 'keyValue')
  const [selectedId, setSelectedId] = useState('')
  const allRows = useMemo(() => compareRecords(results[left]?.records ?? [], results[right]?.records ?? []), [results, left, right])
  const recordTypes = [...new Set([mode === 'wal' ? 'entry' : 'keyValue', ...allRows.map(row => (row.before ?? row.after)!.recordType)])]
  const rows = allRows.filter(row => recordType === 'all' || (row.before ?? row.after)?.recordType === recordType)
  const visible = rows.filter(row => filter === 'all' || (filter === 'differences' ? row.status !== 'unchanged' : row.status === filter))
  const selected = visible.find(row => row.id === selectedId) ?? visible[0]
  if (results.length < 2) return <section className="workspace empty">At least two instances or standalone files are needed to compare. Add another instance folder or file and click Compare again.</section>
  const fields = selected ? [...new Set([...Object.keys(selected.before ?? {}), ...Object.keys(selected.after ?? {})])].filter(key => key !== 'number') : []
  return <section className={`workspace ${expanded ? 'expanded-workspace' : ''}`}>
    <div className="workspace-head"><div><p className="eyebrow">COMPARE INSTANCES / FILES</p><h2>Record differences</h2></div><button className="expand-view" type="button" aria-pressed={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'Collapse view' : 'Expand view'}</button></div>
    <div className="compare-controls">
      <label>Before<select value={left} onChange={event => { const next = Number(event.target.value); setLeft(next); if (next === right) setRight(left) }}>{results.map((result, index) => <option key={index} value={index}>{index + 1}. {result.fileName}</option>)}</select></label>
      <label>After<select value={right} onChange={event => { const next = Number(event.target.value); setRight(next); if (next === left) setLeft(right) }}>{results.map((result, index) => <option key={index} value={index}>{index + 1}. {result.fileName}</option>)}</select></label>
      <label>Record type<select value={recordType} onChange={event => { setRecordType(event.target.value); setSelectedId('') }}><option value="all">All record types</option>{recordTypes.map(type => <option key={type} value={type}>{recordTypeLabels[type] ?? type}</option>)}</select></label>
      <label>Show<select value={filter} onChange={event => setFilter(event.target.value)}><option value="differences">Differences only</option><option value="all">All records</option>{['added', 'removed', 'changed', 'unchanged'].map(status => <option key={status} value={status}>{status}</option>)}</select></label>
    </div>
    <div className="diff-summary" aria-live="polite">{['added', 'removed', 'changed', 'unchanged'].map(status => <span className={`diff-status ${status}`} key={status}>{rows.filter(row => row.status === status).length} {status}</span>)}</div>
    <p className="compare-note">Compares decoded records using the current decode filters. Record positions are ignored. Database comparison includes revision history, rather than only the latest value of each key.</p>
    {(results[left].errors?.length || results[right].errors?.length) ? <div className="error">One or both files contain decoding issues. This comparison may be incomplete.<pre>{[...(results[left].errors ?? []), ...(results[right].errors ?? [])].join('\n')}</pre></div> : null}
    <div className="record-grid">
      <div className="record-list">{visible.map(row => <button key={row.id} className={`record-row diff-row ${selected?.id === row.id ? 'active' : ''}`} onClick={() => setSelectedId(row.id)}><span>{row.label}</span><span className={`diff-status ${row.status}`}>{row.status}</span></button>)}{!visible.length && <div className="empty">{filter === 'differences' && rows.length && rows.every(row => row.status === 'unchanged') ? 'No differences for the selected record type.' : 'No records match these filters.'}</div>}</div>
      <div className="detail-panel">{selected ? <>
        <div className="detail-head"><h3>{selected.label}</h3><span className={`diff-status ${selected.status}`}>{selected.status}</span></div>
        <div className="diff-table-wrap"><table className="diff-table"><thead><tr><th>Field</th><th>Before · {results[left].fileName}</th><th>After · {results[right].fileName}</th></tr></thead><tbody>{fields.map(field => {
          const before = (selected.before as unknown as Record<string, unknown> | undefined)?.[field]
          const after = (selected.after as unknown as Record<string, unknown> | undefined)?.[field]
          const changed = stableJSON(before) !== stableJSON(after)
          return <tr key={field}><th>{field}</th><td className={changed ? 'diff-before' : ''}><pre>{before === undefined ? '—' : JSON.stringify(before, null, 2)}</pre></td><td className={changed ? 'diff-after' : ''}><pre>{after === undefined ? '—' : JSON.stringify(after, null, 2)}</pre></td></tr>
        })}</tbody></table></div>
      </> : <div className="empty">Select a record to see its before and after values.</div>}</div>
    </div>
  </section>
}
