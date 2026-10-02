import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveDashboard } from './dashboard_paths.mjs';
test('nested dashboard, legacy sibling and explicit override', () => {
 const dir=mkdtempSync(join(tmpdir(),'pipeline-paths-'));
 try {
  const root=join(dir,'video-pipeline'); mkdirSync(root);
  writeFileSync(join(dir,'package.json'), JSON.stringify({name:'social-dashboard'}));
  assert.equal(resolveDashboard(root),dir);
  assert.equal(resolveDashboard(root,join(dir,'custom')),join(dir,'custom'));
  rmSync(join(dir,'package.json'));
  assert.equal(resolveDashboard(root),join(dir,'social-dashboard'));
 } finally { rmSync(dir,{recursive:true,force:true}); }
});
