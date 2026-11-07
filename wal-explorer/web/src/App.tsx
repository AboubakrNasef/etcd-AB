import { ConfigPanel } from './components/ConfigPanel'
import { EmptyState } from './components/EmptyState'
import { FilePanel } from './components/FilePanel'
import { Header } from './components/Header'
import { ModeTabs } from './components/ModeTabs'
import { ResultsPanel } from './components/ResultsPanel'
import { useAppStore } from './store'

export default function App() {
  const results = useAppStore((state) => state.results)

  return <main className="shell">
    <Header />
    <ModeTabs />
    <section className="hero-grid">
      <FilePanel />
      <ConfigPanel />
    </section>
    {results.length ? <div className="comparison-grid">{results.map((result, index) => <ResultsPanel key={`${result.fileName}-${index}`} result={result} />)}</div> : <EmptyState />}
    <footer>WAL Explorer · etcd files are read only and are never written back to disk</footer>
  </main>
}
