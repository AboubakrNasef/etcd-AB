import { ConfigPanel } from './components/ConfigPanel'
import { EmptyState } from './components/EmptyState'
import { FilePanel } from './components/FilePanel'
import { Header } from './components/Header'
import { ModeTabs } from './components/ModeTabs'
import { ResultsPanel } from './components/ResultsPanel'
import { useAppStore } from './store'

export default function App() {
  const hasResult = useAppStore((state) => state.result !== null)

  return <main className="shell">
    <Header />
    <ModeTabs />
    <section className="hero-grid">
      <FilePanel />
      <ConfigPanel />
    </section>
    {hasResult ? <ResultsPanel /> : <EmptyState />}
    <footer>WAL Explorer · etcd files are read only and are never written back to disk</footer>
  </main>
}
