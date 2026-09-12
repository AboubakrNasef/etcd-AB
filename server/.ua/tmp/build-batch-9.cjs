const fs = require('fs');
const path = require('path');
const root = process.cwd();
const extract = JSON.parse(fs.readFileSync('.ua/tmp/ua-file-extract-results-9.json','utf8'));
const importData = JSON.parse(fs.readFileSync('.ua/tmp/ua-import-map-output.json','utf8')).importMap;
const fileSummaries = {
  'etcdserver/api/v3compactor/doc.go':'Documents the v3 compactor package, which provides periodic and revision-based MVCC compaction APIs.',
  'etcdserver/api/v3compactor/periodic_test.go':'Exercises periodic compaction scheduling across hourly, minute, pause, and unchanged-revision cases.',
  'etcdserver/api/v3compactor/revision_test.go':'Tests revision-triggered compaction and pause behavior using fake clocks and recorder streams.',
  'etcdserver/api/v3election/doc.go':'Documents the v3 election API package for coordinating leadership through etcd leases.',
  'etcdserver/api/v3lock/doc.go':'Documents the v3 lock API package for distributed mutex acquisition and release.',
  'etcdserver/api/v3rpc/codec.go':'Implements the RPC codec used to marshal, unmarshal, and stringify v3 protocol messages.',
  'etcdserver/api/v3rpc/grpc.go':'Builds the gRPC server and registers the v3 service implementations, metrics, and health endpoints.',
  'etcdserver/api/v3rpc/header.go':'Provides response-header construction helpers that attach cluster, member, revision, and raft metadata.',
  'etcdserver/api/v3rpc/health.go':'Tracks server health and defragmentation state for gRPC health reporting and serving readiness.',
  'etcdserver/api/v3rpc/interceptor.go':'Defines gRPC unary and stream interceptors for cancellation, request logging, expensive-request metrics, and leader monitoring.',
  'etcdserver/api/v3rpc/key.go':'Implements the v3 KV gRPC service, including range, put, delete, transaction, compaction, validation, and response-header handling.',
  'etcdserver/api/v3rpc/key_test.go':'Verifies validation errors produced for malformed range requests.',
  'etcdserver/api/v3rpc/lease.go':'Implements lease grant, revoke, TTL, listing, and keep-alive RPCs over the server lessor.',
  'etcdserver/api/v3rpc/member.go':'Implements cluster membership RPCs for adding, removing, updating, listing, and promoting members.',
  'etcdserver/api/v3rpc/metrics.go':'Declares and initializes v3 RPC metrics for request counts, latencies, and response sizes.',
  'etcdserver/api/v3rpc/quota.go':'Wraps KV and lease RPC services with backend-quota checks and quota alarm activation.',
  'etcdserver/api/v3rpc/watch_test.go':'Tests watch response fragmentation and protobuf field-count compatibility.',
  'etcdserver/apply/apply.go':'Defines the applier entry point that executes committed raft requests while separating side-effect-free operations.',
  'etcdserver/apply/capped.go':'Provides a capped applier wrapper that rejects writes when backend quota is exhausted.',
  'etcdserver/apply/metrics.go':'Registers metrics used to observe raft request application.',
  'etcdserver/bootstrap.go':'Bootstraps etcd storage, membership, WAL, snapshots, raft nodes, and recovery paths for new or existing clusters.',
  'etcdserver/cluster_util.go':'Contains remote-peer helpers for cluster discovery, version compatibility, member promotion, and downgrade state.',
  'etcdserver/cluster_util_test.go':'Tests cluster-version compatibility, conversion, and allowed-version-range decisions.',
  'etcdserver/corrupt.go':'Implements corruption checking by comparing MVCC hashes across peers and exposing hash verification over HTTP.',
  'etcdserver/doc.go':'Documents the core etcdserver package and its role in coordinating raft, storage, membership, and APIs.',
  'etcdserver/interface.go':'Defines small server lifecycle and linearizable-read interfaces used to decouple raft and API components.',
  'etcdserver/metrics.go':'Declares server-wide metrics and runtime file-descriptor monitoring.',
  'etcdserver/raft.go':'Coordinates the raft node lifecycle, ready processing, persistence, application, message delivery, and shutdown.',
  'etcdserver/raft_test.go':'Tests raft-node startup, application blocking, configuration changes, duplicate responses, status reporting, and repeated shutdown.'
};
const tags = p => p.includes('_test.go') ? ['test','validation','integration'] : p.includes('rpc') ? ['api-handler','grpc','service'] : p.includes('bootstrap') ? ['bootstrap','storage','raft'] : p.includes('raft') ? ['raft','event-handler','service'] : p.includes('corrupt') ? ['monitoring','validation','security'] : p.includes('metrics') ? ['monitoring','metrics','runtime'] : ['service','utility','etcdserver'];
const fnSummary = (n,p) => {
  const s = n.replace(/^Test/,'').replace(/([a-z])([A-Z])/g,'$1 $2').toLowerCase();
  if (n.startsWith('Test')) return `Verifies ${s} behavior for the ${p.split('/').pop()} implementation.`;
  if (/^New/.test(n)) return `Constructs and initializes the ${s} component used by the server.`;
  if (/^(check|validate)/i.test(n)) return `Validates ${s} inputs and returns an error when the request or state is invalid.`;
  if (/^(get|convert|build|create)/i.test(n)) return `Computes or assembles ${s} for downstream server processing.`;
  if (/^(start|stop|close|bootstrap|recover|finalize|apply|process|serve|monitor)/i.test(n)) return `Coordinates ${s} as part of the server lifecycle and request-processing pipeline.`;
  return `Implements ${s} behavior for the surrounding etcdserver component.`;
};
const nodes=[]; const edges=[]; const fileSet=new Set(extract.results.map(r=>r.path));
for(const r of extract.results){
  const id='file:'+r.path; const complexity=r.nonEmptyLines>200?'complex':r.nonEmptyLines>50?'moderate':'simple';
  nodes.push({id,type:'file',name:path.basename(r.path),filePath:r.path,summary:fileSummaries[r.path]||`Provides ${path.basename(r.path)} functionality for the etcd server.`,tags:tags(r.path),complexity});
  for(const f of (r.functions||[])){
    const exported=(r.exports||[]).some(e=>e.name===f.name); const long=f.endLine-f.startLine+1>=10;
    if(!exported&&!long) continue;
    let displayName=f.name;
    if(r.path==='etcdserver/bootstrap.go'&&f.name==='Close') displayName=f.startLine===159?'bootstrappedServer.Close':(f.startLine===168?'bootstrappedStorage.Close':'bootstrappedBackend.Close');
    const fid=`function:${r.path}:${displayName}`;
    nodes.push({id:fid,type:'function',name:displayName,filePath:r.path,lineRange:[f.startLine,f.endLine],summary:fnSummary(f.name,r.path),tags:f.name.startsWith('Test')?['test','validation','behavior']:['utility','server','processing'],complexity:(f.endLine-f.startLine+1)>50?'complex':'moderate'});
    edges.push({source:id,target:fid,type:'contains',direction:'forward',weight:1.0});
    if(exported) edges.push({source:id,target:fid,type:'exports',direction:'forward',weight:0.8});
  }
  for(const target of (importData[r.path]||[])){
    if(target===r.path) continue;
    edges.push({source:id,target:'file:'+target,type:'imports',direction:'forward',weight:0.7});
  }
}
// Test-to-production relationships visible by naming and package role.
const testFiles=nodes.filter(n=>n.type==='file'&&n.filePath.endsWith('_test.go'));
for(const t of testFiles){
  const base=t.filePath.replace('_test.go','.go');
  if(fileSet.has(base)) edges.push({source:'file:'+base,target:t.id,type:'tested_by',direction:'forward',weight:0.5});
}
const parts=Math.ceil(Math.max(nodes.length/60,edges.length/120));
const sorted=[...new Set(extract.results.map(r=>r.path))].sort();
const groups=[]; const per=Math.ceil(sorted.length/parts);
for(let i=0;i<parts;i++) groups.push(new Set(sorted.slice(i*per,(i+1)*per)));
for(let i=0;i<groups.length;i++){
  const g=groups[i]; const ns=nodes.filter(n=>g.has(n.filePath)); const owned=new Set(ns.map(n=>n.id));
  const es=edges.filter(e=>owned.has(e.source));
  fs.writeFileSync(`.ua/intermediate/batch-9-part-${i+1}.json`,JSON.stringify({nodes:ns,edges:es},null,2));
}
console.log(JSON.stringify({parts:groups.length,nodes:nodes.length,edges:edges.length,imports:edges.filter(e=>e.type==='imports').length,expectedImports:Object.values(importData).reduce((n,a)=>n+a.length,0)},null,2));
