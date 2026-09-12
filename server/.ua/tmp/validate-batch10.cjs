const fs=require('fs');
const root='D:/Programming/0.Practice/etcd/etcd-AB/server';
const inp=JSON.parse(fs.readFileSync(root+'/.ua/tmp/ua-file-analyzer-input-10.json'));
const paths=fs.readdirSync(root+'/.ua/intermediate').filter(x=>x.startsWith('batch-10-part-')&&x.endsWith('.json')).sort();
let ns=[], es=[];
for(const p of paths){const x=JSON.parse(fs.readFileSync(root+'/.ua/intermediate/'+p)); if(!Array.isArray(x.nodes)||!Array.isArray(x.edges)) throw Error(p+' malformed'); ns.push(...x.nodes); es.push(...x.edges);}
const ids=new Set(ns.map(n=>n.id));
const dup=ns.map(n=>n.id).filter((id,i,a)=>a.indexOf(id)!==i);
const expected=Object.values(inp.batchImportData).reduce((a,x)=>a+x.length,0);
const known=new Set([...Object.keys(inp.batchImportData),...Object.values(inp.batchImportData).flat()]);
const bad=es.filter(e=>!ids.has(e.target)&&!(e.target.startsWith('file:')&&known.has(e.target.slice(5))));
console.log(JSON.stringify({parts:paths,nodes:ns.length,edges:es.length,files:ns.filter(n=>n.type==='file').length,functions:ns.filter(n=>n.type==='function').length,classes:ns.filter(n=>n.type==='class').length,imports:es.filter(e=>e.type==='imports').length,importExpected:expected,duplicates:[...new Set(dup)],badEdges:bad.length,edgeTypes:es.reduce((a,e)=>(a[e.type]=(a[e.type]||0)+1,a),{})},null,2));
