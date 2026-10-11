import { create } from 'zustand'
import type { DecodeResult, DecodedRecord, InspectionMode } from './types'

type AppState = {
  mode: InspectionMode
  file: File | null
  result: DecodeResult | null
  selected: DecodedRecord | null
  entryType: string
  startIndex: string
  endIndex: string
  search: string
  loading: boolean
  error: string
  chooseFile: (file: File | null) => void
  changeMode: (mode: InspectionMode) => void
  setEntryType: (value: string) => void
  setStartIndex: (value: string) => void
  setEndIndex: (value: string) => void
  setSearch: (value: string) => void
  selectRecord: (record: DecodedRecord) => void
  inspect: () => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
  mode: 'wal',
  file: null,
  result: null,
  selected: null,
  entryType: 'all',
  startIndex: '',
  endIndex: '',
  search: '',
  loading: false,
  error: '',
  chooseFile: (file) => set({ file }),
  changeMode: (mode) => set({ mode, file: null, result: null, selected: null, search: '', error: '' }),
  setEntryType: (entryType) => set({ entryType }),
  setStartIndex: (startIndex) => set({ startIndex }),
  setEndIndex: (endIndex) => set({ endIndex }),
  setSearch: (search) => set({ search }),
  selectRecord: (selected) => set({ selected }),
  inspect: async () => {
    const { file, mode, entryType, startIndex, endIndex } = get()
    if (!file) return
    set({ loading: true, error: '' })
    const form = new FormData()
    form.append('file', file)
    const query = new URLSearchParams()
    if (entryType !== 'all') query.set('entryType', entryType)
    if (startIndex) query.set('startIndex', startIndex)
    if (endIndex) query.set('endIndex', endIndex)
    try {
      const endpoint = mode === 'wal' ? `/api/decode?${query}` : '/api/inspect-db'
      const response = await fetch(endpoint, { method: 'POST', body: form })
      const payload = (await response.json()) as DecodeResult | { error?: string }
      if (!response.ok) throw new Error(('error' in payload && payload.error) || `Unable to inspect ${mode === 'wal' ? 'WAL' : 'database'}`)
      const result = payload as DecodeResult
      set({ result, selected: result.records[0] ?? null })
    } catch (reason) {
      set({ error: reason instanceof Error ? reason.message : `Unable to inspect ${mode === 'wal' ? 'WAL' : 'database'}`, result: null, selected: null })
    } finally {
      set({ loading: false })
    }
  },
}))
