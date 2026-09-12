const fs = require('fs');
const path = require('path');

const inputPath = process.argv[2];
const outputPath = process.argv[3];
if (!inputPath || !outputPath) throw new Error('Usage: node generate-layers.js <input.json> <output.json>');
const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const nodes = input.fileNodes || [];

const layers = [
  { id: 'layer:contracts', name: 'API Contracts', description: 'Protocol buffers, generated RPC bindings, message schemas, and declared service endpoints used by the etcd server APIs.', nodeIds: [] },
  { id: 'layer:api', name: 'API and Proxy Surfaces', description: 'HTTP, gRPC, membership, snapshot, and peer-proxy adapters that expose or transport etcd server capabilities.', nodeIds: [] },
  { id: 'layer:core', name: 'Core Server Orchestration', description: 'The etcdserver coordination code that applies raft state, manages cluster behavior, and composes the server subsystems.', nodeIds: [] },
  { id: 'layer:persistence', name: 'Persistence and State', description: 'MVCC storage, WAL and backend handling, leases, snapshots, and verification of durable etcd state.', nodeIds: [] },
  { id: 'layer:security', name: 'Authentication and Authorization', description: 'User, role, token, permission, and authorization-cache components that protect etcd operations.', nodeIds: [] },
  { id: 'layer:entry', name: 'Process Entry and Embedding', description: 'The executable entry point and embedding/bootstrap integration that starts and configures an etcd server process.', nodeIds: [] },
  { id: 'layer:test', name: 'Tests and Test Doubles', description: 'Behavioral tests, benchmarks, fuzz cases, and mock stores or waiters used to validate server behavior.', nodeIds: [] },
  { id: 'layer:config', name: 'Configuration', description: 'Go module metadata, dependency policy, and Understand-Anything project configuration for this server module.', nodeIds: [] }
];
const byId = new Map(layers.map((layer) => [layer.id, layer]));
const basename = (p) => p.replace(/\\/g, '/').split('/').pop().toLowerCase();
const normalized = (node) => String(node.filePath || node.name || '').replace(/\\/g, '/');
function isTest(node, p) {
  const n = basename(p);
  return node.id.startsWith('file:mock/') || /(?:_test\.go|_test\.rs|\.test\.|\.spec\.|test_.*\.py$|.*tests\.cs$|benchmark|fuzz)/i.test(n);
}
function pick(node) {
  const p = normalized(node);
  const lower = p.toLowerCase();
  if (isTest(node, p)) return 'layer:test';
  if (node.type === 'config' || lower === '.gomodguard.yaml' || lower === 'go.mod' || lower === 'go.sum' || lower.startsWith('.ua/')) return 'layer:config';
  if (node.type === 'schema' || node.type === 'endpoint' || /\.(proto|graphql|gql)$/.test(lower) || /(?:\.pb\.go|\.pb\.gw\.go|_grpc\.pb\.go)$/.test(lower)) return 'layer:contracts';
  if (/^(?:auth)(?:\/|$)/.test(lower)) return 'layer:security';
  if (/^(?:storage|lease|verify)(?:\/|$)/.test(lower)) return 'layer:persistence';
  if (/^proxy(?:\/|$)/.test(lower) || /^etcdserver\/api(?:\/|$)/.test(lower)) return 'layer:api';
  if (/^(?:embed|etcdmain)(?:\/|$)/.test(lower) || lower === 'main.go') return 'layer:entry';
  return 'layer:core';
}

for (const node of nodes) byId.get(pick(node)).nodeIds.push(node.id);
for (const layer of layers) if (layer.nodeIds.length === 0) throw new Error(`Empty layer: ${layer.id}`);
const assigned = layers.flatMap((layer) => layer.nodeIds);
const expected = nodes.map((node) => node.id);
const counts = new Map(assigned.map((id) => [id, 0]));
for (const id of assigned) counts.set(id, (counts.get(id) || 0) + 1);
const missing = expected.filter((id) => !counts.has(id) || counts.get(id) !== 1);
const extras = assigned.filter((id) => !new Set(expected).has(id));
if (missing.length || extras.length || assigned.length !== expected.length) throw new Error(`Assignment invariant failed: assigned=${assigned.length}, expected=${expected.length}, missingOrDuplicated=${missing.length}, extras=${extras.length}`);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(layers, null, 2));
