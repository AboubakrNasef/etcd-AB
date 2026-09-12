const fs = require('fs');

const root = process.cwd();
const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const graph = read(`${root}/.ua/intermediate/assembled-graph.json`);
const layers = read(`${root}/.ua/intermediate/layers.json`);
const tour = read(`${root}/.ua/intermediate/tour.json`);

const finalGraph = {
  version: '1.0.0',
  project: {
    name: 'etcd server',
    languages: ['Go'],
    frameworks: [],
    description: 'The etcd server module provides the embedded etcd runtime, cluster lifecycle, consensus-backed request processing, MVCC storage, authentication, leases, and API surfaces.',
    analyzedAt: new Date().toISOString(),
    gitCommitHash: 'e9e56564d6f13af87747cdb785bc1832791090b4',
  },
  nodes: graph.nodes,
  edges: graph.edges,
  layers,
  tour,
};

fs.writeFileSync(`${root}/.ua/knowledge-graph-final.json`, JSON.stringify(finalGraph, null, 2));
