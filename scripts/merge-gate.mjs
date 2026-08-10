#!/usr/bin/env node
/**
 * Hard merge gate — must pass before a PR is allowed into main.
 *
 * Graph of checks (all required, in order):
 *   1. static-db-relationships  → bare/wrong PostgREST embeds
 *   2. unit-relationships       → relationship + dual-R2 + r2 migration planners
 *   3. unit-entregas-delivery   → /revision filter cannot accept pipeline-r2 as delivery
 *   4. r2-migration-verify      → zero leftover pipeline-r2 rows OR dry inventory OK
 *
 * CI job name: "merge-gate" (wire as required status check on main).
 */

import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = process.cwd()

/** @type {{ id: string, label: string, run: () => { ok: boolean, detail?: string } }[]} */
const GRAPH = [
  {
    id: 'static-db-relationships',
    label: 'Static PostgREST embed scan',
    run: () => {
      const r = spawnSync('node', ['scripts/check-content-idea-video-relationships.mjs'], {
        cwd: root,
        encoding: 'utf8',
      })
      return { ok: r.status === 0, detail: (r.stdout || '') + (r.stderr || '') }
    },
  },
  {
    id: 'unit-core-guards',
    label: 'Unit: relationships + dual-R2 + migration plan',
    run: () => {
      const r = spawnSync(
        'npx',
        [
          'vitest',
          'run',
          'lib/actions/content-idea-video-relationship.test.ts',
          'lib/utils/entregas-delivery.test.ts',
          'lib/utils/r2-provider-migration.test.ts',
          'scripts/check-content-idea-video-schema.test.ts',
          '--exclude',
          '**/.claude/**',
        ],
        { cwd: root, encoding: 'utf8' },
      )
      return { ok: r.status === 0, detail: (r.stdout || '') + (r.stderr || '') }
    },
  },
  {
    id: 'r2-inventory-dry-run',
    label: 'R2 migration dry-run (inventory; no credentials required)',
    run: () => {
      const r = spawnSync('node', ['scripts/migrate-pipeline-r2-to-entregas.mjs', '--dry-run'], {
        cwd: root,
        encoding: 'utf8',
      })
      // dry-run exits 0 even when credentials absent, as long as Supabase list works
      return { ok: r.status === 0, detail: (r.stdout || '') + (r.stderr || '') }
    },
  },
]

function main() {
  console.log('═══ MERGE GATE (required graph) ═══')
  const results = []
  for (const node of GRAPH) {
    process.stdout.write(`→ ${node.id}: ${node.label} ... `)
    const res = node.run()
    results.push({ id: node.id, ok: res.ok })
    if (res.ok) {
      console.log('PASS')
    } else {
      console.log('FAIL')
      console.error(res.detail?.slice(-2000) || '')
      console.error('\nMERGE BLOCKED. Fix the failing node before merging to main.')
      process.exitCode = 1
      return
    }
  }
  console.log('═══ ALL GRAPH NODES GREEN — merge allowed (after PR review) ═══')
  console.log(JSON.stringify({ graph: results }, null, 2))
}

const invoked = process.argv[1] ? resolve(process.argv[1]) : null
if (invoked === fileURLToPath(import.meta.url)) {
  main()
}
