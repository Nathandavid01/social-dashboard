#!/usr/bin/env node
/**
 * Staging gate: RLS live tests + Playwright against natemedia-staging.
 * Refuses to run if .env.staging points at production.
 *
 *   npm run test:staging
 */
import { readFileSync, existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import { assertStagingUrl, parseDotEnv, STAGING_PROJECT_REF } from '../lib/utils/staging-env.ts'

const root = resolve(import.meta.dirname, '..')
const envFile = resolve(root, '.env.staging')

if (!existsSync(envFile)) {
  console.error('Falta .env.staging. Estas pruebas no corren contra producción.')
  process.exit(1)
}

const staging = parseDotEnv(readFileSync(envFile, 'utf8'))
try {
  assertStagingUrl(staging.NEXT_PUBLIC_SUPABASE_URL ?? '')
} catch (err) {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
}

if (!staging.STAGING_OWNER_PASSWORD) {
  console.error('Falta STAGING_OWNER_PASSWORD en .env.staging (owner de las pruebas).')
  process.exit(1)
}

const env = {
  ...process.env,
  ...staging,
  STAGING_TEST: '1',
  PORT: process.env.PORT || '3022',
}

console.log(`Staging: ${STAGING_PROJECT_REF} · owner ${staging.STAGING_OWNER_EMAIL ?? 'eric.perez.pr@gmail.com'}`)

function run(cmd, args) {
  return new Promise((resolvePromise) => {
    const child = spawn(cmd, args, { cwd: root, stdio: 'inherit', env })
    child.on('exit', (code) => resolvePromise(code ?? 1))
  })
}

const live = await run('npx', [
  'vitest',
  'run',
  'lib/utils/staging-env.test.ts',
  'lib/actions/ui-events.staging.test.ts',
  '--exclude',
  '**/.claude/**',
])
if (live !== 0) process.exit(live)

const require = createRequire(import.meta.url)
let playwrightBin
try {
  playwrightBin = require.resolve('@playwright/test/cli')
} catch {
  console.error('Falta @playwright/test. Corre: npm i -D @playwright/test && npx playwright install chromium')
  process.exit(1)
}

const e2e = await run(process.execPath, [playwrightBin, 'test'])
process.exit(e2e)
