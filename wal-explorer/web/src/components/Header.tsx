export function Header() {
  return <header className="topbar">
    <div><p className="eyebrow">ETCD / STORAGE TOOL</p><h1>WAL Explorer</h1><p className="subtitle">Inspect Raft records and stored etcd keys.</p></div>
    <div className="badge"><span className="dot" /> local-only</div>
  </header>
}
