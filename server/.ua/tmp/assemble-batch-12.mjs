import fs from 'fs';
import path from 'path';

const ua = 'D:/Programming/0.Practice/etcd/etcd-AB/server/.ua';
const outDir = 'D:/Programming/0.Practice/etcd/etcd-AB/server/generated-batch-12';
const x = JSON.parse(fs.readFileSync('D:/Programming/0.Practice/etcd/etcd-AB/server/ua-file-extract-results-12.json', 'utf8'));
const input = JSON.parse(fs.readFileSync(`${ua}/tmp/ua-file-analyzer-input-12.json`, 'utf8'));
const imports = input.batchImportData;

const fileDescriptions = {
  'config/config_test.go': ['Tests server bootstrap, discovery, local-member, snapshot-directory, and WAL-directory configuration validation.', ['test','config','validation','discovery']],
  'embed/auth_test.go': ['Exercises embedded etcd authentication setup through the v3 client, including roles, users, and auth enablement.', ['test','security','authentication','integration']],
  'embed/config_logging.go': ['Builds embedded etcd logging configuration, zap logger construction, global logger integration, TLS diagnostics, and log rotation.', ['config','logging','observability','factory','security']],
  'embed/config_logging_journal_unix.go': ['Provides the Unix implementation that creates a journald-backed log write synchronizer for embedded etcd.', ['logging','platform','unix','observability']],
  'embed/config_logging_journal_windows.go': ['Provides the Windows fallback for journal logging configuration.', ['logging','platform','windows','observability']],
  'embed/config_test.go': ['Validates embedded etcd configuration-file parsing, feature gates, addresses, compaction, discovery, logging, TLS, and lease settings.', ['test','config','validation','tls','feature-gates']],
  'embed/config_tracing.go': ['Configures OpenTelemetry tracing for embedded etcd, including exporter creation, sampling, resource identity, and shutdown.', ['config','tracing','observability','opentelemetry']],
  'embed/config_tracing_test.go': ['Tests tracing sampler selection and embedded etcd tracing configuration validation.', ['test','tracing','config','observability']],
  'embed/doc.go': ['Documents the embedded etcd package and its public embedding surface.', ['documentation','package','embedded-server']],
  'embed/etcd_test.go': ['Tests embedded etcd listener setup when client TLS information is empty.', ['test','tls','listener','embedded-server']],
  'embed/util_test.go': ['Provides shared URL configuration fixtures and helpers for embedded etcd tests.', ['test','utility','config','networking']],
  'etcdmain/config_test.go': ['Tests command-line and file-based etcd configuration parsing, conflicts, validation, election settings, and feature-gate flags.', ['test','config','cli','validation','feature-gates']],
  'etcdmain/doc.go': ['Documents the etcd command package.', ['documentation','package','entry-point']],
  'etcdmain/etcd.go': ['Implements etcd startup orchestration, proxy selection, data-directory discovery, and architecture support checks.', ['entry-point','startup','configuration','proxy']],
  'etcdmain/gateway.go': ['Defines the etcd gateway command and starts the HTTP-to-client gateway with endpoint normalization.', ['entry-point','gateway','api-handler','networking']],
  'etcdmain/grpc_proxy.go': ['Defines and starts the experimental gRPC proxy, including client construction, TLS, cmux listeners, HTTP health, metrics, and transport setup.', ['entry-point','grpc-proxy','networking','tls','observability']],
  'etcdmain/grpc_proxy_logger.go': ['Implements structured logging hooks for gRPC proxy requests, responses, stream messages, payload conversion, and reportability.', ['logging','grpc-proxy','middleware','serialization']],
  'etcdmain/grpc_proxy_logger_test.go': ['Tests gRPC proxy logging for successful unary calls, errors, and streaming request/response sequences.', ['test','logging','grpc-proxy','integration']],
  'etcdmain/main.go': ['Provides the etcd command entry point and optional systemd readiness notification.', ['entry-point','startup','systemd','cli']],
  'etcdmain/util.go': ['Discovers client endpoints used by the etcd gateway and proxy startup paths.', ['utility','networking','discovery','proxy']],
  'etcdserver/api/v3client/doc.go': ['Documents the v3 client API package.', ['documentation','package','api']],
  'etcdserver/api/v3discovery/discovery.go': ['Implements cluster discovery over the v3 KV and Watch APIs, including registration, peer waiting, retries, and initial-cluster generation.', ['service','discovery','cluster-management','watch','retry']],
  'etcdserver/api/v3discovery/discovery_test.go': ['Tests discovery cluster lookup, member registration, cluster validation, peer waiting, and initial-cluster string generation with fake KV and Watch implementations.', ['test','discovery','cluster-management','mocking','watch']],
  'etcdserver/api/v3election/election.go': ['Implements the v3 election gRPC service by adapting election operations to the server election backend and sessions.', ['service','election','grpc','streaming']],
  'etcdserver/api/v3election/v3electionpb/gw/v3election.pb.gw.go': ['Generated gRPC-Gateway bindings translating HTTP requests into v3 election client calls and registering election handlers.', ['api-handler','grpc-gateway','generated-code','election']],
  'etcdserver/api/v3election/v3electionpb/v3election.pb.go': ['Generated protobuf message and descriptor code for the v3 election API.', ['type-definition','serialization','generated-code','election']]
};

const resultByPath = new Map(x.results.map(r => [r.path.replaceAll('\\','/'), r]));
const batchPaths = input.batchFiles.map(f => f.path).sort();
const nodes = [];
const edges = [];
const emittedFunctions = new Set();
const emittedClasses = new Set();
const exportedByFile = new Map();

for (const p of batchPaths) {
  const r = resultByPath.get(p);
  const [summary, tags] = fileDescriptions[p] || [`Implements the ${path.basename(p)} component of the etcd server module.`, ['code','server','component']];
  const complexity = r.nonEmptyLines > 200 ? 'complex' : r.nonEmptyLines >= 50 ? 'moderate' : 'simple';
  nodes.push({id:`file:${p}`, type:'file', name:path.basename(p), filePath:p, summary, tags, complexity, ...(p.endsWith('.pb.go')||p.endsWith('.pb.gw.go') ? {languageNotes:'Generated Go bindings expose protobuf or gRPC-Gateway APIs and should be treated as generated surface code.'} : {})});
  const exported = new Set((r.exports||[]).map(e=>e.name));
  exportedByFile.set(p, exported);
  for (const f of (r.functions||[])) {
    const significant = (f.endLine - f.startLine + 1 >= 10) || exported.has(f.name);
    if (!significant) continue;
    const id = `function:${p}:${f.name}`;
    emittedFunctions.add(id);
    const generated = p.endsWith('.pb.go') || p.endsWith('.pb.gw.go');
    nodes.push({id,type:'function',name:f.name,filePath:p,lineRange:[f.startLine,f.endLine],summary: generated ? `Generated ${f.name} method or binding supporting the v3 election protobuf API.` : `${f.name} implements ${f.name.replaceAll('_',' ')} behavior for the etcd server module.`,tags: generated ? ['generated-code','serialization','api'] : (p.includes('_test.go') ? ['test','validation','server'] : ['server','implementation','api']),complexity:(f.endLine-f.startLine+1)>80?'complex':'moderate'});
    edges.push({source:`file:${p}`,target:id,type:'contains',direction:'forward',weight:1.0});
    if (exported.has(f.name)) edges.push({source:`file:${p}`,target:id,type:'exports',direction:'forward',weight:0.8});
  }
  for (const c of (r.classes||[])) {
    const significant = (c.endLine-c.startLine+1 >= 20) || (c.methods||[]).length >= 2 || exported.has(c.name);
    if (!significant) continue;
    const id=`class:${p}:${c.name}`; emittedClasses.add(id);
    nodes.push({id,type:'class',name:c.name,filePath:p,lineRange:[c.startLine,c.endLine],summary:`Defines ${c.name}, a ${p.includes('_test.go')?'test double or test suite':'server component'} used by the etcd ${p.includes('election')?'election':'runtime'} APIs.`,tags:p.includes('_test.go')?['test','mocking','server']:['server','component','api'],complexity:(c.endLine-c.startLine+1)>100?'complex':'moderate'});
    edges.push({source:`file:${p}`,target:id,type:'contains',direction:'forward',weight:1.0});
    if (exported.has(c.name)) edges.push({source:`file:${p}`,target:id,type:'exports',direction:'forward',weight:0.8});
  }
  for (const target of (imports[p]||[])) edges.push({source:`file:${p}`,target:`file:${target}`,type:'imports',direction:'forward',weight:0.7});
}

// Add only high-confidence local calls where both symbols are emitted and the call is unambiguous.
for (const p of batchPaths) {
  const r=resultByPath.get(p);
  for (const cg of (r.callGraph||[])) {
    const caller=`function:${p}:${cg.caller}`;
    if (!emittedFunctions.has(caller)) continue;
    const calleeName=cg.callee.includes('.') ? cg.callee.split('.').at(-1) : cg.callee;
    const candidates=[...emittedFunctions].filter(id=>id.endsWith(`:${calleeName}`));
    if (candidates.length===1 && candidates[0]!==caller) edges.push({source:caller,target:candidates[0],type:'calls',direction:'forward',weight:0.8});
  }
}

const parts = Math.max(1, Math.ceil(Math.max(nodes.length/60, edges.length/120)));
const groups=[]; const size=Math.ceil(batchPaths.length/parts);
for(let i=0;i<parts;i++) groups.push(batchPaths.slice(i*size,(i+1)*size));
fs.mkdirSync(outDir,{recursive:true});
for(let i=0;i<parts;i++){
  const set=new Set(groups[i]);
  const partNodes=nodes.filter(n=>n.type==='file'?set.has(n.filePath):set.has(n.filePath));
  const ids=new Set(partNodes.map(n=>n.id));
  const partEdges=edges.filter(e=>ids.has(e.source));
  fs.writeFileSync(`${outDir}/batch-12-part-${i+1}.json`,JSON.stringify({nodes:partNodes,edges:partEdges},null,2));
}
console.log(JSON.stringify({parts,nodes:nodes.length,edges:edges.length,imports:edges.filter(e=>e.type==='imports').length,expectedImports:Object.values(imports).reduce((n,a)=>n+a.length,0)}));
