import { ConfigPanel } from './components/ConfigPanel'
import { ComparePanel } from './components/ComparePanel'
import { EmptyState } from './components/EmptyState'
import { FilePanel } from './components/FilePanel'
import { Header } from './components/Header'
import { ModeTabs } from './components/ModeTabs'
import { ResultsPanel } from './components/ResultsPanel'
import { useAppStore } from './store'

export default function App() {
  const results = useAppStore((state) => state.results)
  const view = useAppStore((state) => state.view)
  const setView = useAppStore((state) => state.setView)
  const loading = useAppStore((state) => state.loading)

  return <main className="shell">
    <Header />
    <ModeTabs />
    <section className="hero-grid">
      <FilePanel />
      <ConfigPanel />
    </section>
    {!!results.length && <nav className="result-tabs" aria-label="Result view"><button disabled={loading} aria-pressed={view === 'inspect'} onClick={() => setView('inspect')}>Inspect</button><button disabled={loading || results.length < 2} aria-pressed={view === 'compare'} onClick={() => setView('compare')}>Compare</button></nav>}
    {results.length ? view === 'compare' ? <ComparePanel key={JSON.stringify(results.map(result => result.fileName))} results={results} /> : <div className="comparison-grid">{results.map((result, index) => <ResultsPanel key={`${result.fileName}-${index}`} result={result} />)}</div> : <EmptyState />}
    <footer>WAL Explorer · etcd files are read only and are never written back to disk</footer>
  </main>
}
