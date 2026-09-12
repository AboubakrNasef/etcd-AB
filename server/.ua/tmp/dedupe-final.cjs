const fs = require('fs');
const path = '.ua/knowledge-graph.json';
const graph = JSON.parse(fs.readFileSync(path, 'utf8'));
const nodes = new Map();
for (const node of graph.nodes) nodes.set(node.id.toLowerCase(), node);
const canonical = new Map([...nodes.values()].map((node) => [node.id.toLowerCase(), node.id]));
const resolve = (id) => canonical.get(id.toLowerCase()) || id;
for (const edge of graph.edges) {
  edge.source = resolve(edge.source);
  edge.target = resolve(edge.target);
}
for (const layer of graph.layers) layer.nodeIds = layer.nodeIds.map(resolve);
for (const step of graph.tour) step.nodeIds = step.nodeIds.map(resolve);
graph.nodes = [...nodes.values()];
fs.writeFileSync('.ua/knowledge-graph-deduped.json', JSON.stringify(graph, null, 2));
console.log(`deduped ${graph.nodes.length} nodes`);
