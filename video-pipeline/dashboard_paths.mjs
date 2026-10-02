import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Resolve both the monorepo checkout and the original sibling layout. */
export function resolveDashboard(root, override = process.env.DASHBOARD_PATH) {
  if (override) return resolve(override);
  const parent = resolve(root, '..');
  try {
    if (JSON.parse(readFileSync(resolve(parent, 'package.json'), 'utf8')).name === 'social-dashboard') return parent;
  } catch { /* Legacy checkout has no dashboard package in its parent. */ }
  return resolve(parent, 'social-dashboard');
}
