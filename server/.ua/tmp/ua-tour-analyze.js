#!/usr/bin/env node
const fs = require('fs');

function fail(message) { console.error(message); process.exit(1); }
const inputPath = process.argv[2];
const outputPath = process.argv[3];
if (!inputPath || !outputPath) fail('Usage: node ua-tour-analyze.js <input.json> <output.json>');

let graph;
try { graph = JSON.parse(fs.readFileSync(inputPath, 'utf8')); }
catch (err) { fail(`Cannot read input JSON: ${err.message}`); }
if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges) || !Array.isArray(graph.layers)) {
  fail('Input must contain nodes, edges, and layers arrays');
}

const nodes = graph.nodes;
const nodeIds = new Set(nodes.map(n => n.id));
const validEdges = graph.edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
const fanIn = new Map(nodes.map(n => [n.id, 0]));
const fanOut = new Map(nodes.map(n => [n.id, 0]));
for (const e of validEdges) {
  fanIn.set(e.target, fanIn.get(e.target) + 1);
  fanOut.set(e.source, fanOut.get(e.source) + 1);
}
const nodeById = new Map(nodes.map(n => [n.id, n]));
const nameOf = id => nodeById.get(id)?.name || id;
const summaryOf = id => nodeById.get(id)?.summary || '';
const rank = (map, field) => nodes.map(n => ({id:n.id, [field]:map.get(n.id), name:n.name}))
  .sort((a,b) => b[field] - a[field] || a.name.localeCompare(b.name)).slice(0,20);

const entryNames = new Set(['index.ts','index.js','main.ts','main.js','app.ts','app.js','server.ts','server.js','mod.rs','main.go','main.py','main.rs','manage.py','app.py','wsgi.py','asgi.py','run.py','__main__.py','Application.java','Main.java','Program.cs','config.ru','index.php','App.swift','Application.kt','main.cpp','main.c']);
const codeNodes = nodes.filter(n => n.type === 'file');
const maxOut = Math.max(1, ...codeNodes.map(n => fanOut.get(n.id)));
const sortedIn = [...codeNodes].sort((a,b) => fanIn.get(a.id)-fanIn.get(b.id));
const bottomCut = Math.max(1, Math.ceil(sortedIn.length * .25));
const bottomIds = new Set(sortedIn.slice(0,bottomCut).map(n=>n.id));
const topOutIds = new Set([...codeNodes].sort((a,b)=>fanOut.get(b.id)-fanOut.get(a.id)).slice(0, Math.max(1,Math.ceil(codeNodes.length*.1))).map(n=>n.id));
const candidates = nodes.map(n => {
  let score = 0;
  if (n.type === 'file') {
    const base = (n.name || n.filePath || '').split(/[\\/]/).pop();
    if (entryNames.has(base)) score += 3;
    const path = n.filePath || n.name || '';
    if (path.split(/[\\/]/).length <= 2) score += 1;
    if (topOutIds.has(n.id)) score += 1;
    if (bottomIds.has(n.id)) score += 1;
  } else if (n.type === 'document') {
    const path = n.filePath || n.name || '';
    if (path === 'README.md') score += 5;
    else if ((path.match(/[\\/]/g) || []).length === 0 && path.endsWith('.md')) score += 2;
  }
  return {id:n.id, score, name:n.name, summary:n.summary || ''};
}).filter(x => x.score > 0).sort((a,b)=>b.score-a.score || a.name.localeCompare(b.name)).slice(0,5);

const topCode = candidates.find(c => nodeById.get(c.id)?.type === 'file') || {id: codeNodes[0]?.id};
const adjacency = new Map(nodes.map(n=>[n.id, []]));
for (const e of validEdges) if ((e.direction === undefined || e.direction === 'forward') && (e.type === 'imports' || e.type === 'calls')) adjacency.get(e.source).push(e.target);
const order = [], depthMap = {}, byDepth = {};
if (topCode.id) {
  const q = [topCode.id]; depthMap[topCode.id] = 0;
  while (q.length) {
    const id = q.shift(); const d = depthMap[id]; order.push(id); (byDepth[d] ||= []).push(id);
    for (const target of adjacency.get(id) || []) if (depthMap[target] === undefined) { depthMap[target] = d+1; q.push(target); }
  }
}
const inventory = {documentation:[], infrastructure:[], data:[], config:[]};
for (const n of nodes) {
  const item = {id:n.id, name:n.name, type:n.type, summary:n.summary || ''};
  if (n.type === 'document') inventory.documentation.push(item);
  else if (['service','pipeline','resource'].includes(n.type)) inventory.infrastructure.push(item);
  else if (['table','schema','endpoint'].includes(n.type)) inventory.data.push(item);
  else if (n.type === 'config') inventory.config.push(item);
}
const undirected = new Map(nodes.map(n=>[n.id,new Map()]));
for (const e of validEdges) if (e.type === 'imports' || e.type === 'calls') {
  undirected.get(e.source).set(e.target,(undirected.get(e.source).get(e.target)||0)+1);
  undirected.get(e.target).set(e.source,(undirected.get(e.target).get(e.source)||0)+1);
}
const clusters = [];
for (const a of nodes) for (const [b, count] of undirected.get(a.id)) {
  if (a.id >= b || count < 2) continue;
  const members = [a.id,b];
  for (const c of nodes) if (!members.includes(c.id) && members.filter(m=>undirected.get(c.id).has(m)).length >= 2 && members.length < 5) members.push(c.id);
  const edgeCount = members.reduce((sum,x)=>sum+[...undirected.get(x)].filter(([y])=>members.includes(y)).reduce((s,[,v])=>s+v,0),0)/2;
  clusters.push({nodes:members, edgeCount});
}
clusters.sort((a,b)=>b.edgeCount-a.edgeCount).slice(0,10);
const nodeSummaryIndex = Object.fromEntries(nodes.map(n=>[n.id,{name:n.name,type:n.type,summary:n.summary||''}]));
const results = {scriptCompleted:true,entryPointCandidates:candidates,fanInRanking:rank(fanIn,'fanIn'),fanOutRanking:rank(fanOut,'fanOut'),bfsTraversal:{startNode:topCode.id||null,order,depthMap,byDepth},nonCodeFiles:inventory,clusters,layers:{count:graph.layers.length,list:graph.layers.map(({id,name,description})=>({id,name,description}))},nodeSummaryIndex,totalNodes:nodes.length,totalEdges:validEdges.length};
try { fs.writeFileSync(outputPath, JSON.stringify(results, null, 2)); }
catch (err) {
  // Some managed runners disallow shell-side file writes. Keep the analysis
  // successful and emit the compact design inputs so the caller can persist
  // the final artifact through its workspace writer.
  console.error(`Cannot write output JSON directly: ${err.message}`);
  console.log(JSON.stringify({
    scriptCompleted: true,
    entryPointCandidates: results.entryPointCandidates,
    fanInRanking: results.fanInRanking.slice(0, 12),
    fanOutRanking: results.fanOutRanking.slice(0, 12),
    bfsTraversal: {startNode: results.bfsTraversal.startNode, order: results.bfsTraversal.order.slice(0, 80), byDepth: Object.fromEntries(Object.entries(results.bfsTraversal.byDepth).slice(0, 5).map(([k,v])=>[k,v.slice(0,20)]))},
    nonCodeFiles: Object.fromEntries(Object.entries(results.nonCodeFiles).map(([k,v])=>[k,v.slice(0,20)])),
    clusters: results.clusters,
    layers: results.layers,
    totalNodes: results.totalNodes,
    totalEdges: results.totalEdges,
    selectedSummaries: Object.fromEntries([...new Set([
      ...results.entryPointCandidates.map(x=>x.id),
      ...results.bfsTraversal.order.slice(0, 80),
      ...results.fanInRanking.slice(0, 12).map(x=>x.id),
      ...results.fanOutRanking.slice(0, 12).map(x=>x.id),
      ...results.nonCodeFiles.documentation.slice(0,5).map(x=>x.id),
      ...results.nonCodeFiles.infrastructure.slice(0,5).map(x=>x.id),
      ...results.nonCodeFiles.data.slice(0,5).map(x=>x.id),
      ...results.nonCodeFiles.config.slice(0,5).map(x=>x.id)
    ])].map(id=>[id,results.nodeSummaryIndex[id]]))
  }, null, 2));
}
