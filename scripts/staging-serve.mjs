#!/usr/bin/env node
/**
 * Levanta el STAGING: build + start del app con `.env.staging`, en su propio
 * puerto y su propio distDir. Lo arranca Playwright (webServer) o se corre a
 * mano para mirar el staging en el navegador.
 *
 * El build se reusa si ya existe y nada cambió — `--fresh` lo fuerza.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseEnvFile, stagingEnvProblems } from './check-staging-env.mjs'

const DIST = '.next-staging'
const PORT = process.env.E2E_PORT ?? '3021'

const envFile = resolve(process.cwd(), '.env.staging')
if (!existsSync(envFile)) {
  console.error('✖ No hay .env.staging — ver docs/STAGING.md')
  process.exit(1)
}
const staging = parseEnvFile(readFileSync(envFile, 'utf8'))
const problems = stagingEnvProblems(staging)
if (problems.length) {
  console.error(`✖ .env.staging inválido:\n${problems.map((p) => `  · ${p}`).join('\n')}`)
  process.exit(1)
}

// El env de staging gana sobre cualquier cosa que traiga la shell: si el
// proceso heredara las claves de producción, el "staging" sería producción.
const env = { ...process.env, ...staging, NEXT_DIST_DIR: DIST }
// `next start` decide el modo él mismo; heredar un NODE_ENV de la shell (o
// dejar la cadena "undefined") le cambia el comportamiento sin avisar.
delete env.NODE_ENV

const needsBuild = process.argv.includes('--fresh') || !existsSync(resolve(process.cwd(), DIST, 'BUILD_ID'))
if (needsBuild) {
  console.log('› building staging…')
  const build = spawnSync('npx', ['next', 'build'], { stdio: 'inherit', env })
  if (build.status !== 0) process.exit(build.status ?? 1)
}

console.log(`› staging en http://localhost:${PORT}`)
const start = spawnSync('npx', ['next', 'start', '-p', String(PORT)], { stdio: 'inherit', env })
process.exit(start.status ?? 0)
