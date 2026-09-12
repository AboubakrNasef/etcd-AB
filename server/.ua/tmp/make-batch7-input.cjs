const fs = require('fs');
const batches = JSON.parse(fs.readFileSync('.ua/intermediate/batches.json', 'utf8'));
const batch = batches.batches.find((b) => b.batchIndex === 7);
if (!batch) throw new Error('batch 7 not found');
fs.writeFileSync('.ua/tmp/ua-file-analyzer-input-7.json', JSON.stringify({
  projectRoot: process.cwd(),
  batchFiles: batch.files,
  batchImportData: batch.batchImportData,
}, null, 2));
