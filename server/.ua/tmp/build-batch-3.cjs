const fs = require('fs');
const path = require('path');
const root = 'D:/Programming/0.Practice/etcd/etcd-AB/server';
const ua = root + '/.ua';
const inp = JSON.parse(fs.readFileSync(ua + '/tmp/ua-file-analyzer-input-3.json','utf8'));
const ext = JSON.parse(fs.readFileSync(ua + '/tmp/ua-file-extract-results-3.json','utf8'));
const imports = inp.batchImportData;
const batchPaths = new Set(inp.batchFiles.map(f=>f.path));
const byPath = new Map(ext.results.map(f=>[f.path,f]));
const exported = new Map();
for (const f of ext.results) exported.set(f.path, new Set((f.exports||[]).map(e=>e.name)));
const nodes = [], edges = [], nodeIds = new Set();
const addNode = n => { if (!nodeIds.has(n.id)) { nodes.push(n); nodeIds.add(n.id); } };
const addEdge = (s,t,type,weight) => { if (s===t) return; edges.push({source:s,target:t,type,direction:'forward',weight}); };
const tagsFor = (p) => {
  const test = /(^|_)test\.go$/.test(p) || p.endsWith('_test.go');
  if (p.includes('/mvcc/')) return test ? ['test','mvcc','storage','transactions'] : ['mvcc','storage','persistence','transactions'];
  if (p.includes('/schema/')) return test ? ['test','schema','backend','persistence'] : ['schema','backend','persistence','serialization'];
  if (p.includes('/quota')) return ['quota','storage','limits','backend'];
  if (p.startsWith('verify/')) return ['verification','storage','consistency','wal'];
  return ['go','storage','backend'];
};
const fileSummary = (p) => {
  if (p.endsWith('_test.go')) return 'Tests the ' + p.replace(/.*\//,'').replace('_test.go','') + ' storage behavior, including persistence, transactions, and edge cases.';
  if (p.includes('kvstore_compaction')) return 'Schedules MVCC compaction, removes obsolete revisions from the backend, records compaction metrics, and updates compaction state.';
  if (p.endsWith('kvstore_txn.go')) return 'Implements MVCC read and write transactions, including revision-aware range, put, delete, and change tracking operations.';
  if (p.endsWith('watchable_store.go')) return 'Provides the watchable MVCC store, coordinating watcher registration, event delivery, progress notifications, victims, restoration, and synchronization.';
  if (p.endsWith('store.go') && p.includes('/mvcc/')) return 'Persists scheduled and completed MVCC compaction revisions in the backend metadata bucket.';
  if (p.endsWith('quota.go')) return 'Defines backend quota interfaces and calculates request costs and remaining capacity for puts and transactions.';
  if (p.includes('/schema/')) return 'Defines backend persistence helpers for ' + p.split('/').pop().replace('.go','').replace('_',' ') + ' data, including safe reads, writes, and bucket management.';
  if (p.startsWith('verify/')) return 'Verifies persisted etcd state by checking backend consistency, WAL validity, and configured verification invariants.';
  return 'Provides storage-layer implementation and test support for the etcd server.';
};
const complexity = f => f.nonEmptyLines > 200 ? 'complex' : (f.nonEmptyLines >= 50 ? 'moderate' : 'simple');
for (const f of ext.results) {
  const p=f.path;
  addNode({id:'file:'+p,type:'file',name:path.basename(p),filePath:p,summary:fileSummary(p),tags:tagsFor(p),complexity:complexity(f),languageNotes:'Go implementation using backend transactions and protobuf-backed storage structures.'});
}
const funcNodes = new Map();
const classNodes = new Map();
for (const f of ext.results) {
  const exp = exported.get(f.path);
  const seen = new Set();
  for (const fn of (f.functions||[])) {
    if (seen.has(fn.name)) continue;
    seen.add(fn.name);
    const significant = (fn.endLine-fn.startLine+1 >= 10) || exp.has(fn.name);
    if (!significant) continue;
    const id='function:'+f.path+':'+fn.name;
    const stem=fn.name.replace(/^Benchmark/,'').replace(/^Test/,'').replace(/^Unsafe/,'').replace(/^Must/,'');
    addNode({id,type:'function',name:fn.name,filePath:f.path,lineRange:[fn.startLine,fn.endLine],summary:'Implements '+(stem||fn.name)+' behavior for this storage component.',tags: f.path.endsWith('_test.go')?['test','validation','storage']:['storage','backend','operation'],complexity:(fn.endLine-fn.startLine+1)>40?'complex':(fn.endLine-fn.startLine+1)>20?'moderate':'simple'});
    funcNodes.set(f.path+':'+fn.name,id);
    addEdge('file:'+f.path,id,'contains',1.0);
    if (exp.has(fn.name)) addEdge('file:'+f.path,id,'exports',0.8);
  }
  for (const c of (f.classes||[])) {
    if (classNodes.has(f.path+':'+c.name)) continue;
    const isExported=exp.has(c.name);
    const significant=isExported || c.methods?.length>=2 || (c.endLine-c.startLine+1>=20);
    if (!significant) continue;
    const id='class:'+f.path+':'+c.name;
    addNode({id,type:'class',name:c.name,filePath:f.path,lineRange:[c.startLine,c.endLine],summary:'Defines the '+c.name+' storage abstraction and its associated state.',tags:['storage','type-definition','backend'],complexity:(c.endLine-c.startLine+1)>50?'complex':'moderate'});
    classNodes.set(f.path+':'+c.name,id);
    addEdge('file:'+f.path,id,'contains',1.0);
    if (isExported) addEdge('file:'+f.path,id,'exports',0.8);
  }
}
for (const f of ext.results) {
  const source='file:'+f.path;
  for (const target of (imports[f.path]||[])) addEdge(source,'file:'+target,'imports',0.7);
}
const allFuncByName = new Map();
for (const [k,id] of funcNodes) { const n=k.slice(k.indexOf(':')+1); const name=n.slice(n.indexOf(':')+1); if(!allFuncByName.has(name)) allFuncByName.set(name,[]); allFuncByName.get(name).push(id); }
for (const f of ext.results) {
  for (const cg of (f.callGraph||[])) {
    const caller=funcNodes.get(f.path+':'+cg.caller); if(!caller) continue;
    const callee=cg.callee.split('.').pop();
    const targets=(allFuncByName.get(callee)||[]).filter(x=>!x.startsWith('function:'+f.path+':'));
    if (targets.length===1) addEdge(caller,targets[0],'calls',0.8);
  }
}
for (const f of ext.results) {
  if (!f.path.endsWith('_test.go')) continue;
  const prod=f.path.replace(/_test\.go$/,'.go');
  if (batchPaths.has(prod)) addEdge('file:'+prod,'file:'+f.path,'tested_by',0.5);
}
const sorted=inp.batchFiles.map(x=>x.path).sort();
const parts=Math.ceil(Math.max(nodes.length/60,edges.length/120));
const per=Math.ceil(sorted.length/parts);
for(let i=0;i<parts;i++){
  const paths=new Set(sorted.slice(i*per,(i+1)*per));
  const ns=nodes.filter(n=>paths.has(n.filePath));
  const ids=new Set(ns.map(n=>n.id));
  const es=edges.filter(e=>ids.has(e.source));
  fs.writeFileSync(ua+'/intermediate/batch-3-part-'+(i+1)+'.json',JSON.stringify({nodes:ns,edges:es},null,2));
}
console.log(JSON.stringify({files:ext.filesAnalyzed,nodes:nodes.length,edges:edges.length,imports:edges.filter(e=>e.type==='imports').length,parts}));

