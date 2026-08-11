#!/usr/bin/env node
/**
 * Levanta el STAGING: build + start del app con `.env.staging`, en su propio
 * puerto y su propio distDir. Lo arranca Playwright (webServer) o se corre a
 * mano para mirar el staging en el navegador.
 *
 * El build se reusa si ya existe y nada cambió — `--fresh` lo fuerza.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
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

/**
 * Huella del código que entra en el build. Sin esto el staging revivía un build
 * viejo y los E2E pasaban sin haber visto el cambio — se comprobó revirtiendo
 * el fix del paneo: la suite seguía verde. Una prueba que no puede fallar no
 * prueba nada.
 */
function huellaFuente() {
  const h = createHash('sha1')
  const raiz = process.cwd()
  const walk = (dir) => {
    for (const e of readdirSync(resolve(raiz, dir), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue
      const rel = `${dir}/${e.name}`
      if (e.isDirectory()) walk(rel)
      else if (/\.(tsx?|jsx?|mjs|css|json)$/.test(e.name)) {
        const s = statSync(resolve(raiz, rel))
        h.update(`${rel}:${s.size}:${s.mtimeMs}\n`)
      }
    }
  }
  for (const dir of ['app', 'components', 'lib']) walk(dir)
  for (const f of ['next.config.mjs', 'package-lock.json', 'tailwind.config.ts']) {
    if (existsSync(resolve(raiz, f))) {
      const s = statSync(resolve(raiz, f))
      h.update(`${f}:${s.size}:${s.mtimeMs}\n`)
    }
  }
  return h.digest('hex')
}

const huellaFile = resolve(process.cwd(), DIST, '.src-hash')
const huella = huellaFuente()
const construido = existsSync(resolve(process.cwd(), DIST, 'BUILD_ID'))
const huellaPrevia = existsSync(huellaFile) ? readFileSync(huellaFile, 'utf8').trim() : null

const needsBuild = process.argv.includes('--fresh') || !construido || huellaPrevia !== huella
if (needsBuild) {
  console.log(construido && huellaPrevia !== huella ? '› el código cambió: rebuild de staging…' : '› building staging…')
  const build = spawnSync('npx', ['next', 'build'], { stdio: 'inherit', env })
  if (build.status !== 0) process.exit(build.status ?? 1)
  writeFileSync(huellaFile, huella)
}

console.log(`› staging en http://localhost:${PORT}`)
const start = spawnSync('npx', ['next', 'start', '-p', String(PORT)], { stdio: 'inherit', env })
process.exit(start.status ?? 0)
