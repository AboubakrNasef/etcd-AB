import type { DecodedRecord } from './types'

export type DiffStatus = 'added' | 'removed' | 'changed' | 'unchanged'
export type RecordDiff = { id: string; label: string; status: DiffStatus; before?: DecodedRecord; after?: DecodedRecord }

export function stableJSON(value: unknown): string {
  return JSON.stringify(normalize(value)) ?? 'undefined'
}
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, normalize(item)]))
  return value
}
function content(record: DecodedRecord): unknown {
  const { number: _number, ...rest } = record
  return rest
}
function identify(records: DecodedRecord[]) {
  const counts = new Map<string, number>()
  return records.map(record => {
    const key = record.recordType === 'entry' && record.index !== undefined
      ? `Entry #${record.index}`
      : record.recordType === 'keyValue'
        ? `Revision ${record.revision ?? 0}.${record.subRevision ?? 0} · ${String(record.data?.key ?? '')}`
        : record.recordType
    const occurrence = counts.get(key) ?? 0
    counts.set(key, occurrence + 1)
    return { id: JSON.stringify([key, occurrence]), label: `${key}${occurrence ? ` (${occurrence + 1})` : ''}`, record }
  })
}
export function compareRecords(before: DecodedRecord[], after: DecodedRecord[]): RecordDiff[] {
  const left = identify(before)
  const right = identify(after)
  const remaining = new Map(right.map(item => [item.id, item]))
  const rows: RecordDiff[] = left.map(item => {
    const match = remaining.get(item.id)
    remaining.delete(item.id)
    return { id: item.id, label: item.label, before: item.record, after: match?.record,
      status: !match ? 'removed' : stableJSON(content(item.record)) === stableJSON(content(match.record)) ? 'unchanged' : 'changed' }
  })
  for (const item of remaining.values()) rows.push({ id: item.id, label: item.label, after: item.record, status: 'added' })
  return rows
}
