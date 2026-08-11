#!/usr/bin/env node
/**
 * Corre Playwright con los navegadores instalados a demanda: sin esto, el
 * primer `git commit` de cada checkout falla por "browser not installed" en vez
 * de por una regresión de verdad.
 */
import { spawnSync } from 'node:child_process'

const smoke = process.argv.includes('--smoke')
const args = process.argv.slice(2).filter((a) => a !== '--smoke')

const check = spawnSync('npx', ['playwright', 'install', '--with-deps', 'chromium'], {
  stdio: process.env.CI ? 'inherit' : ['ignore', 'ignore', 'inherit'],
})
if (check.status !== 0) {
  console.error('✖ No se pudieron instalar los navegadores de Playwright')
  process.exit(check.status ?? 1)
}

const run = spawnSync('npx', ['playwright', 'test', ...args], {
  stdio: 'inherit',
  env: { ...process.env, ...(smoke ? { E2E_SMOKE: '1' } : {}) },
})
process.exit(run.status ?? 1)
