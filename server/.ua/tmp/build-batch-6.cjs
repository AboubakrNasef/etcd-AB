const fs=require('fs'), path=require('path');
const root='D:/Programming/0.Practice/etcd/etcd-AB/server', ua=root+'/.ua';
const inp=JSON.parse(fs.readFileSync(ua+'/tmp/ua-file-analyzer-input-6.json','utf8'));
const ext=JSON.parse(fs.readFileSync(ua+'/tmp/ua-file-extract-results-6.json','utf8'));
const imports=inp.batchImportData, batchPaths=new Set(inp.batchFiles.map(x=>x.path));
const nodes=[],edges=[],ids=new Set();
function addNode(n){if(!ids.has(n.id)){nodes.push(n);ids.add(n.id)}}
function addEdge(s,t,type,weight){if(s!==t)edges.push({source:s,target:t,type,direction:'forward',weight})}
const test=p=>p.endsWith('_test.go');
const fileInfo={
 'lease/leasehttp/http.go':['Exposes the HTTP lease renewal and time-to-live endpoints, translating protobuf requests and responses while enforcing readiness and request-size/time limits.','api-handler'],
 'lease/leasehttp/doc.go':['Documents the leasehttp package, which provides HTTP transport support for lease operations.','documentation'],
 'lease/lease_queue_test.go':['Exercises lease expiration queue ordering, registration, updates, removal, and expiration notifications.','test'],
 'lease/leasehttp/http_test.go':['Tests HTTP lease renewal and TTL clients, including readiness and apply-timeout behavior.','test'],
 'lease/lessor_bench_test.go':['Benchmarks lessor lease grant, attach, detach, revoke, and renewal operations using temporary backends.','test'],
 'lease/metrics.go':['Defines lease subsystem metrics for grants, renewals, revocations, expirations, and checkpoint activity.','monitoring'],
 'mock/mockstore/store_recorder.go':['Provides a testify/mock recorder for the legacy v2 store interface and its typed method expectations.','test'],
 'proxy/grpcproxy/watcher.go':['Implements the gRPC proxy watcher bridge, forwarding watch requests and responses between clients and a remote etcd endpoint.','proxy'],
 'storage/mvcc/doc.go':['Documents the MVCC storage package and its revisioned key-value and watch abstractions.','documentation'],
 'storage/mvcc/hash_test.go':['Tests MVCC key-value hashing and hash storage behavior across revisions and compaction states.','test'],
 'storage/mvcc/index.go':['Implements the in-memory MVCC tree index that maps user keys to revision histories and supports range lookup.','data-structure'],
 'storage/mvcc/index_bench_test.go':['Benchmarks MVCC index insertion, lookup, and range operations.','test'],
 'storage/mvcc/index_test.go':['Validates MVCC index insertion, lookup, deletion, range traversal, revision selection, and compaction edge cases.','test'],
 'storage/mvcc/key_index.go':['Maintains one key’s ordered revision generations, including creation, updates, tombstones, and compaction pruning.','data-structure'],
 'storage/mvcc/key_index_test.go':['Tests key-index generation transitions, revision lookup, tombstones, and compaction semantics.','test'],
 'storage/mvcc/kv.go':['Defines MVCC key-value records and conversion helpers used by the store and watch layers.','data-model'],
 'storage/mvcc/kv_test.go':['Tests MVCC key-value construction, equality, deletion markers, revision metadata, and serialization helpers.','test'],
 'storage/mvcc/kv_view.go':['Provides a read-only MVCC view over key-value results and revision-aware accessors.','data-model'],
 'storage/mvcc/kvstore_compaction_test.go':['Tests MVCC compaction scheduling, persistence, restoration, and interaction with schema metadata.','test'],
 'storage/mvcc/metrics.go':['Defines Prometheus metrics for MVCC operations, revisions, compaction, watchers, and backend-facing work.','monitoring'],
 'storage/mvcc/metrics_txn.go':['Defines transaction-specific MVCC metrics for read, write, and range activity.','monitoring'],
 'storage/mvcc/revision.go':['Defines MVCC revision identifiers and ordering helpers used to address historical key versions.','type-definition'],
 'storage/mvcc/testutil/hash.go':['Provides test helpers for calculating deterministic hashes of MVCC key-value collections.','test'],
 'storage/mvcc/watchable_store_bench_test.go':['Benchmarks watchable-store writes, watcher registration, synchronization, and event delivery.','test'],
 'storage/mvcc/watchable_store_test.go':['Tests watchable-store writes, watcher streams, synchronization, progress notifications, filtering, cancellation, and restoration.','test'],
 'storage/mvcc/watchable_store_txn.go':['Adds transaction integration for the watchable MVCC store, connecting committed changes to watcher notification.','transactions'],
 'storage/mvcc/watcher.go':['Defines watcher streams and event delivery primitives, including filters, cancellation, progress responses, and backpressure handling.','event-handler'],
 'storage/mvcc/watcher_bench_test.go':['Benchmarks watcher registration and event delivery paths.','test'],
 'storage/mvcc/watcher_group.go':['Groups watchers by key range and dispatches MVCC events efficiently to matching streams.','event-handler'],
 'storage/mvcc/watcher_test.go':['Tests watcher lifecycle, range matching, event filtering, cancellation, progress requests, and delivery isolation.','test']
};
function complexity(f){return f.nonEmptyLines>200?'complex':f.nonEmptyLines>=50?'moderate':'simple'}
function tags(p,extra){return ['go',extra,test(p)?'test':'storage',p.includes('watch')?'watching':p.includes('lease')?'lease':'mvcc']}
for(const f of ext.results){const p=f.path, info=fileInfo[p]||['Implements storage-layer behavior for the etcd server.','storage'];addNode({id:'file:'+p,type:'file',name:path.basename(p),filePath:p,summary:info[0],tags:tags(p,info[1]),complexity:complexity(f),languageNotes:'Go source using protobufs, backend transactions, ordered revisions, and concurrency-safe event delivery.'})}
const funcIds=new Map(), classIds=new Map();
for(const f of ext.results){const ex=new Set((f.exports||[]).map(x=>x.name));const seen=new Set();for(const fn of (f.functions||[])){if(seen.has(fn.name))continue;seen.add(fn.name);const len=fn.endLine-fn.startLine+1;if(len<10&&!ex.has(fn.name))continue;const id='function:'+f.path+':'+fn.name;const stem=fn.name.replace(/^Test/,'').replace(/^Benchmark/,'');addNode({id,type:'function',name:fn.name,filePath:f.path,lineRange:[fn.startLine,fn.endLine],summary:(test(f.path)?'Tests ':'Implements ')+(stem||fn.name)+' for this component.',tags:tags(f.path,'operation'),complexity:len>40?'complex':len>20?'moderate':'simple'});funcIds.set(f.path+':'+fn.name,id);addEdge('file:'+f.path,id,'contains',1.0);if(ex.has(fn.name))addEdge('file:'+f.path,id,'exports',0.8)}for(const c of (f.classes||[])){const exd=ex.has(c.name),len=c.endLine-c.startLine+1;if(!exd&&c.methods.length<2&&len<20)continue;const id='class:'+f.path+':'+c.name;addNode({id,type:'class',name:c.name,filePath:f.path,lineRange:[c.startLine,c.endLine],summary:'Defines the '+c.name+' state and behavior for this Go component.',tags:tags(f.path,'type-definition'),complexity:len>50?'complex':'moderate'});classIds.set(f.path+':'+c.name,id);addEdge('file:'+f.path,id,'contains',1.0);if(exd)addEdge('file:'+f.path,id,'exports',0.8)}}
for(const f of ext.results)for(const t of (imports[f.path]||[]))addEdge('file:'+f.path,'file:'+t,'imports',0.7);
const byName=new Map();for(const [k,id] of funcIds){const n=k.slice(k.lastIndexOf(':')+1);if(!byName.has(n))byName.set(n,[]);byName.get(n).push(id)}
for(const f of ext.results)for(const cg of (f.callGraph||[])){const caller=funcIds.get(f.path+':'+cg.caller);if(!caller)continue;const n=cg.callee.split('.').pop();const ts=(byName.get(n)||[]).filter(x=>!x.startsWith('function:'+f.path+':'));if(ts.length===1)addEdge(caller,ts[0],'calls',0.8)}
for(const p of batchPaths)if(test(p)){const prod=p.replace(/_test\.go$/,'.go');if(batchPaths.has(prod))addEdge('file:'+prod,'file:'+p,'tested_by',0.5)}
const sorted=inp.batchFiles.map(x=>x.path).sort(), parts=Math.ceil(Math.max(nodes.length/60,edges.length/120)), per=Math.ceil(sorted.length/parts);for(let i=0;i<parts;i++){const ps=new Set(sorted.slice(i*per,(i+1)*per)),ns=nodes.filter(n=>ps.has(n.filePath)),nids=new Set(ns.map(n=>n.id)),es=edges.filter(e=>nids.has(e.source));fs.writeFileSync(root+'/batch6-part-'+(i+1)+'.json',JSON.stringify({nodes:ns,edges:es},null,2))}
console.log(JSON.stringify({files:ext.filesAnalyzed,nodes:nodes.length,edges:edges.length,imports:edges.filter(e=>e.type==='imports').length,parts}));
