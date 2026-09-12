const fs = require('fs');
const input = JSON.parse(fs.readFileSync('.ua/tmp/ua-file-analyzer-input-7.json', 'utf8'));
const extract = JSON.parse(fs.readFileSync('.ua/tmp/ua-file-extract-results-7.json', 'utf8'));
const files = input.batchFiles.slice().sort((a, b) => a.path.localeCompare(b.path));
const byPath = new Map(extract.results.map((r) => [r.path, r]));
const nodes = [], edges = [], nodeIds = new Set(), edgeIds = new Set();
const addNode = (n) => { if (!nodeIds.has(n.id)) { nodeIds.add(n.id); nodes.push(n); } };
const addEdge = (source, target, type, weight) => {
  if (source === target) return;
  const key = `${source}|${target}|${type}`;
  if (!edgeIds.has(key)) { edgeIds.add(key); edges.push({source, target, type, direction: 'forward', weight}); }
};
const fileSummaries = {
  'embed/config.go': 'Defines the embedded etcd configuration model, defaults, CLI/file loading, validation, URL derivation, discovery settings, and TLS helpers.',
  'embed/etcd.go': 'Owns the embedded etcd server lifecycle, constructing the server from configuration, starting listeners and services, and coordinating shutdown.',
  'embed/serve.go': 'Builds and serves the embedded etcd HTTP and gRPC endpoints, including CORS wrapping and request logging helpers.',
  'etcdmain/config.go': 'Defines the command-line etcd configuration wrapper and flag parsing used to translate process arguments into server settings.',
  'etcdmain/help.go': 'Provides command-line help text and usage descriptions for etcd modes, flags, and operational behavior.',
  'etcdserver/api/cluster.go': 'Exposes the public cluster API boundary for membership and cluster operations.',
  'etcdserver/api/doc.go': 'Documents the etcd server API package and its role in exposing server-facing interfaces.',
  'etcdserver/api/etcdhttp/peer.go': 'Implements legacy HTTP peer membership handlers for listing, adding, removing, updating, and promoting cluster members.',
  'etcdserver/api/etcdhttp/peer_test.go': 'Tests legacy HTTP peer membership endpoints, request validation, and cluster mutation error paths.',
  'etcdserver/api/etcdhttp/version.go': 'Implements the HTTP version endpoint that reports server and cluster version information.',
  'etcdserver/api/membership/cluster_opts.go': 'Defines optional membership-cluster construction settings, including the maximum learner count.',
  'etcdserver/api/membership/doc.go': 'Documents the membership package responsible for cluster member state and reconfiguration.',
  'etcdserver/api/membership/errors.go': 'Defines membership-specific errors used when cluster member operations fail.',
  'etcdserver/api/membership/member.go': 'Defines cluster member identities and raft attributes, including learner construction, cloning, and sorting behavior.',
  'etcdserver/api/membership/member_test.go': 'Tests member timestamps and cloning semantics for membership data.',
  'etcdserver/api/membership/metrics.go': 'Declares Prometheus metrics for membership and cluster configuration activity.',
  'etcdserver/api/rafthttp/coder.go': 'Defines raft HTTP message coding constants and interfaces used by the peer transport.',
  'etcdserver/api/rafthttp/doc.go': 'Documents the raft HTTP transport package and its peer-to-peer responsibilities.',
  'etcdserver/api/rafthttp/fake_roundtripper_test.go': 'Provides a fake HTTP round tripper used to isolate raft transport tests.',
  'etcdserver/api/rafthttp/functional_test.go': 'Exercises end-to-end raft message delivery and failure reporting through the HTTP transport.',
  'etcdserver/api/rafthttp/http.go': 'Implements HTTP handlers for raft messages, streams, and snapshot transport endpoints.',
  'etcdserver/api/rafthttp/http_test.go': 'Tests raft HTTP routing, stream handling, close notification, and transport control behavior.',
  'etcdserver/api/rafthttp/metrics.go': 'Defines Prometheus metrics for raft HTTP traffic, connection health, and message transport.',
  'etcdserver/api/rafthttp/msg_codec.go': 'Provides codecs for encoding and decoding raft messages over HTTP.',
  'etcdserver/api/rafthttp/msg_codec_test.go': 'Tests raft message codec round trips and message serialization behavior.',
  'etcdserver/api/rafthttp/msgappv2_codec.go': 'Implements the version-two append-message codec with request statistics and streaming limits.',
  'etcdserver/api/rafthttp/msgappv2_codec_test.go': 'Tests version-two append-message encoding, decoding, and transport statistics behavior.',
  'etcdserver/api/rafthttp/peer.go': 'Manages a remote raft peer, coordinating message writers, readers, snapshots, pause/resume state, and peer health.',
  'etcdserver/api/rafthttp/peer_status.go': 'Tracks remote peer activity, activation timestamps, and categorized connection failures.',
};
const tagMap = {
  config: ['configuration', 'validation', 'cluster-bootstrap', 'tls'],
  http: ['raft-transport', 'http', 'api-handler', 'peer-communication'],
  membership: ['membership', 'cluster-state', 'reconfiguration', 'validation'],
  test: ['test', 'integration-test', 'reliability', 'regression'],
  doc: ['documentation', 'package-overview', 'architecture'],
};
function tags(path) {
  const t = path.includes('config') ? tagMap.config : path.includes('membership') ? tagMap.membership : path.includes('rafthttp') ? tagMap.http : path.includes('test') ? tagMap.test : path.endsWith('doc.go') ? tagMap.doc : ['server', 'api', 'etcd'];
  return t.slice(0, 4);
}
function complexity(r) { return r.nonEmptyLines < 50 ? 'simple' : r.nonEmptyLines <= 200 ? 'moderate' : 'complex'; }
function symbolSummary(path, name, kind) {
  if (name === 'Config' || name === 'ServerConfig') return 'Configuration structure aggregating server, networking, security, storage, and cluster bootstrap settings.';
  if (/test/i.test(name) || /_test\.go$/.test(path)) return `Test case validating ${name.replace(/^Test/, '').replace(/_/g, ' ').toLowerCase()} behavior.`;
  if (name === 'Peer' || name === 'peer') return 'Peer transport state coordinating raft message delivery and connection lifecycle.';
  if (name === 'Member') return 'Cluster member identity and raft-specific attributes used by membership management.';
  if (/ServeHTTP|Handle|New.*Handler/i.test(name)) return 'HTTP handler or constructor that exposes server behavior through the peer API.';
  return `${kind === 'class' ? 'Type' : 'Function'} ${name} implements a focused part of ${path.replace(/\.go$/, '')} behavior.`;
}
for (const f of files) {
  const r = byPath.get(f.path);
  const fid = `file:${f.path}`;
  addNode({id: fid, type: 'file', name: f.path.split('/').pop(), filePath: f.path, summary: fileSummaries[f.path] || `Implements ${f.path} in the etcd server module.`, tags: tags(f.path), complexity: complexity(r), languageNotes: 'Go package analyzed with tree-sitter structure and call-graph extraction.'});
  const exported = new Set((r.exports || []).map((x) => x.name));
  const classNames = new Set();
  for (const c of (r.classes || [])) {
    if (c.methods.length >= 2 || c.endLine - c.startLine + 1 >= 20 || exported.has(c.name)) {
      const id = `class:${f.path}:${c.name}`; classNames.add(c.name);
      addNode({id, type: 'class', name: c.name, filePath: f.path, lineRange: [c.startLine, c.endLine], summary: symbolSummary(f.path, c.name, 'class'), tags: tags(f.path), complexity: c.endLine - c.startLine > 100 ? 'complex' : 'moderate'});
      addEdge(fid, id, 'contains', 1.0);
      if (exported.has(c.name)) addEdge(fid, id, 'exports', 0.8);
    }
  }
  for (const fn of (r.functions || [])) {
    const exportedFn = exported.has(fn.name);
    if ((fn.endLine - fn.startLine + 1 >= 10 || exportedFn) && !classNames.has(fn.name)) {
      const id = `function:${f.path}:${fn.name}`;
      addNode({id, type: 'function', name: fn.name, filePath: f.path, lineRange: [fn.startLine, fn.endLine], summary: symbolSummary(f.path, fn.name, 'function'), tags: tags(f.path), complexity: fn.endLine - fn.startLine > 100 ? 'complex' : fn.endLine - fn.startLine >= 30 ? 'moderate' : 'simple'});
      addEdge(fid, id, 'contains', 1.0);
      if (exportedFn) addEdge(fid, id, 'exports', 0.8);
    }
  }
  for (const target of (input.batchImportData[f.path] || [])) addEdge(fid, `file:${target}`, 'imports', 0.7);
}
const parts = Math.ceil(Math.max(nodes.length / 60, edges.length / 120));
const partCount = Math.max(1, parts);
for (let k = 1; k <= partCount; k++) {
  const start = Math.floor((k - 1) * files.length / partCount), end = Math.floor(k * files.length / partCount);
  const partFiles = new Set(files.slice(start, end).map((f) => f.path));
  const partNodes = nodes.filter((n) => partFiles.has(n.filePath));
  const partIds = new Set(partNodes.map((n) => n.id));
  const partEdges = edges.filter((e) => partIds.has(e.source));
  fs.writeFileSync(`.ua/intermediate/batch-7-part-${k}.json`, JSON.stringify({nodes: partNodes, edges: partEdges}, null, 2));
}
console.log(JSON.stringify({nodeCount: nodes.length, edgeCount: edges.length, importEdges: edges.filter(e => e.type === 'imports').length, parts: partCount}));
