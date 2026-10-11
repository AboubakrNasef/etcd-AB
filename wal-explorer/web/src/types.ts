export type InspectionMode = 'wal' | 'database'

export type DecodedRecord = {
  number: number
  recordType: string
  term?: number
  index?: number
  revision?: number
  subRevision?: number
  tombstone?: boolean
  entryType?: string
  data?: Record<string, unknown>
  raw?: string
  error?: string
}

export type DecodeResult = {
  fileName: string
  records: DecodedRecord[]
  errors?: string[]
}
