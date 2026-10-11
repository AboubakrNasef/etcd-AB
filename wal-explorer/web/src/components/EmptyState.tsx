import { useAppStore } from '../store'

export function EmptyState() {
  const mode = useAppStore((state) => state.mode)
  const isWal = mode === 'wal'
  return <section className="empty-state">
    <div className="empty-icon">&#x2301;</div>
    <h2>{isWal ? 'Your decoded records will appear here' : 'Database records will appear here'}</h2>
    <p>{isWal ? 'Pick a WAL segment above to see metadata, Raft state, entries, snapshots, CRCs, and decoded internal requests.' : 'Choose a copied etcd database to browse its stored keys, values, and revisions.'}</p>
  </section>
}
