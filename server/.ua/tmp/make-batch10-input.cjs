const fs = require('fs');
const root = 'D:/Programming/0.Practice/etcd/etcd-AB/server';
const batches = JSON.parse(fs.readFileSync(root + '/.ua/intermediate/batches.json', 'utf8'));
const batch = batches.batches.find((b) => b.batchIndex === 10);
if (!batch) throw new Error('batch 10 not found');
const input = { projectRoot: root, batchFiles: batch.files, batchImportData: batch.batchImportData };
fs.writeFileSync(root + '/.ua/tmp/ua-file-analyzer-input-10.json', JSON.stringify(input, null, 2));
console.log(JSON.stringify({ files: batch.files.length, imports: Object.values(batch.batchImportData).reduce((n, xs) => n + xs.length, 0) }));
