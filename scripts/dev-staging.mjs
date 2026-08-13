#!/usr/bin/env node
/**
 * next dev against natemedia-staging. Staging env wins over .env.local.
 * Usage: node scripts/dev-staging.mjs
 */
import { existsSync, readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const file = resolve(root, '.env.staging')
if (!existsSync(file)) {
  console.error('Falta .env.staging. No arranco contra .env.local (puede ser producción).')
  process.exit(1)
}
const extra = Object.fromEntries(
  readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => l.match(/^([^#=]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1].trim(), m[2].trim()]),
)
const STAGING_REF = 'mnqgesxmtsxtsajxfesy'
const url = extra.NEXT_PUBLIC_SUPABASE_URL || ''
if (!url.includes(STAGING_REF)) {
  console.error(
    'Estas pruebas solo corren contra natemedia-staging. ' +
      `La URL no es el proyecto ${STAGING_REF} (¿estás apuntando a producción?).`,
  )
  process.exit(1)
}

const port = process.env.PORT || '3022'
const child = spawn('npx', ['next', 'dev', '--port', port], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    ...extra,
    NEXT_DIST_DIR: '.next-staging-dev',
    PORT: port,
  },
})
child.on('exit', (code) => process.exit(code ?? 0))
