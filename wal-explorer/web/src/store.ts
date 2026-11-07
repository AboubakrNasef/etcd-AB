import { create } from 'zustand'
import type { DecodeResult, InspectionMode } from './types'

type AppState = {
  mode: InspectionMode
  files: File[]
  results: DecodeResult[]
  entryType: string
  startIndex: string
  endIndex: string
  loading: boolean
  error: string
  chooseFiles: (files: File[]) => void
  changeMode: (mode: InspectionMode) => void
  setEntryType: (value: string) => void
  setStartIndex: (value: string) => void
  setEndIndex: (value: string) => void
  inspect: () => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
  mode: 'wal',
  files: [],
  results: [],
  entryType: 'all',
  startIndex: '',
  endIndex: '',
  loading: false,
  error: '',
  chooseFiles: (files) => set({ files, results: [], error: '' }),
  changeMode: (mode) => set({ mode, files: [], results: [], error: '' }),
  setEntryType: (entryType) => set({ entryType }),
  setStartIndex: (startIndex) => set({ startIndex }),
  setEndIndex: (endIndex) => set({ endIndex }),
  inspect: async () => {
    const { files, mode, entryType, startIndex, endIndex } = get()
    if (!files.length) return
    set({ loading: true, error: '' })
    const query = new URLSearchParams()
    if (entryType !== 'all') query.set('entryType', entryType)
    if (startIndex) query.set('startIndex', startIndex)
    if (endIndex) query.set('endIndex', endIndex)
    try {
      const results: DecodeResult[] = []
      const errors: string[] = []
      for (const file of files) {
        try {
          const form = new FormData()
          form.append('file', file)
          const endpoint = mode === 'wal' ? `/api/decode?${query}` : '/api/inspect-db'
          const response = await fetch(endpoint, { method: 'POST', body: form })
          const payload = (await response.json()) as DecodeResult | { error?: string }
          if (!response.ok) throw new Error(('error' in payload && payload.error) || `Unable to inspect ${mode === 'wal' ? 'WAL' : 'database'}`)
          results.push(payload as DecodeResult)
        } catch (reason) {
          errors.push(`${file.name}: ${reason instanceof Error ? reason.message : 'Unable to inspect file'}`)
        }
      }
      set({ results, error: errors.join('\n') })
    } finally {
      set({ loading: false })
    }
  },
}))
