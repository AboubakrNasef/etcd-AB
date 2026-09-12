import path from 'node:path';
import { pathToFileURL } from 'node:url';

const dashboardDirectory = process.env.UNDERSTAND_DASHBOARD_DIR;
const originalConfig = await import(/* @vite-ignore */
  pathToFileURL(path.join(dashboardDirectory, 'vite.config.ts')).href
);

export default {
  ...originalConfig.default,
  root: dashboardDirectory,
  cacheDir: process.env.UNDERSTAND_VITE_CACHE_DIR,
};
