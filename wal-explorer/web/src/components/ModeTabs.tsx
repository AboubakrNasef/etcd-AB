import { useAppStore } from '../store'

export function ModeTabs() {
  const mode = useAppStore((state) => state.mode)
  const loading = useAppStore((state) => state.loading)
  const changeMode = useAppStore((state) => state.changeMode)
  return <nav className="mode-tabs" aria-label="Inspection mode">
    <button disabled={loading} className={mode === 'wal' ? 'active' : ''} onClick={() => changeMode('wal')}>WAL</button>
    <button disabled={loading} className={mode === 'database' ? 'active' : ''} onClick={() => changeMode('database')}>Database</button>
  </nav>
}
