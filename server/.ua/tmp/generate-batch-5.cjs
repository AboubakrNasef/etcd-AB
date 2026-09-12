const fs = require('fs');
const input = JSON.parse(fs.readFileSync('D:/Programming/0.Practice/etcd/etcd-AB/server/.ua/tmp/ua-file-analyzer-input-5.json','utf8'));
const extract = JSON.parse(fs.readFileSync('D:/Programming/0.Practice/etcd/etcd-AB/server/.ua/tmp/ua-file-extract-results-5.json','utf8'));
const paths = new Set(input.batchFiles.map(x=>x.path));
const nodes = [], edges = [], nodeIds = new Set(), edgeIds = new Set();
const addNode = n => { if (!nodeIds.has(n.id)) { nodeIds.add(n.id); nodes.push(n); } };
const addEdge = (s,t,type,w) => { if (s===t) return; const k=`${s}|${t}|${type}`; if (!edgeIds.has(k)) { edgeIds.add(k); edges.push({source:s,target:t,type,direction:'forward',weight:w}); } };
const base = p => p.split('/').pop().replace(/\.go$/,'');
function fileTags(p) {
  const t=['go'];
  if (p.includes('_test.go')) t.push('test');
  if (p.includes('v3rpc')) t.push('api-handler');
  if (p.includes('/apply/')) t.push('apply','raft');
  if (p.includes('/txn/')) t.push('transaction','mvcc');
  if (p.includes('/version/')) t.push('versioning','cluster');
  if (p.includes('server.go') || p.endsWith('v3_server.go')) t.push('server','coordination');
  if (p.includes('/read/')) t.push('read-path','metrics');
  if (p.includes('corrupt')) t.push('integrity','recovery');
  if (p.includes('lease/')) t.push('lease','coordination');
  if (t.length < 3) t.push('server-support');
  return [...new Set(t)].slice(0,5);
}
function fileSummary(p) {
  if (p.endsWith('server.go')) return 'Implements the core etcd server lifecycle, Raft integration, request application, snapshots, membership changes, and shutdown coordination.';
  if (p.endsWith('v3_server.go')) return 'Provides the v3 server facade for KV, transactions, leases, alarms, authentication, watch access, and downgrade operations.';
  if (p.includes('/txn/')) return `Implements ${base(p).replace(/_/g,' ')} transaction operation logic, validation, metrics, and MVCC request execution.`;
  if (p.includes('/apply/')) return `Implements the ${base(p)} apply-layer component that translates committed Raft requests into storage, membership, alarm, and authentication actions.`;
  if (p.includes('/version/')) return `Defines etcd cluster and storage version state, downgrade coordination, monitoring, errors, and compatibility behavior.`;
  if (p.includes('/v3rpc/')) return `Supports the v3 RPC layer with request validation, context/error handling, and learner compatibility checks.`;
  if (p.includes('/read/')) return `Provides read-path metrics and utility helpers used by the etcd server's linearizable and serializable read handling.`;
  if (p.includes('corrupt_test')) return 'Exercises corruption detection and recovery behavior across the server, backend, MVCC store, leases, and HTTP/RPC surfaces.';
  if (p.includes('lease/')) return 'Defines lease package documentation or queue behavior supporting expiration ordering and lease lifecycle management.';
  return `Implements the ${base(p)} component of the etcd server module.`;
}
function symbolSummary(p,n,kind) {
  const verb = /^Test|^Fuzz/.test(n) ? 'Tests' : 'Implements';
  return `${verb} ${n} in ${base(p)}, covering ${p.includes('/txn/')?'transaction and MVCC':p.includes('/version/')?'cluster version and downgrade':p.includes('/apply/')?'committed-request application':p.includes('server')?'server lifecycle and coordination':'server support'} behavior.`;
}
for (const r of extract.results) {
  const p=r.path, fid=`file:${p}`, ex=new Set((r.exports||[]).map(x=>x.name));
  addNode({id:fid,type:'file',name:base(p),filePath:p,summary:fileSummary(p),tags:fileTags(p),complexity:r.nonEmptyLines>200?'complex':r.nonEmptyLines>=50?'moderate':'simple',languageNotes:'Go code using interfaces, protobuf request types, and explicit server/storage coordination.'});
  for (const c of (r.classes||[])) {
    if ((c.methods||[]).length>=2 || c.endLine-c.startLine+1>=20 || ex.has(c.name)) {
      const id=`class:${p}:${c.name}`;
      addNode({id,type:'class',name:c.name,filePath:p,lineRange:[c.startLine,c.endLine],summary:symbolSummary(p,c.name,'class'),tags:[...fileTags(p),'type-definition'].slice(0,5),complexity:c.endLine-c.startLine+1>100?'complex':'moderate'});
      addEdge(fid,id,'contains',1.0); if (ex.has(c.name)) addEdge(fid,id,'exports',0.8);
    }
  }
  const seen=new Set();
  for (const f of (r.functions||[])) {
    const len=f.endLine-f.startLine+1;
    if (len<10 && !ex.has(f.name)) continue;
    if (seen.has(f.name)) continue; seen.add(f.name);
    const id=`function:${p}:${f.name}`;
    addNode({id,type:'function',name:f.name,filePath:p,lineRange:[f.startLine,f.endLine],summary:symbolSummary(p,f.name,'function'),tags:[...fileTags(p),'operation'].slice(0,5),complexity:len>80?'complex':len>=30?'moderate':'simple'});
    addEdge(fid,id,'contains',1.0); if (ex.has(f.name)) addEdge(fid,id,'exports',0.8);
  }
}
for (const [p, qs] of Object.entries(input.batchImportData)) for (const q of qs) addEdge(`file:${p}`,`file:${q}`,'imports',0.7);
const functionNames = new Map();
for (const r of extract.results) for (const f of (r.functions||[])) if (nodeIds.has(`function:${r.path}:${f.name}`)) functionNames.set(f.name,`function:${r.path}:${f.name}`);
for (const r of extract.results) for (const c of (r.callGraph||[])) {
  const src=functionNames.get(c.caller); const dst=functionNames.get(c.callee) || [...functionNames.entries()].find(([n])=>c.callee.endsWith('.'+n))?.[1];
  if (src && dst) addEdge(src,dst,'calls',0.8);
}
for (const p of paths) if (p.endsWith('_test.go')) { const prod=p.replace(/_test\.go$/,'.go'); if (paths.has(prod)) addEdge(`file:${prod}`,`file:${p}`,'tested_by',0.5); }
fs.writeFileSync('D:/Programming/0.Practice/etcd/etcd-AB/server/.ua/intermediate/batch-5.json',JSON.stringify({nodes,edges},null,2));
const imports=Object.values(input.batchImportData).reduce((n,a)=>n+a.length,0);
console.log(JSON.stringify({files:extract.results.length,nodes:nodes.length,edges:edges.length,imports,importEdges:edges.filter(e=>e.type==='imports').length}));
