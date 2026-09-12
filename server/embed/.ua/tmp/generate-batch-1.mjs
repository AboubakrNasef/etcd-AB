import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const extract = JSON.parse(fs.readFileSync(path.join(root, '.ua/tmp/ua-file-extract-results-1.json'), 'utf8'));

const fileInfo = {
  '.ua/config.json': ['Stores Understand Anything output-language preferences for this component graph.', ['configuration','analysis-output','metadata']],
  'auth_test.go': ['Exercises embedded-server startup and the complete role, user, grant, and authentication-enablement sequence through the v3 client.', ['test','authentication','integration-test']],
  'config.go': ['Defines the embedded etcd configuration surface, default construction, CLI flag binding, file loading, validation, discovery, URL handling, and TLS helpers.', ['configuration','validation','tls','cluster-bootstrap','service']],
  'config_logging.go': ['Builds and manages zap logging for embedded etcd, including output selection, global logger wiring, rotation, and synchronization.', ['logging','configuration','factory','log-rotation']],
  'config_logging_journal_unix.go': ['Provides the Unix journal-backed zap write synchronizer used when journal logging is selected.', ['logging','journald','platform-specific']],
  'config_logging_journal_windows.go': ['Rejects journal logging on Windows through the platform-specific write-synchronizer implementation.', ['logging','windows','platform-specific']],
  'config_test.go': ['Covers configuration parsing, defaults, validation, discovery, TLS versions, log rotation, URL safety, feature gates, and lease options.', ['test','configuration','validation','cluster-bootstrap']],
  'config_tracing.go': ['Validates distributed-tracing settings and constructs an OpenTelemetry OTLP exporter, sampler, resource identity, and shutdown wrapper.', ['tracing','opentelemetry','configuration','observability']],
  'config_tracing_test.go': ['Verifies sampler selection and tracing configuration behavior for the embedded server.', ['test','tracing','configuration']],
  'doc.go': ['Documents the embed package as the API for configuring, starting, and stopping an etcd server inside another Go process.', ['documentation','package-api','embedding']],
  'etcd.go': ['Owns the embedded server lifecycle: startup, peer and client listener creation, serving, metrics, gRPC gateway dialing, shutdown, and error propagation.', ['service','entry-point','lifecycle','networking','grpc']],
  'etcd_test.go': ['Checks metrics-listener creation when client TLS information is empty.', ['test','metrics','tls']],
  'serve.go': ['Multiplexes gRPC and HTTP traffic, installs gateways and debug handlers, enforces host and CORS access rules, and coordinates listener shutdown.', ['service','http','grpc','middleware','networking']],
  'serve_test.go': ['Ensures embedded startup reports an error when the initial cluster token is invalid.', ['test','cluster-bootstrap','validation']],
  'util.go': ['Determines whether an embedded member has already initialized by checking for its persisted WAL.', ['utility','wal','startup']],
  'util_test.go': ['Provides reusable dynamic URL fixtures and configuration helpers for embed package tests.', ['test','utility','networking']]
};

const specific = {
  NewConfig: 'Constructs a Config populated with safe defaults, default URLs, feature gates, timing, storage, authentication, and logging settings.',
  AddFlags: 'Registers the complete embedded-server configuration surface on a flag set and binds each option to the Config instance.',
  ConfigFromFile: 'Loads an embedded-server configuration from a YAML file and returns the normalized Config.',
  configFromFile: 'Decodes YAML configuration, reconciles legacy JSON-shaped fields, applies defaults, and validates the resulting Config.',
  Validate: 'Checks cross-field invariants for URLs, timing, TLS, discovery, compaction, authentication, leases, tracing, and feature gates.',
  PeerURLsMapAndToken: 'Builds the initial peer URL map and cluster token from static or discovery-based configuration.',
  GetDNSClusterNames: 'Queries DNS SRV discovery and derives secure or insecure cluster membership names.',
  InitialClusterFromName: 'Creates the initial-cluster string for a single member from its advertised peer URLs.',
  InferLocalAddr: 'Infers the local member name and peer URL from the configured initial cluster.',
  ClientSelfCert: 'Generates client-facing self-signed TLS material when automatic client TLS is enabled.',
  PeerSelfCert: 'Generates peer-facing self-signed TLS material when automatic peer TLS is enabled.',
  UpdateDefaultClusterFromName: 'Rewrites default cluster and advertise URLs to match a customized member name and listening addresses.',
  checkBindURLs: 'Validates that listen URLs use supported schemes and bindable host forms.',
  checkHostURLs: 'Validates advertised URLs and rejects unsafe wildcard or malformed hosts.',
  setupLogging: 'Creates the configured zap logger, chooses output sinks and format, enables optional rotation, and installs the logger on Config.',
  setupLogRotation: 'Parses rotation settings and creates lumberjack-backed zap sinks for configured log outputs.',
  NewZapLoggerBuilder: 'Returns a server logger factory that derives named loggers from the configured base logger.',
  SetupGlobalLoggers: 'Installs the configured zap logger into etcd and gRPC global logging adapters.',
  newTracingExporter: 'Creates and registers an OTLP trace provider with configured sampling, service identity, and shutdown behavior.',
  validateTracingConfig: 'Rejects incomplete or invalid distributed-tracing endpoint, service, and sampling settings.',
  determineSampler: 'Converts the per-million sampling setting into an OpenTelemetry parent-based sampler.',
  determineResourceWithIDKey: 'Builds OpenTelemetry resource attributes for service name and optional instance identity.',
  StartEtcd: 'Validates configuration, initializes tracing and logging, creates listeners, starts the etcd server, and launches peer, client, and metrics serving loops.',
  print: 'Logs the effective startup configuration, version, resource limits, data directory state, URLs, and security posture.',
  Close: 'Performs coordinated, idempotent shutdown of listeners, HTTP and gRPC servers, handlers, tracing, and the underlying etcd server.',
  stopServers: 'Gracefully stops active HTTP and gRPC servers, falling back to forced shutdown when required.',
  configurePeerListeners: 'Creates peer listeners with TLS and socket options and detects an already initialized member.',
  servePeers: 'Starts peer HTTP serving for each configured peer listener and tracks failures.',
  configureClientListeners: 'Creates client and client-HTTP listeners, applies TLS, and prepares secure and insecure serving contexts.',
  serveClients: 'Starts the configured gRPC, gateway, and HTTP client endpoints across prepared listeners.',
  grpcGatewayDial: 'Builds the gateway dial function and transport credentials for connecting back to the local gRPC endpoint.',
  createMetricsListener: 'Creates a metrics listener and applies client TLS settings when the metrics URL requires HTTPS.',
  serveMetrics: 'Serves metrics and health endpoints and reports listener failures.',
  parseCompactionRetention: 'Parses periodic or revision auto-compaction retention into the appropriate duration or revision value.',
  newServeCtx: 'Creates a serving context that owns one listener, its TLS state, handlers, servers, and shutdown synchronization.',
  serve: 'Classifies listener traffic, constructs gRPC and HTTP servers, registers services, applies TLS, and runs multiplexed serving loops.',
  configureHTTPServer: 'Enables HTTP/2 support on the standard HTTP server.',
  grpcHandlerFunc: 'Routes HTTP/2 gRPC requests to the gRPC server and all other requests to the HTTP handler.',
  registerGateway: 'Dials the local gRPC service, registers gateway handlers, and ties the connection lifecycle to the serving context.',
  createMux: 'Builds the HTTP handler tree for legacy APIs, gRPC gateway, user handlers, pprof, and tracing endpoints.',
  createAccessController: 'Wraps an HTTP mux with host-whitelist, authentication, and CORS enforcement.',
  ServeHTTP: 'Processes an HTTP request through access-control and CORS policy before delegating to the wrapped handler.',
  addCORSHeader: 'Adds the allowed-origin, methods, and headers response fields for CORS requests.',
  WrapCORS: 'Wraps an HTTP handler with origin checks and preflight response handling.',
  registerUserHandler: 'Registers a custom user HTTP handler while warning about path replacement.',
  registerPprof: 'Registers the standard pprof debug handler set.',
  registerTrace: 'Registers Go execution-trace pages and event endpoints.',
  TestEnableAuth: 'Starts an embedded member and verifies that role creation, user creation, role assignment, and authentication enablement succeed.',
  TestConfigFileOtherFields: 'Verifies that representative non-URL fields load correctly from configuration files.',
  TestConfigFileFeatureGates: 'Exercises server feature-gate parsing from configuration files.',
  TestInferLocalAddr: 'Covers inference of local member identity and addresses from initial-cluster configuration.',
  TestPeerURLsMapAndTokenFromSRV: 'Tests DNS SRV discovery conversion into peer URL maps and cluster tokens.',
  TestLogRotation: 'Verifies rotating-log configuration parsing and output behavior.',
  TestTLSVersionMinMax: 'Covers supported and invalid TLS minimum and maximum version combinations.',
  TestCheckHostURLs: 'Exercises advertised-host validation against valid, wildcard, and malformed URLs.',
  TestTracingConfig: 'Covers tracing configuration validation and exporter construction behavior.',
  TestDetermineSampler: 'Verifies conversion of configured sampling rates into OpenTelemetry sampler decisions.',
  TestStartEtcdWrongToken: 'Confirms startup fails predictably when peer discovery uses an invalid initial-cluster token.',
  newConfigTestURLs: 'Allocates isolated peer and client URLs and returns a matching initial-cluster fixture.',
  ConfigTestURLs: 'Groups peer URLs, client URLs, and the corresponding initial-cluster string used by tests.'
};

const classSummary = {
  Config: 'Aggregates every embedded etcd runtime option, including storage, Raft timing, networking, TLS, discovery, authentication, observability, and feature gates.',
  logRotationConfig: 'Represents lumberjack rotation settings and exposes synchronization for the rotating writer.',
  tracingExporter: 'Owns the OpenTelemetry tracer-provider shutdown function.',
  Etcd: 'Represents a running embedded etcd instance and owns its server, listeners, error channels, HTTP/gRPC servers, and shutdown state.',
  serveCtx: 'Owns all state needed to serve one client listener, including TLS, multiplexers, handlers, servers, and lifecycle synchronization.',
  wsProxyZapLogger: 'Adapts zap logging to the websocket proxy logging interface.',
  ConfigTestURLs: specific.ConfigTestURLs
};

function complexity(lines) { return lines > 200 ? 'complex' : lines >= 50 ? 'moderate' : 'simple'; }
function words(name) { return name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase(); }
function fnSummary(name, file) { return specific[name] || `${name.startsWith('Test') ? 'Tests' : 'Implements'} ${words(name)} behavior for the ${file.replace('.go','')} component.`; }
function fnTags(name, file) {
  if (name.startsWith('Test') || file.endsWith('_test.go')) return ['test','validation','go'];
  const tags = ['function','go'];
  if (/config|validate|flag/i.test(name)) tags.push('configuration');
  else if (/serve|listener|grpc|http|mux/i.test(name)) tags.push('networking');
  else if (/log/i.test(name)) tags.push('logging');
  else if (/trac|sampl|resource/i.test(name)) tags.push('observability');
  else tags.push('service');
  return tags;
}

let nodes=[]; let edges=[];
for (const f of extract.results) {
  const isConfig=f.fileCategory==='config';
  const fid=`${isConfig?'config':'file'}:${f.path}`;
  const info=fileInfo[f.path];
  nodes.push({id:fid,type:isConfig?'config':'file',name:path.basename(f.path),filePath:f.path,summary:info[0],tags:info[1],complexity:complexity(f.nonEmptyLines)});
  if (isConfig) continue;
  const exported = new Set((f.exports||[]).map(e=>e.name));
  const seen = new Set();
  for (const fn of f.functions||[]) {
    const lines=fn.endLine-fn.startLine+1;
    if (lines<10 && !exported.has(fn.name)) continue;
    const id=`function:${f.path}:${fn.name}`;
    if (seen.has(id)) continue;
    seen.add(id);
    nodes.push({id,type:'function',name:fn.name,filePath:f.path,lineRange:[fn.startLine,fn.endLine],summary:fnSummary(fn.name,f.path),tags:fnTags(fn.name,f.path),complexity:complexity(lines)});
    edges.push({source:fid,target:id,type:'contains',direction:'forward',weight:1.0});
    if(exported.has(fn.name)) edges.push({source:fid,target:id,type:'exports',direction:'forward',weight:0.8});
  }
  for (const cl of f.classes||[]) {
    const lines=cl.endLine-cl.startLine+1;
    if (lines<20 && (cl.methods||[]).length<2 && !exported.has(cl.name)) continue;
    const id=`class:${f.path}:${cl.name}`;
    nodes.push({id,type:'class',name:cl.name,filePath:f.path,lineRange:[cl.startLine,cl.endLine],summary:classSummary[cl.name]||`Encapsulates ${words(cl.name)} state and behavior in the embed package.`,tags:[f.path.endsWith('_test.go')?'test':'component','data-model','go'],complexity:complexity(lines)});
    edges.push({source:fid,target:id,type:'contains',direction:'forward',weight:1.0});
    if(exported.has(cl.name)) edges.push({source:fid,target:id,type:'exports',direction:'forward',weight:0.8});
  }
}

const filePaths=extract.results.map(r=>r.path).sort();
const parts=Math.ceil(Math.max(nodes.length/60, edges.length/120));
const chunkSize=Math.ceil(filePaths.length/parts);
for(let p=0;p<parts;p++) {
  const paths=new Set(filePaths.slice(p*chunkSize,(p+1)*chunkSize));
  const pn=nodes.filter(n=>paths.has(n.filePath));
  const ids=new Set(pn.map(n=>n.id));
  const pe=edges.filter(e=>ids.has(e.source));
  fs.writeFileSync(path.join(root,`.ua/intermediate/batch-1-part-${p+1}.json`),JSON.stringify({nodes:pn,edges:pe},null,2)+'\n');
}
console.log(JSON.stringify({parts,nodes:nodes.length,edges:edges.length,filesSkipped:extract.filesSkipped}));
