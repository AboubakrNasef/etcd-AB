const fs = require('fs');

function fail(message) {
  console.error(message);
  process.exit(1);
}

const inputPath = process.argv[2];
const outputPath = process.argv[3];
if (!inputPath || !outputPath) fail('Usage: node ua-arch-analyze.js <input.json> <output.json>');

let input;
try {
  input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
} catch (error) {
  fail(`Unable to read input JSON: ${error.message}`);
}

const nodes = Array.isArray(input.fileNodes) ? input.fileNodes : [];
const imports = Array.isArray(input.importEdges) ? input.importEdges : [];
const allEdges = Array.isArray(input.allEdges) ? input.allEdges : [];
const nodeById = new Map(nodes.map((node) => [node.id, node]));
const pathOf = (node) => String(node.filePath || node.name || '').replace(/\\/g, '/');
const nodeType = (id) => (nodeById.get(id) || {}).type || String(id).split(':', 1)[0] || 'unknown';

function commonPrefix(paths) {
  if (!paths.length) return '';
  const first = paths[0].split('/');
  let length = first.length;
  for (const path of paths.slice(1)) {
    const parts = path.split('/');
    length = Math.min(length, parts.length);
    for (let i = 0; i < length; i += 1) {
      if (first[i] !== parts[i]) { length = i; break; }
    }
  }
  if (length === 0) return '';
  const prefixIsDirectory = paths.every((path) => path.split('/').length > length);
  return prefixIsDirectory ? first.slice(0, length).join('/') : '';
}

const paths = nodes.map(pathOf);
const prefix = commonPrefix(paths);
const prefixParts = prefix ? prefix.split('/') : [];
function groupFor(node) {
  const parts = pathOf(node).split('/');
  if (prefixParts.length && parts.slice(0, prefixParts.length).join('/') === prefix) {
    return parts.length > prefixParts.length + 1 ? parts[prefixParts.length] : 'root';
  }
  return parts.length > 1 ? parts[0] : 'root';
}

const directoryGroups = {};
for (const node of nodes) {
  const group = groupFor(node);
  (directoryGroups[group] ||= []).push(node.id);
}
const groupOf = new Map(nodes.map((node) => [node.id, groupFor(node)]));

const nodeTypeGroups = {};
for (const node of nodes) (nodeTypeGroups[node.type || 'unknown'] ||= []).push(node.id);

const fileFanIn = {};
const fileFanOut = {};
const groupPairCounts = new Map();
const groupInternal = {};
for (const edge of imports) {
  if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue;
  fileFanOut[edge.source] = (fileFanOut[edge.source] || 0) + 1;
  fileFanIn[edge.target] = (fileFanIn[edge.target] || 0) + 1;
  const from = groupOf.get(edge.source);
  const to = groupOf.get(edge.target);
  const key = `${from}\u0000${to}`;
  groupPairCounts.set(key, (groupPairCounts.get(key) || 0) + 1);
  groupInternal[from] = (groupInternal[from] || 0) + (from === to ? 1 : 0);
}

const interGroupImports = [...groupPairCounts.entries()]
  .filter(([key]) => key.split('\u0000')[0] !== key.split('\u0000')[1])
  .map(([key, count]) => { const [from, to] = key.split('\u0000'); return { from, to, count }; })
  .sort((a, b) => b.count - a.count || a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
const involved = {};
for (const edge of imports) {
  if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue;
  const from = groupOf.get(edge.source); const to = groupOf.get(edge.target);
  involved[from] = (involved[from] || 0) + 1;
  if (to !== from) involved[to] = (involved[to] || 0) + 1;
}
const intraGroupDensity = {};
for (const group of Object.keys(directoryGroups)) {
  const totalEdges = involved[group] || 0;
  intraGroupDensity[group] = { internalEdges: groupInternal[group] || 0, totalEdges, density: totalEdges ? (groupInternal[group] || 0) / totalEdges : 0 };
}

const crossCounts = new Map();
const nonCodeConnections = [];
for (const edge of allEdges) {
  if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue;
  const fromType = nodeType(edge.source); const toType = nodeType(edge.target);
  const key = `${fromType}\u0000${toType}\u0000${edge.type || 'unknown'}`;
  crossCounts.set(key, (crossCounts.get(key) || 0) + 1);
  if (fromType !== 'file' || toType !== 'file') nonCodeConnections.push({ source: edge.source, target: edge.target, edgeType: edge.type || 'unknown' });
}
const crossCategoryEdges = [...crossCounts.entries()].map(([key, count]) => {
  const [fromType, toType, edgeType] = key.split('\u0000');
  return { fromType, toType, edgeType, count };
}).sort((a, b) => b.count - a.count);

const patterns = {
  api: new Set(['routes','api','controllers','endpoints','handlers','serializers','controller','routers','blueprints']),
  service: new Set(['services','core','lib','domain','logic','signals','internal','composables','mailers','jobs','channels']),
  data: new Set(['models','db','data','persistence','repository','entities','migrations','entity','sql','database','schema']),
  ui: new Set(['components','views','pages','ui','layouts','screens']),
  middleware: new Set(['middleware','plugins','interceptors','guards']),
  utility: new Set(['utils','helpers','common','shared','tools','pkg','templatetags']),
  config: new Set(['config','constants','env','settings','management','commands']),
  test: new Set(['__tests__','test','tests','spec','specs']),
  types: new Set(['types','interfaces','schemas','contracts','dtos','dto','request','response','hooks']),
  entry: new Set(['cmd','bin']),
  documentation: new Set(['docs','documentation','wiki']),
  infrastructure: new Set(['deploy','deployment','infra','infrastructure','k8s','kubernetes','helm','charts','terraform','tf','docker']),
  'ci-cd': new Set(['.github','.gitlab','.circleci'])
};
function filePattern(node) {
  const p = pathOf(node); const n = p.split('/').pop().toLowerCase();
  if (/(_test\.go|\.test\.|\.spec\.|test_.*\.py$|.*test\.java$|_spec\.rb$|.*tests\.cs$)/i.test(n)) return 'test';
  if (/\.d\.ts$/.test(n)) return 'types';
  if (['dockerfile','makefile'].includes(n) || /^docker-compose\./.test(n) || /\.(tf|tfvars)$/.test(n)) return 'infrastructure';
  if (n === 'go.mod' || n === 'package.json' || n === 'tsconfig.json' || n === 'cargo.toml' || n === 'pom.xml') return 'config';
  if (/\.(md|rst)$/.test(n)) return 'documentation';
  if (/\.(sql)$/.test(n)) return 'data';
  if (/\.(graphql|gql|proto)$/.test(n)) return 'types';
  if (/^(main\.go|main\.rs|lib\.rs|application\.java|program\.cs)$/.test(n)) return 'entry';
  return null;
}
const patternMatches = {};
for (const group of Object.keys(directoryGroups)) {
  const match = Object.entries(patterns).find(([, names]) => names.has(group.toLowerCase()));
  patternMatches[group] = match ? match[0] : null;
}

const infraFiles = nodes.filter((node) => filePattern(node) === 'infrastructure' || ['service','resource'].includes(node.type)).map(pathOf);
const deploymentTopology = {
  hasDockerfile: nodes.some((node) => /^dockerfile(\.|$)/i.test(pathOf(node).split('/').pop())),
  hasCompose: nodes.some((node) => /docker-compose/i.test(pathOf(node))),
  hasK8s: nodes.some((node) => /(^|\/)(k8s|kubernetes|helm|charts)(\/|$)/i.test(pathOf(node))),
  hasTerraform: nodes.some((node) => /\.(tf|tfvars)$/i.test(pathOf(node))),
  hasCI: nodes.some((node) => filePattern(node) === 'ci-cd' || /(^|\/)(\.github|\.gitlab|\.circleci)(\/|$)/i.test(pathOf(node))),
  infraFiles
};
const dataPipeline = {
  schemaFiles: nodes.filter((node) => /(^|\/)(schema|schemas|database)(\/|$)|\.(graphql|gql|proto|sql)$/i.test(pathOf(node))).map(pathOf),
  migrationFiles: nodes.filter((node) => /(^|\/)migrations?\//i.test(pathOf(node))).map(pathOf),
  dataModelFiles: nodes.filter((node) => patternMatches[groupOf.get(node.id)] === 'data' || /(^|\/)(models|entities|repository|persistence)\//i.test(pathOf(node))).map(pathOf),
  apiHandlerFiles: nodes.filter((node) => patternMatches[groupOf.get(node.id)] === 'api' || /(^|\/)(routes|handlers|controllers|api)\//i.test(pathOf(node))).map(pathOf)
};
const docGroups = new Set(nodes.filter((node) => filePattern(node) === 'documentation' || node.type === 'document').map((node) => groupOf.get(node.id)));
const docCoverage = {
  groupsWithDocs: docGroups.size,
  totalGroups: Object.keys(directoryGroups).length,
  coverageRatio: Object.keys(directoryGroups).length ? docGroups.size / Object.keys(directoryGroups).length : 0,
  undocumentedGroups: Object.keys(directoryGroups).filter((group) => !docGroups.has(group))
};
const dependencyDirection = [];
for (const pair of interGroupImports) {
  const reverse = groupPairCounts.get(`${pair.to}\u0000${pair.from}`) || 0;
  if (pair.count > reverse) dependencyDirection.push({ dependent: pair.from, dependsOn: pair.to });
  else if (reverse > pair.count) dependencyDirection.push({ dependent: pair.to, dependsOn: pair.from });
}

const filesPerGroup = Object.fromEntries(Object.entries(directoryGroups).map(([group, ids]) => [group, ids.length]));
const nodeTypeCounts = Object.fromEntries(Object.entries(nodeTypeGroups).map(([type, ids]) => [type, ids.length]));
const result = {
  scriptCompleted: true,
  commonPathPrefix: prefix,
  directoryGroups,
  nodeTypeGroups,
  crossCategoryEdges,
  nonCodeConnections,
  interGroupImports,
  intraGroupDensity,
  patternMatches,
  deploymentTopology,
  dataPipeline,
  docCoverage,
  dependencyDirection,
  fileStats: { totalFileNodes: nodes.length, filesPerGroup, nodeTypeCounts },
  fileFanIn,
  fileFanOut
};
try {
  fs.mkdirSync(require('path').dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
} catch (error) {
  fail(`Unable to write results JSON: ${error.message}`);
}
