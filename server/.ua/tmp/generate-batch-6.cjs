const fs = require('fs');
const path = require('path');
const root = 'D:/Programming/0.Practice/etcd/etcd-AB/server';
const input = JSON.parse(fs.readFileSync(path.join(root, 'batch-6-input.json'), 'utf8'));
const extract = JSON.parse(fs.readFileSync(path.join(root, 'batch-6-extract.json'), 'utf8'));
const paths = new Set(input.batchFiles.map(x => x.path));
const nodes = [], edges = [], nodeIds = new Set(), edgeIds = new Set();
const addNode = n => { if (!nodeIds.has(n.id)) { nodeIds.add(n.id); nodes.push(n); } };
const addEdge = (source, target, type, weight) => {
  if (source === target) return;
  const key = `${source}|${target}|${type}`;
  if (!edgeIds.has(key)) { edgeIds.add(key); edges.push({source, target, type, direction:'forward', weight}); }
};
const base = p => p.split('/').pop().replace(/\.go$/, '');
const domain = p => p.includes('leasehttp') ? 'lease HTTP management' : p.includes('/lease/') ? 'lease lifecycle and expiration' : p.includes('grpcproxy') ? 'gRPC proxy watch forwarding' : 'MVCC indexing, revisions, storage, and watch delivery';
function tags(p) {
  const t = ['go'];
  if (p.includes('_test.go')) t.push('test');
  if (p.includes('bench_test.go')) t.push('benchmark');
  if (p.includes('lease')) t.push('lease');
  if (p.includes('mvcc')) t.push('mvcc');
  if (p.includes('watch')) t.push('watch');
  if (p.includes('index')) t.push('indexing');
  if (p.includes('metrics')) t.push('monitoring');
  if (p.includes('http.go')) t.push('api-handler');
  return [...new Set(t)].slice(0, 5);
}
function fileSummary(p) {
  if (p === 'lease/leasehttp/http.go') return 'Implements the internal HTTP handlers that expose lease time-to-live and lease listing operations for server and peer-facing endpoints.';
  if (p === 'proxy/grpcproxy/watcher.go') return 'Adapts gRPC watch streams in the proxy, tracking client watchers and forwarding events from shared watch ranges.';
  if (p === 'storage/mvcc/index.go') return 'Defines the MVCC key index that maps user keys to revision histories and supports point/range revision lookup.';
  if (p === 'storage/mvcc/key_index.go') return 'Maintains a key’s ordered revision history, including puts, tombstones, compaction pruning, and historical lookup.';
  if (p === 'storage/mvcc/kv.go') return 'Defines MVCC key-value records and comparison helpers used to encode, decode, hash, and order stored revisions.';
  if (p === 'storage/mvcc/kv_view.go') return 'Provides read-only MVCC view helpers for retrieving current or historical key values and converting revisions to protobuf records.';
  if (p === 'storage/mvcc/watcher.go') return 'Implements individual MVCC watch streams, lifecycle management, event delivery, and cancellation semantics.';
  if (p === 'storage/mvcc/watcher_group.go') return 'Groups watchers by key and event filters, constructing batches that efficiently fan out MVCC events.';
  if (p.includes('_test.go')) return `Tests ${domain(p)} behavior, including edge cases and concurrency-sensitive invariants.`;
  if (p.endsWith('doc.go')) return `Documents the ${p.split('/').slice(-2,-1)[0] || 'server'} Go package.`;
  if (p.includes('metrics')) return `Defines Prometheus metrics for ${domain(p)} instrumentation.`;
  if (p.includes('revision.go')) return 'Defines MVCC revision identifiers and ordering helpers used throughout the storage index.';
  if (p.includes('testutil/hash.go')) return 'Provides test helpers for hashing MVCC key-value responses and comparing hash results.';
  return `Supports ${domain(p)} in the etcd server module.`;
}
function symbolSummary(p, name) {
  const test = /^Test|^Benchmark|^Fuzz/.test(name);
  return `${test ? 'Tests' : 'Implements'} ${name}, supporting ${domain(p)} behavior.`;
}
for (const r of extract.results) {
  const p = r.path, fid = `file:${p}`, ex = new Set((r.exports || []).map(x => x.name));
  addNode({id:fid,type:'file',name:base(p),filePath:p,summary:fileSummary(p),tags:tags(p),complexity:r.nonEmptyLines>200?'complex':r.nonEmptyLines>=50?'moderate':'simple',languageNotes:'Go code using interfaces, protobuf messages, ordered indexes, channels, mutexes, and Prometheus instrumentation.'});
  for (const c of (r.classes || [])) {
    const len = c.endLine - c.startLine + 1;
    if ((c.methods || []).length >= 2 || len >= 20 || ex.has(c.name)) {
      const id = `class:${p}:${c.name}`;
      addNode({id,type:'class',name:c.name,filePath:p,lineRange:[c.startLine,c.endLine],summary:symbolSummary(p,c.name),tags:[...tags(p),'type-definition'].slice(0,5),complexity:len>100?'complex':'moderate'});
      addEdge(fid,id,'contains',1.0); if (ex.has(c.name)) addEdge(fid,id,'exports',0.8);
    }
  }
  const seen = new Set();
  for (const f of (r.functions || [])) {
    const len = f.endLine - f.startLine + 1;
    if (len < 10 && !ex.has(f.name)) continue;
    if (seen.has(f.name)) continue;
    seen.add(f.name);
    const id = `function:${p}:${f.name}`;
    addNode({id,type:'function',name:f.name,filePath:p,lineRange:[f.startLine,f.endLine],summary:symbolSummary(p,f.name),tags:[...tags(p),'operation'].slice(0,5),complexity:len>80?'complex':len>=30?'moderate':'simple'});
    addEdge(fid,id,'contains',1.0); if (ex.has(f.name)) addEdge(fid,id,'exports',0.8);
  }
}
for (const [p, imports] of Object.entries(input.batchImportData || {})) for (const q of imports) addEdge(`file:${p}`, `file:${q}`, 'imports', 0.7);
const fnByFileName = new Map();
for (const r of extract.results) for (const f of (r.functions || [])) if (nodeIds.has(`function:${r.path}:${f.name}`)) fnByFileName.set(`${r.path}:${f.name}`, `function:${r.path}:${f.name}`);
const candidates = name => [...fnByFileName.entries()].filter(([k]) => k.endsWith(`:${name}`)).map(([,v]) => v);
for (const r of extract.results) for (const c of (r.callGraph || [])) {
  const src = fnByFileName.get(`${r.path}:${c.caller}`);
  const local = fnByFileName.get(`${r.path}:${c.callee}`);
  const dst = local || (candidates(c.callee).length === 1 ? candidates(c.callee)[0] : null);
  if (src && dst) addEdge(src, dst, 'calls', 0.8);
}
for (const p of paths) if (p.endsWith('_test.go')) {
  const prod = p.replace(/_test\.go$/, '.go');
  if (paths.has(prod)) addEdge(`file:${prod}`, `file:${p}`, 'tested_by', 0.5);
}
fs.writeFileSync(path.join(root, '.ua', 'intermediate', 'batch-6.json'), JSON.stringify({nodes,edges}, null, 2));
console.log(JSON.stringify({files:extract.results.length,nodes:nodes.length,edges:edges.length,imports:edges.filter(e=>e.type==='imports').length,calls:edges.filter(e=>e.type==='calls').length,testedBy:edges.filter(e=>e.type==='tested_by').length}));
