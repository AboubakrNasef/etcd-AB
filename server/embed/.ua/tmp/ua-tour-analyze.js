const fs = require('fs');

try {
  const [inputPath, outputPath] = process.argv.slice(2);
  const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const nodes = data.nodes || [];
  const edges = data.edges || [];
  const layers = Array.isArray(data.layers) ? data.layers : (data.layers ? [data.layers] : []);
  const byId = new Map(nodes.map(n => [n.id, n]));
  const fanIn = new Map(nodes.map(n => [n.id, 0]));
  const fanOut = new Map(nodes.map(n => [n.id, 0]));
  for (const e of edges) {
    if (fanOut.has(e.source)) fanOut.set(e.source, fanOut.get(e.source) + 1);
    if (fanIn.has(e.target)) fanIn.set(e.target, fanIn.get(e.target) + 1);
  }
  const rank = (map, key) => [...map].map(([id, value]) => ({id, [key]: value, name: byId.get(id)?.name || id})).sort((a,b) => b[key]-a[key] || a.id.localeCompare(b.id)).slice(0,20);
  const fanInRanking = rank(fanIn, 'fanIn');
  const fanOutRanking = rank(fanOut, 'fanOut');
  const outVals = [...fanOut.values()].sort((a,b)=>a-b);
  const inVals = [...fanIn.values()].sort((a,b)=>a-b);
  const outCut = outVals[Math.max(0, Math.floor(outVals.length * .9))] || 0;
  const inCut = inVals[Math.max(0, Math.floor(inVals.length * .25))] || 0;
  const entryNames = /^(index\.(ts|js)|main\.(ts|js|go|py|rs|cpp|c)|app\.(ts|js|py)|server\.(ts|js)|mod\.rs|manage\.py|wsgi\.py|asgi\.py|run\.py|__main__\.py|Application\.java|Main\.java|Program\.cs|config\.ru|index\.php|App\.swift|Application\.kt)$/;
  const candidates = nodes.map(n => {
    let score = 0;
    const depth = (n.filePath || '').split(/[\\/]/).length;
    if (n.type === 'file') {
      if (entryNames.test(n.name || '')) score += 3;
      if (depth <= 2) score += 1;
      if ((fanOut.get(n.id)||0) >= outCut) score += 1;
      if ((fanIn.get(n.id)||0) <= inCut) score += 1;
      if (n.name === 'etcd.go') score += 3;
    } else if (n.type === 'document' && n.name === 'README.md' && depth === 1) score += 5;
    else if (n.type === 'document' && /\.md$/i.test(n.name || '') && depth === 1) score += 2;
    return {id:n.id, score, name:n.name, summary:n.summary};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score || a.id.localeCompare(b.id)).slice(0,5);
  const start = candidates.find(c => byId.get(c.id)?.type === 'file')?.id || null;
  const adjacency = new Map(nodes.map(n => [n.id, []]));
  for (const e of edges) if ((e.type === 'imports' || e.type === 'calls') && adjacency.has(e.source) && byId.has(e.target)) adjacency.get(e.source).push(e.target);
  const order = [], depthMap = {}, byDepth = {};
  if (start) {
    const q = [start]; depthMap[start] = 0;
    while (q.length) {
      const id = q.shift(), d = depthMap[id]; order.push(id); (byDepth[d] ||= []).push(id);
      for (const next of adjacency.get(id) || []) if (!(next in depthMap)) { depthMap[next] = d + 1; q.push(next); }
    }
  }
  const pick = types => nodes.filter(n => types.includes(n.type)).map(n => ({id:n.id,name:n.name,type:n.type,summary:n.summary}));
  const mutual = [];
  const relation = new Set(edges.filter(e=>e.type==='imports'||e.type==='calls').map(e=>`${e.source}\0${e.target}`));
  for (const e of edges) if ((e.type==='imports'||e.type==='calls') && e.source < e.target && relation.has(`${e.target}\0${e.source}`)) mutual.push({nodes:[e.source,e.target],edgeCount:2});
  const nodeSummaryIndex = Object.fromEntries(nodes.map(n => [n.id,{name:n.name,type:n.type,summary:n.summary}]));
  const result = {scriptCompleted:true,entryPointCandidates:candidates,fanInRanking,fanOutRanking,bfsTraversal:{startNode:start,order,depthMap,byDepth},nonCodeFiles:{documentation:pick(['document']),infrastructure:pick(['service','pipeline','resource']),data:pick(['table','schema','endpoint']),config:pick(['config'])},clusters:mutual.slice(0,10),layers:{count:layers.length,list:layers.map(({id,name,description})=>({id,name,description}))},nodeSummaryIndex,totalNodes:nodes.length,totalEdges:edges.length};
  fs.writeFileSync(outputPath, JSON.stringify(result,null,2));
} catch (err) { console.error(err.stack || err); process.exit(1); }
