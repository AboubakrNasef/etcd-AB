const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const batches = JSON.parse(fs.readFileSync(path.join(root, '.ua', 'intermediate', 'batches.json'), 'utf8'));
const batch = batches.batches.find((b) => b.batchIndex === 6);
if (!batch) throw new Error('batch 6 not found');
const input = {
  projectRoot: root,
  batchFiles: batch.files,
  batchImportData: batch.batchImportData,
};
fs.writeFileSync(path.join(root, 'batch-6-input.json'), JSON.stringify(input, null, 2));
