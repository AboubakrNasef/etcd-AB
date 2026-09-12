const fs = require('fs');
const path = require('path');
const root = 'D:/Programming/0.Practice/etcd/etcd-AB/server';
const ua = root + '/.ua';
const inp = JSON.parse(fs.readFileSync(ua + '/tmp/ua-file-analyzer-input-10.json', 'utf8'));
const ext = JSON.parse(fs.readFileSync(root + '/extract-results-10.json', 'utf8'));
const batchPaths = new Set(inp.batchFiles.map(f => f.path));
const imports = inp.batchImportData;
const nodes = [], edges = [], ids = new Set();
const addNode = n => { if (!ids.has(n.id)) { ids.add(n.id); nodes.push(n); } };
const addEdge = (source, target, type, weight) => { if (source !== target) edges.push({source, target, type, direction: 'forward', weight}); };
const isTest = p => p.endsWith('_test.go');
const complexity = f => f.nonEmptyLines > 200 ? 'complex' : f.nonEmptyLines >= 50 ? 'moderate' : 'simple';
function tags(p) {
  if (p.includes('server_access_control')) return isTest(p) ? ['test','security','access-control','validation'] : ['security','access-control','cors','validation'];
  if (p.includes('snapshot_merge')) return ['snapshot','storage','merge','backend'];
  if (p.includes('tracing')) return ['tracing','observability','request','serialization'];
  if (p.endsWith('zap_raft.go') || p.endsWith('zap_raft_test.go')) return isTest(p) ? ['test','raft','logging','validation'] : ['raft','logging','zap','observability'];
  if (p.includes('features/')) return ['feature-gates','configuration','server','capability'];
  if (p.startsWith('mock/')) return isTest(p) ? ['test','mock','recorder','support'] : ['mock','recorder','interface','support'];
  if (p.includes('grpcproxy/adapter')) return isTest(p) ? ['test','grpc','proxy','adapter'] : ['grpc','proxy','adapter','client'];
  if (p.includes('grpcproxy/watch.go')) return ['grpc','proxy','watch','streaming'];
  if (p === 'storage/metrics.go') return ['metrics','storage','prometheus','observability'];
  if (p.includes('quota_test')) return ['test','quota','storage','validation'];
  if (p === 'storage/util.go') return ['storage','raft','wal','membership'];
  if (p.startsWith('verify/')) return ['documentation','verification','storage','consistency'];
  if (isTest(p)) return ['test','server','raft','integration'];
  return ['go','server','support','coordination'];
}
function summary(p) {
  const n = path.basename(p, '.go');
  if (p === 'etcdserver/server_access_control.go') return 'Defines HTTP access-control checks for CORS origins and host allowlists used by the embedded etcd server.';
  if (p === 'etcdserver/server_access_control_test.go') return 'Tests CORS origin matching and host allowlist behavior, including empty and configured policy cases.';
  if (p === 'etcdserver/server_test.go') return 'Comprehensive etcd server integration tests covering apply/restart behavior, snapshots, membership changes, publishing, raft mocks, readiness, and feature-gate metrics.';
  if (p === 'etcdserver/snapshot_merge.go') return 'Combines snapshot metadata and database content into a merged snapshot stream while coordinating temporary readers and cleanup.';
  if (p === 'etcdserver/tracing.go') return 'Provides small key-extraction helpers used to identify request fields for tracing and comparison logic.';
  if (p === 'etcdserver/util.go') return 'Implements server utility predicates for quorum connectivity, request-size limits, priority classification, and connection-duration analysis.';
  if (p === 'etcdserver/util_test.go') return 'Tests server connectivity-duration and request-limit utilities with a controllable raft transport test double.';
  if (p === 'etcdserver/zap_raft.go') return 'Adapts zap logging to the raft logger interface, including leveled formatting and structured error, fatal, and panic methods.';
  if (p === 'etcdserver/zap_raft_test.go') return 'Verifies raft logger construction and zap-core integration across the logger adapter methods.';
  if (p === 'features/etcd_features.go') return 'Constructs the default server feature gate configuration used to control optional etcd capabilities.';
  if (p === 'storage/metrics.go') return 'Registers Prometheus metrics for the storage subsystem.';
  if (p === 'storage/quota_test.go') return 'Tests quota cost calculations for put operations and transactional request combinations.';
  if (p === 'storage/util.go') return 'Builds raft configuration-change entries and derives effective voter and learner IDs from snapshots and WAL entries.';
  if (p === 'verify/doc.go') return 'Documents the storage verification package.';
  if (p.includes('doc.go')) return 'Documents the Go package and its role in the etcd server support layers.';
  if (p.includes('auth_client_adapter')) return 'Adapts the gRPC authentication server interface to a proxy client implementation.';
  if (p.includes('cluster_client_adapter')) return 'Adapts cluster membership RPCs from server calls to proxy client calls.';
  if (p.includes('kv_client_adapter')) return 'Adapts key-value RPCs, including unary and streaming operations, to proxy clients.';
  if (p.includes('lease_client_adapter')) return 'Adapts lease RPCs and keep-alive streaming between gRPC server and client interfaces.';
  if (p.includes('maintenance_client_adapter')) return 'Adapts maintenance RPCs and snapshot streaming to proxy client calls.';
  if (p.includes('watch_client_adapter')) return 'Adapts watch creation and bidirectional watch streaming for the gRPC proxy.';
  if (p.includes('chan_stream')) return isTest(p) ? 'Tests the channel-backed gRPC stream adapter and error propagation.' : 'Implements channel-backed gRPC stream types for proxying headers, context, messages, and close-send behavior.';
  if (p.endsWith('watch.go') && p.includes('grpcproxy')) return 'Implements the gRPC watch proxy, coordinating authorization, range registration, receive/send loops, leader loss, and stream cleanup.';
  if (p.includes('storage_recorder')) return 'Records snapshot storage operations for raft tests and exposes the minimal storage interface expected by the server.';
  if (p.includes('wait_recorder')) return 'Provides wait and notification recorders for deterministic server tests.';
  return isTest(p) ? `Tests ${n.replace(/_/g,' ')} behavior in the etcd server module.` : `Implements the ${n.replace(/_/g,' ')} component of the etcd server module.`;
}
for (const f of ext.results) {
  const p=f.path;
  addNode({id:'file:'+p,type:'file',name:path.basename(p),filePath:p,summary:summary(p),tags:tags(p),complexity:complexity(f),languageNotes:'Go implementation using protobuf RPC types, raft interfaces, concurrency primitives, and Prometheus or zap integration where applicable.'});
}
const exported = new Map(ext.results.map(f => [f.path, new Set((f.exports||[]).map(e => e.name))]));
const funcNodes = new Map();
for (const f of ext.results) {
  const exp=exported.get(f.path)||new Set(), seen=new Set();
  for (const fn of (f.functions||[])) {
    if (seen.has(fn.name)) continue;
    seen.add(fn.name);
    if ((fn.endLine-fn.startLine+1 < 10) && !exp.has(fn.name)) continue;
    const id='function:'+f.path+':'+fn.name;
    const stem=fn.name.replace(/^Test|^Benchmark/,'');
    addNode({id,type:'function',name:fn.name,filePath:f.path,lineRange:[fn.startLine,fn.endLine],summary:(isTest(f.path)?'Tests ':'Implements ')+(stem||fn.name)+' behavior in this component.',tags:isTest(f.path)?['test','validation','server']:tags(f.path).slice(0,3),complexity:(fn.endLine-fn.startLine+1)>50?'complex':(fn.endLine-fn.startLine+1)>20?'moderate':'simple'});
    funcNodes.set(f.path+':'+fn.name,id);
    addEdge('file:'+f.path,id,'contains',1.0);
    if (exp.has(fn.name)) addEdge('file:'+f.path,id,'exports',0.8);
  }
  for (const c of (f.classes||[])) {
    const exportedClass=exp.has(c.name), long=c.endLine-c.startLine+1>=20;
    if (!exportedClass && (c.methods||[]).length<2 && !long) continue;
    const id='class:'+f.path+':'+c.name;
    addNode({id,type:'class',name:c.name,filePath:f.path,lineRange:[c.startLine,c.endLine],summary:`Defines the ${c.name} test or adapter abstraction and its associated state and methods.`,tags:['go','type-definition','server'],complexity:(c.endLine-c.startLine+1)>50?'complex':'moderate'});
    addEdge('file:'+f.path,id,'contains',1.0);
    if (exportedClass) addEdge('file:'+f.path,id,'exports',0.8);
  }
}
for (const f of ext.results) for (const target of (imports[f.path]||[])) addEdge('file:'+f.path,'file:'+target,'imports',0.7);
const byName=new Map();
for (const [key,id] of funcNodes) { const name=key.slice(key.lastIndexOf(':')+1); if(!byName.has(name)) byName.set(name,[]); byName.get(name).push(id); }
for (const f of ext.results) for (const cg of (f.callGraph||[])) {
  const caller=funcNodes.get(f.path+':'+cg.caller); if(!caller) continue;
  const callee=cg.callee.split('.').pop(); const targets=(byName.get(callee)||[]).filter(x=>!x.startsWith('function:'+f.path+':'));
  if (targets.length===1) addEdge(caller,targets[0],'calls',0.8);
}
for (const f of ext.results) if (isTest(f.path)) {
  const prod=f.path.replace(/_test\.go$/,'.go'); if(batchPaths.has(prod)) addEdge('file:'+prod,'file:'+f.path,'tested_by',0.5);
}
const sorted=inp.batchFiles.map(x=>x.path).sort();
const parts=Math.ceil(Math.max(nodes.length/60,edges.length/120));
const per=Math.ceil(sorted.length/parts);
for(let i=0;i<parts;i++) {
  const ps=new Set(sorted.slice(i*per,(i+1)*per));
  const ns=nodes.filter(n=>ps.has(n.filePath)); const nids=new Set(ns.map(n=>n.id));
  const es=edges.filter(e=>nids.has(e.source));
  fs.writeFileSync(root+'/batch-10-part-'+(i+1)+'.json',JSON.stringify({nodes:ns,edges:es},null,2));
}
console.log(JSON.stringify({files:ext.filesAnalyzed,nodes:nodes.length,edges:edges.length,imports:edges.filter(e=>e.type==='imports').length,parts}));
