const fs = require('fs');
const path = require('path');
const root = 'D:/Programming/0.Practice/etcd/etcd-AB/server';
const ua = path.join(root, '.ua');
const input = JSON.parse(fs.readFileSync(path.join(ua, 'tmp/ua-file-analyzer-input-11.json'), 'utf8'));
const extracted = JSON.parse(fs.readFileSync(path.join(root, 'extract-results-11.json'), 'utf8'));
const summaries = {
  'config/config.go':'Defines the server configuration surface, bootstrap validation, cluster URL checks, timing helpers, data-directory layout, and request-size calculations.',
  'embed/util.go':'Provides the embedded-server initialization check by inspecting the configured member directory for an existing WAL.',
  'etcdserver/bootstrap_test.go':'Integration tests for bootstrapping existing clusters and backends, including creation of data directories, WAL snapshot records, and backend databases.',
  'storage/datadir/datadir.go':'Centralizes the canonical member, WAL, snapshot, and backend paths derived from an etcd data directory.',
  'storage/datadir/datadir_test.go':'Tests the canonical etcd data-directory path transformations and file-name helpers.',
  'storage/datadir/doc.go':'Package documentation describing the storage data-directory layout and path helpers.',
  'storage/storage.go':'Defines the storage abstraction used by the server, including WAL access, snapshot persistence, backend access, and lifecycle operations.',
  'storage/wal/decoder.go':'Decodes length-prefixed, CRC-protected WAL records from files and validates record framing and corruption conditions.',
  'storage/wal/doc.go':'Documents the WAL package and its durable record format, recovery behavior, and file organization.',
  'storage/wal/encoder.go':'Encodes WAL records with length framing, CRC updates, protobuf serialization, and durable file writes.',
  'storage/wal/file_pipeline.go':'Implements the asynchronous file pipeline that serializes WAL writes and coordinates flush and sync operations.',
  'storage/wal/file_pipeline_test.go':'Tests asynchronous WAL file-pipeline ordering, write behavior, flushing, and shutdown handling.',
  'storage/wal/metrics.go':'Defines Prometheus metrics for WAL writes, sync latency, and WAL file activity.',
  'storage/wal/record_test.go':'Tests WAL record encoding and validation behavior across metadata, entry, snapshot, and CRC cases.',
  'storage/wal/repair.go':'Repairs recoverable WAL corruption by locating valid record boundaries and rewriting damaged tails safely.',
  'storage/wal/repair_test.go':'Tests WAL repair decisions and recovery across truncated, corrupt, and partially written record scenarios.',
  'storage/wal/testing/waltesting.go':'Provides test helpers for constructing temporary WALs, records, and deterministic WAL fixtures.',
  'storage/wal/util.go':'Provides WAL file naming, directory scanning, existence checks, and small record/file utility helpers.',
  'storage/wal/version.go':'Defines WAL format versions and compatibility checks used when opening, validating, and upgrading WAL files.',
  'storage/wal/version_test.go':'Tests WAL format-version constants, compatibility behavior, and version validation.',
  'storage/wal/wal.go':'Implements the WAL lifecycle: create/open, append metadata and raft entries, rotate files, sync, read, recover, and close.',
  'storage/wal/wal_bench_test.go':'Benchmarks WAL append and encoding performance for representative raft records.',
  'storage/wal/wal_test.go':'Exercises WAL creation, append, rotation, recovery, corruption handling, snapshot metadata, and read semantics.',
  'storage/wal/walpb/record.go':'Adds validation and cloning helpers for protobuf WAL records and snapshot metadata before persistence.',
  'storage/wal/walpb/record.pb.go':'Generated protobuf message bindings for WAL records and snapshots, including reflection and serialization metadata.',
  'storage/wal/walpb/record_test.go':'Tests snapshot protobuf compatibility and validation rules for WAL snapshot records.'
};
const tags = p => p.includes('wal') ? ['wal','storage','persistence','serialization'] : p.includes('datadir') ? ['storage','path-management','utility','test'] : p.includes('config') ? ['configuration','validation','cluster-bootstrap','service'] : p.includes('bootstrap') ? ['test','cluster-bootstrap','backend','integration-test'] : ['storage','lifecycle','abstraction','persistence'];
const complexity = r => r.nonEmptyLines < 50 ? 'simple' : r.nonEmptyLines <= 200 ? 'moderate' : 'complex';
const nodes = [], edges = [], byFile = new Map(), functionIds = new Map();
for (const r of extracted.results) {
  const fileId = `file:${r.path}`;
  nodes.push({id:fileId,type:'file',name:path.posix.basename(r.path),filePath:r.path,summary:summaries[r.path] || `Implements ${r.path} for the server module.`,tags:tags(r.path),complexity:complexity(r)});
  byFile.set(r.path, r);
  const exported = new Set((r.exports||[]).map(x=>x.name));
  const classNames = new Set((r.classes||[]).map(x=>x.name));
  for (const c of (r.classes||[])) {
    if ((c.methods||[]).length >= 2 || c.endLine-c.startLine+1 >= 20) {
      const id=`class:${r.path}:${c.name}`;
      nodes.push({id,type:'class',name:c.name,filePath:r.path,lineRange:[c.startLine,c.endLine],summary:`Defines the ${c.name} data structure used by this package, with methods for its core storage or protocol behavior.`,tags:['data-model','serialization','storage'],complexity:c.endLine-c.startLine+1>100?'complex':'moderate'});
      edges.push({source:fileId,target:id,type:'contains',direction:'forward',weight:1.0});
      if (exported.has(c.name)) edges.push({source:fileId,target:id,type:'exports',direction:'forward',weight:0.8});
    }
  }
  const seen = new Set();
  for (const f of (r.functions||[])) {
    if (seen.has(f.name) || classNames.has(f.name)) continue;
    const significant = (f.endLine-f.startLine+1 >= 10) || exported.has(f.name);
    if (!significant) continue;
    seen.add(f.name);
    const id=`function:${r.path}:${f.name}`;
    functionIds.set(`${r.path}:${f.name}`,id);
    nodes.push({id,type:'function',name:f.name,filePath:r.path,lineRange:[f.startLine,f.endLine],summary:`Implements ${f.name}, providing focused ${r.path.includes('wal')?'WAL persistence or recovery':'server configuration or test'} behavior.`,tags:r.path.includes('test')?['test','validation','integration']:['utility','validation','storage'],complexity:f.endLine-f.startLine+1>40?'complex':'moderate'});
    edges.push({source:fileId,target:id,type:'contains',direction:'forward',weight:1.0});
    if (exported.has(f.name)) edges.push({source:fileId,target:id,type:'exports',direction:'forward',weight:0.8});
  }
}
for (const r of extracted.results) {
  const source=`file:${r.path}`;
  for (const targetPath of (input.batchImportData[r.path]||[])) edges.push({source,target:`file:${targetPath}`,type:'imports',direction:'forward',weight:0.7});
  for (const c of (r.callGraph||[])) {
    const caller=functionIds.get(`${r.path}:${c.caller}`), callee=functionIds.get(`${r.path}:${c.callee}`);
    if (caller && callee && caller!==callee) edges.push({source:caller,target:callee,type:'calls',direction:'forward',weight:0.8});
  }
}
const byPath = p => nodes.filter(n=>n.filePath===p);
const files = input.batchFiles.map(x=>x.path).sort();
const parts = Math.max(1, Math.ceil(Math.max(nodes.length/60, edges.length/120)));
const chunkSize = Math.ceil(files.length/parts);
for (let i=0;i<parts;i++) {
  const partFiles = new Set(files.slice(i*chunkSize,(i+1)*chunkSize));
  const partNodes = nodes.filter(n=>partFiles.has(n.filePath));
  const ids = new Set(partNodes.map(n=>n.id));
  const partEdges = edges.filter(e=>ids.has(e.source));
  const out = {nodes:partNodes,edges:partEdges};
  fs.writeFileSync(path.join(root,`batch-11-part-${i+1}.json`),JSON.stringify(out,null,2));
  console.log(`part ${i+1}: ${partNodes.length} nodes, ${partEdges.length} edges`);
}
console.log(`total: ${nodes.length} nodes, ${edges.length} edges, ${parts} parts, imports ${edges.filter(e=>e.type==='imports').length}`);
