import { create } from 'zustand'
import type { DecodeResult, InspectionMode } from './types'
import { combineInstanceResults, type InstanceResult } from './instances'

type SelectedFile = {
  id: string
  file: File
  name: string
  instanceId?: string
  instanceName?: string
}

type AppState = {
  mode: InspectionMode
  files: SelectedFile[]
  results: DecodeResult[]
  entryType: string
  startIndex: string
  endIndex: string
  loading: boolean
  error: string
  view: 'inspect' | 'compare'
  setView: (view: 'inspect' | 'compare') => void
  chooseFiles: (files: File[]) => void
  chooseFolder: (files: File[], name: string) => void
  renameInstance: (id: string, name: string) => void
  removeInstance: (id: string) => void
  renameFile: (id: string, name: string) => void
  removeFile: (id: string) => void
  changeMode: (mode: InspectionMode) => void
  setEntryType: (value: string) => void
  setStartIndex: (value: string) => void
  setEndIndex: (value: string) => void
  inspect: (view?: 'inspect' | 'compare') => Promise<void>
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
  view: 'inspect',
  setView: (view) => set({ view }),
  chooseFiles: (files) => {
    if (!files.length || get().loading) return
    set((state) => ({
      files: [...state.files, ...files.map((file) => ({ id: crypto.randomUUID(), file, name: file.name }))],
      results: [], error: '',
    }))
  },
  chooseFolder: (files, name) => {
    if (!files.length || get().loading) return
    const instanceId = crypto.randomUUID()
    const selected = [...files].sort((a, b) => a.webkitRelativePath.localeCompare(b.webkitRelativePath) || a.name.localeCompare(b.name))
    set(state => ({ files: [...state.files, ...selected.map(file => ({ id: crypto.randomUUID(), file, name: file.name, instanceId, instanceName: name }))], results: [], error: '' }))
  },
  renameInstance: (id, name) => {
    if (get().loading) return
    set(state => ({ files: state.files.map(item => item.instanceId === id ? { ...item, instanceName: name } : item), results: [], error: '' }))
  },
  removeInstance: (id) => {
    if (get().loading) return
    set(state => ({ files: state.files.filter(item => item.instanceId !== id), results: [], error: '' }))
  },
  renameFile: (id, name) => {
    if (get().loading) return
    set((state) => ({
      files: state.files.map((item) => item.id === id ? { ...item, name } : item),
      results: [], error: '',
    }))
  },
  removeFile: (id) => {
    if (get().loading) return
    set((state) => ({ files: state.files.filter((item) => item.id !== id), results: [], error: '' }))
  },
  changeMode: (mode) => set({ mode, files: [], results: [], error: '' }),
  setEntryType: (entryType) => set({ entryType }),
  setStartIndex: (startIndex) => set({ startIndex }),
  setEndIndex: (endIndex) => set({ endIndex }),
  inspect: async (view = 'inspect') => {
    const { files, mode, entryType, startIndex, endIndex } = get()
    if (!files.length || get().loading) return
    set({ loading: true, error: '' })
    const query = new URLSearchParams()
    if (entryType !== 'all') query.set('entryType', entryType)
    if (startIndex) query.set('startIndex', startIndex)
    if (endIndex) query.set('endIndex', endIndex)
    try {
      const decoded: InstanceResult[] = []
      const errors: string[] = []
      for (const { file, name, instanceId, instanceName } of files) {
        const displayName = name.trim() || file.name
        try {
          const form = new FormData()
          form.append('file', file)
          const endpoint = mode === 'wal' ? `/api/decode?${query}` : '/api/inspect-db'
          const response = await fetch(endpoint, { method: 'POST', body: form })
          const payload = (await response.json()) as DecodeResult | { error?: string }
          if (!response.ok) throw new Error(('error' in payload && payload.error) || `Unable to inspect ${mode === 'wal' ? 'WAL' : 'database'}`)
          decoded.push({ instanceId, instanceName, result: { ...(payload as DecodeResult), fileName: displayName } })
        } catch (reason) {
          const message = reason instanceof Error ? reason.message : 'Unable to inspect file'
          errors.push(`${instanceName ? `${instanceName} / ` : ''}${displayName}: ${message}`)
          if (instanceId) decoded.push({ instanceId, instanceName, result: { fileName: displayName, records: [], errors: [message] } })
        }
      }
      set({ results: combineInstanceResults(decoded), view, error: errors.join('\n') })
    } finally {
      set({ loading: false })
    }
  },
}))
