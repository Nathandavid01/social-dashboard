#!/usr/bin/env node
/**
 * Smoke /pool after deploy or against a preview.
 *
 *   npm run smoke:pool
 *   SMOKE_BASE_URL=https://….vercel.app npm run smoke:pool
 *
 * Hits `/api/health/pool` (public) and `/pool` (auth-aware).
 * Fails on 5xx / missing route. Skips (exit 0) if there is no preview URL —
 * CI does not need extra secrets or a local Supabase.
 *
 *   npm run smoke:pool -- --base-url https://preview.example
 */
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import {
  POOL_HEALTH_PATH,
  POOL_PATH,
  isPoolSmokeHttpOk,
  resolvePoolSmokeBaseUrl,
  shouldSkipPoolHttpSmoke,
} from '../lib/utils/pool-smoke.ts'

/**
 * @param {{ env?: Record<string, string | undefined>, fetchImpl?: typeof fetch, argv?: string[] }} [opts]
 */
export async function runPoolSmoke(opts = {}) {
  const env = opts.env ?? process.env
  const fetchImpl = opts.fetchImpl ?? fetch
  const argv = opts.argv ?? process.argv.slice(2)

  const flagUrl = readBaseUrlFlag(argv)
  const merged = flagUrl ? { ...env, SMOKE_BASE_URL: flagUrl } : env

  if (shouldSkipPoolHttpSmoke(merged)) {
    console.log('smoke:pool skip — no SMOKE_BASE_URL / STAGING_BASE_URL / PREVIEW_URL (no extra secrets).')
    return { skipped: true, exitCode: 0 }
  }

  const base = resolvePoolSmokeBaseUrl(merged)
  if (!base) {
    return { skipped: true, exitCode: 0 }
  }

  for (const path of [POOL_HEALTH_PATH, POOL_PATH]) {
    const url = `${base}${path}`
    let res
    try {
      res = await fetchImpl(url, { redirect: 'manual' })
    } catch (err) {
      console.error(`smoke:pool FAIL ${path} — network: ${err instanceof Error ? err.message : err}`)
      return { skipped: false, exitCode: 1, failedPath: path }
    }
    if (!isPoolSmokeHttpOk(res.status)) {
      console.error(`smoke:pool FAIL ${path} — HTTP ${res.status}`)
      return { skipped: false, exitCode: 1, failedPath: path }
    }
    console.log(`smoke:pool OK ${path} — HTTP ${res.status}`)
  }

  return { skipped: false, exitCode: 0 }
}

/** @param {string[]} argv */
function readBaseUrlFlag(argv) {
  const idx = argv.findIndex((a) => a === '--base-url')
  if (idx >= 0 && argv[idx + 1]) return argv[idx + 1].trim()
  const eq = argv.find((a) => a.startsWith('--base-url='))
  return eq ? eq.slice('--base-url='.length).trim() : ''
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null
if (invokedPath === fileURLToPath(import.meta.url)) {
  const result = await runPoolSmoke()
  process.exitCode = result.exitCode
}
