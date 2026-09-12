const fs = require('fs');
const input = JSON.parse(fs.readFileSync('D:/Programming/0.Practice/etcd/etcd-AB/server/.ua/tmp/ua-file-analyzer-input-2.json','utf8'));
const extract = JSON.parse(fs.readFileSync('D:/Programming/0.Practice/etcd/etcd-AB/server/extract-results-2.json','utf8'));
const paths = new Set(input.batchFiles.map(x=>x.path));
const nodes = [], edges = [], ids = new Set();
const addNode = n => { if (!ids.has(n.id)) { ids.add(n.id); nodes.push(n); } };
const base = p => p.split('/').pop().replace(/\.go$/,'');
function tags(p){
  const t = ['go']; if (p.includes('_test.go')) t.push('test');
  if (p.includes('backend')) t.push('storage','transaction');
  if (p.includes('lease')) t.push('lease','coordination');
  if (p.includes('mvcc')) t.push('mvcc','storage');
  if (p.includes('maintenance')) t.push('api-handler','maintenance');
  if (p.includes('alarm')) t.push('alarm','state');
  if (p.includes('cindex')) t.push('consistent-index','storage');
  return [...new Set(t)].slice(0,5);
}
function summary(p, kind, name){
  const b=base(p);
  if (kind==='file') return `Implements the ${b} component of etcd's server-side ${p.includes('backend')||p.includes('mvcc')?'storage':'service'} subsystem.`;
  if (kind==='class') return `Defines the ${name} abstraction used by ${b} for ${p.includes('backend')?'backend transactions and persistence':'server coordination and request handling'}.`;
  return `Provides the ${name} operation in ${b}, handling ${p.includes('lease')?'lease lifecycle and persistence':p.includes('backend')?'backend transaction and storage behavior':p.includes('maintenance')?'maintenance RPC processing':p.includes('alarm')?'alarm state management':p.includes('cindex')?'consistent-index bookkeeping':'server support logic'}.`;
}
const edge=(s,t,type,w)=>{ if(s!==t) edges.push({source:s,target:t,type,direction:'forward',weight:w}); };
for (const r of extract.results) {
  const p=r.path, fid=`file:${p}`;
  addNode({id:fid,type:'file',name:p,summary:summary(p,'file'),tags:tags(p),filePath:p,languageNotes:r.metrics?.importCount===0?'Go structural extraction reported no direct imports; relationships are represented from the supplied batch import map.':undefined});
  const ex=new Set((r.exports||[]).map(x=>x.name));
  for (const c of (r.classes||[])) {
    if ((c.methods||[]).length>=2 || c.endLine-c.startLine+1>=20 || ex.has(c.name)) {
      const id=`class:${p}:${c.name}`;
      addNode({id,type:'class',name:c.name,summary:summary(p,'class',c.name),tags:[...tags(p),'type-definition'].slice(0,5),filePath:p,lineRange:[c.startLine,c.endLine]}); edge(fid,id,'contains',1.0);
      if(ex.has(c.name)) edge(fid,id,'exports',0.8);
    }
  }
  const seen=new Set();
  for (const f of (r.functions||[])) {
    const len=f.endLine-f.startLine+1; if(len<10 && !ex.has(f.name)) continue;
    if(seen.has(f.name)) continue; seen.add(f.name);
    const id=`function:${p}:${f.name}`;
    addNode({id,type:'function',name:f.name,summary:summary(p,'function',f.name),tags:[...tags(p),'operation'].slice(0,5),filePath:p,lineRange:[f.startLine,f.endLine]}); edge(fid,id,'contains',1.0);
    if(ex.has(f.name)) edge(fid,id,'exports',0.8);
  }
}
// Resolved project-internal imports from the dispatch import map, restricted to this batch.
const imports={
 'etcdserver/api/v3rpc/maintenance.go':['etcdserver/adapters.go','etcdserver/apply/auth_test.go','etcdserver/apply/quota.go','storage/backend.go','storage/backend/backend.go','storage/hooks.go','storage/mvcc/hash.go','storage/mvcc/kvstore.go'],
 'etcdserver/apply/auth_test.go':['etcdserver/api/v3alarm/alarms.go','etcdserver/cindex/cindex.go','lease/lease.go','lease/lessor.go','storage/backend/backend.go','storage/mvcc/hash.go','storage/mvcc/kvstore.go'],
 'etcdserver/apply/quota.go':['storage/backend.go','storage/backend/backend.go','storage/hooks.go'],
 'etcdserver/cindex/cindex.go':['storage/backend/backend.go'],
 'etcdserver/cindex/cindex_test.go':['storage/backend/backend.go'],
 'lease/lease.go':['lease/leasepb/lease.pb.go','storage/backend/backend.go'],
 'lease/lessor.go':['lease/leasepb/lease.pb.go','storage/backend/backend.go'],
 'lease/lessor_test.go':['storage/backend/backend.go'],
 'storage/backend.go':['storage/backend/backend.go'],
 'storage/backend/backend_bench_test.go':['storage/backend/testing/betesting.go'],
 'storage/backend/backend_test.go':['storage/backend/backend.go','storage/backend/testing/betesting.go'],
 'storage/backend/batch_tx_test.go':['storage/backend/batch_tx.go','storage/backend/backend.go','storage/backend/testing/betesting.go'],
 'storage/backend/hooks_test.go':['storage/backend/hooks.go','storage/backend/backend.go'],
 'storage/backend/testing/betesting.go':['storage/backend/backend.go','storage/backend/batch_tx.go','storage/backend/read_tx.go'],
 'storage/backend/verify_test.go':['storage/backend/verify.go','storage/backend/backend.go'],
 'storage/hooks.go':['etcdserver/cindex/cindex.go','storage/backend/backend.go'],
 'storage/mvcc/hash.go':['storage/backend/backend.go'],
 'storage/mvcc/kvstore.go':['lease/lease.go','storage/backend/backend.go']
};
for (const [p,qs] of Object.entries(imports)) for(const q of qs) if(paths.has(q)) edge(`file:${p}`,`file:${q}`,'imports',0.7);
// Tests exercise the corresponding production file when both are in this batch.
for (const p of paths) if(p.endsWith('_test.go')) { const prod=p.replace(/_test\.go$/,'.go'); if(paths.has(prod)) edge(`file:${prod}`,`file:${p}`,'tested_by',0.5); }
const cleanNodes=nodes.map(n=>{if(n.languageNotes===undefined) delete n.languageNotes; return n;});
fs.writeFileSync('D:/Programming/0.Practice/etcd/etcd-AB/server/.ua/intermediate/batch-2.json',JSON.stringify({nodes:cleanNodes,edges},null,2));
console.log(JSON.stringify({files:extract.results.length,nodes:cleanNodes.length,edges:edges.length}));
