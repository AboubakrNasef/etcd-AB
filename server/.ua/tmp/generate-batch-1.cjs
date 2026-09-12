const fs=require('fs');
const input=JSON.parse(fs.readFileSync('.ua/tmp/ua-file-analyzer-input-1.json','utf8'));
const x=JSON.parse(fs.readFileSync('.ua/tmp/ua-file-extract-results-1.json','utf8'));
const fileSummary={
 'auth/doc.go':'Documents the auth package and its role in etcd authentication and authorization.',
 'auth/jwt.go':'Implements JWT token creation, validation, user invalidation, and configurable signing algorithms for auth sessions.',
 'auth/jwt_test.go':'Tests JWT parsing, claims validation, malformed tokens, and JWT provider option handling.',
 'auth/main_test.go':'Provides package-level test setup for the auth package.',
 'auth/metrics.go':'Registers Prometheus metrics that measure authentication activity and token operations.',
 'auth/nop.go':'Provides a no-op token provider used when token authentication is disabled or not configured.',
 'auth/options.go':'Parses and validates JWT token-provider options, including HMAC, RSA, ECDSA, and EdDSA keys.',
 'auth/range_perm_cache.go':'Maintains merged range permissions and evaluates key and range authorization efficiently.',
 'auth/range_perm_cache_test.go':'Exercises range-permission merging and authorization decisions for point and interval keys.',
 'auth/simple_token.go':'Implements the in-memory simple-token provider, token lifecycle, expiration, and user invalidation.',
 'auth/simple_token_test.go':'Tests simple-token assignment and behavior when the provider is disabled.',
 'auth/store.go':'Defines the auth store, backend contracts, user/role operations, password checks, permission enforcement, and token-provider integration.',
 'auth/store_mock_test.go':'Supplies mock auth backend and transaction implementations used by auth-store tests.',
 'auth/store_test.go':'Provides extensive coverage for auth-store revisions, users, roles, permissions, recovery, tokens, and concurrency.',
 'embed/serve_test.go':'Verifies embedded etcd startup rejects an invalid token configuration.',
 'etcdserver/api/etcdhttp/debug.go':'Exposes HTTP debug variables and runtime diagnostic data.',
 'etcdserver/api/etcdhttp/doc.go':'Documents the etcd HTTP API package.',
 'etcdserver/api/etcdhttp/health.go':'Builds HTTP health, livez, and readyz endpoints backed by configurable server health checks.',
 'etcdserver/api/etcdhttp/health_test.go':'Tests HTTP health responses, subpaths, corruption, serializable and linearizable reads, metrics, and learner readiness.',
 'etcdserver/api/etcdhttp/metrics.go':'Serves the etcd Prometheus metrics endpoint over HTTP.',
 'etcdserver/api/etcdhttp/types/errors.go':'Defines HTTP error values and serialization helpers for the etcd HTTP API.',
 'etcdserver/api/etcdhttp/types/errors_test.go':'Tests HTTP error serialization and response writing.',
 'etcdserver/api/etcdhttp/utils.go':'Provides HTTP method guards and conversion of server errors into HTTP responses.',
 'etcdserver/api/etcdhttp/version_test.go':'Tests successful and failing HTTP version endpoint responses.',
 'etcdserver/api/v3rpc/auth.go':'Adapts gRPC auth RPCs to the server authenticator and enforces auth context requirements.',
 'etcdserver/api/v3rpc/watch.go':'Implements the bidirectional gRPC watch service, permission checks, event filtering, progress reports, and stream loops.',
 'etcdserver/apply/auth.go':'Wraps raft-applied KV and auth operations with authorization checks for keys, transactions, leases, users, and roles.',
 'etcdserver/apply/corrupt.go':'Provides an applier wrapper that returns corruption errors for state-changing operations.',
 'etcdserver/apply/uber_applier_test.go':'Tests alarm propagation through the combined applier for corruption, quota, and deactivation scenarios.',
 'etcdserver/cindex/doc.go':'Documents the consistent-index package.',
 'etcdserver/errors/errors.go':'Defines discovery errors and their human-readable formatting.',
 'etcdserver/read/read.go':'Coordinates linearizable reads by obtaining the leader’s committed index and waiting for local application.',
 'etcdserver/read/read_test.go':'Tests request-index handling, unique request IDs, leader changes, delayed responses, and shutdown behavior.',
 'proxy/grpcproxy/health.go':'Proxies health requests to backend endpoints and checks watch-based proxy health.',
 'proxy/grpcproxy/metrics.go':'Proxies metrics requests to randomized backend endpoints and exposes local proxy metrics.'
};
const tags=p=>{const t=[]; if(p.includes('test'))t.push('test'); if(p.includes('auth'))t.push('security','authentication'); if(p.includes('health'))t.push('api-handler','health-check'); if(p.includes('metrics'))t.push('monitoring'); if(p.includes('watch'))t.push('streaming','event-handler'); if(p.includes('apply'))t.push('service','authorization'); if(p.includes('read'))t.push('consistency','coordination'); if(p.includes('proxy'))t.push('proxy','api-handler'); if(p.includes('errors'))t.push('error-handling','serialization'); if(p.endsWith('doc.go'))t.push('documentation'); while(t.length<3)t.push('utility'); return [...new Set(t)].slice(0,5)};
const complexity=n=>n<50?'simple':n<=200?'moderate':'complex';
const nodes=[]; const edges=[]; const ids=new Set();
const addNode=n=>{if(!ids.has(n.id)){ids.add(n.id);nodes.push(n)}};
const batchPaths=new Set(input.batchFiles.map(f=>f.path));
for(const f of x.results){
 const base={id:`file:${f.path}`,type:'file',name:f.path,filePath:f.path,summary:fileSummary[f.path]||`Provides ${f.path.split('/').pop()} functionality for the server module.`,tags:tags(f.path),complexity:complexity(f.nonEmptyLines||0)};
 addNode(base);
 const exports=new Set((f.exports||[]).map(e=>e.name));
 for(const fn of (f.functions||[])){
   const len=fn.endLine-fn.startLine+1;
   if(len>=10||exports.has(fn.name)) addNode({id:`function:${f.path}:${fn.name}`,type:'function',name:fn.name,filePath:f.path,lineRange:[fn.startLine,fn.endLine],summary:`Implements ${fn.name} in ${f.path.split('/').pop()}, handling the file's ${f.path.includes('test')?'test scenario':'runtime behavior'}.`,tags:tags(f.path)});
 }
 for(const c of (f.classes||[])){
   if(exports.has(c.name)||c.methods.length>=2||(c.endLine-c.startLine+1)>=20) addNode({id:`class:${f.path}:${c.name}`,type:'class',name:c.name,filePath:f.path,lineRange:[c.startLine,c.endLine],summary:`Defines ${c.name}, a ${f.path.includes('test')?'test double or fixture':'server-module abstraction'} used by ${f.path.split('/').pop()}.`,tags:tags(f.path)});
 }
 for(const n of nodes.filter(n=>n.filePath===f.path&&n.id!==`file:${f.path}`)) edges.push({source:`file:${f.path}`,target:n.id,type:'contains',direction:'forward',weight:1.0});
 for(const n of nodes.filter(n=>n.filePath===f.path&&n.id!==`file:${f.path}`&&((f.exports||[]).some(e=>e.name===n.name)))) edges.push({source:`file:${f.path}`,target:n.id,type:'exports',direction:'forward',weight:0.8});
 for(const p of (input.batchImportData[f.path]||[])) if(p!==f.path) edges.push({source:`file:${f.path}`,target:`file:${p}`,type:'imports',direction:'forward',weight:0.7});
 for(const cg of (f.callGraph||[])){
   const src=`function:${f.path}:${cg.caller}`; const tgt=`function:${f.path}:${cg.callee}`;
   if(ids.has(src)&&ids.has(tgt)&&src!==tgt) edges.push({source:src,target:tgt,type:'calls',direction:'forward',weight:0.8});
 }
}
for(const f of x.results.filter(f=>f.path.includes('_test.go'))){
 const dir=f.path.slice(0,f.path.lastIndexOf('/')); for(const p of batchPaths) if(p.startsWith(dir+'/')&&!p.includes('_test.go')) edges.push({source:`file:${p}`,target:`file:${f.path}`,type:'tested_by',direction:'forward',weight:0.5});
}
const dedup=[];const seen=new Set();for(const e of edges){const k=[e.source,e.target,e.type].join('|');if(!seen.has(k)&&e.source!==e.target){seen.add(k);dedup.push(e)}}
const out={nodes,edges:dedup}; fs.writeFileSync('.ua/intermediate/batch-1.json',JSON.stringify(out,null,2));
console.log(JSON.stringify({files:x.results.length,nodes:nodes.length,edges:dedup.length,orphanEdges:dedup.filter(e=>!ids.has(e.source)||(!ids.has(e.target)&&!e.target.startsWith('file:'))).length}));
