#!/usr/bin/env node
/**
 * Guarda de staging: los E2E escriben en la base de datos, así que antes de
 * levantar nada se comprueba que apuntan a STAGING y no a producción.
 *
 * Falla ruidosamente: un E2E corriendo contra la Supabase de producción borra
 * o ensucia el trabajo real del equipo.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const ENV_FILE = resolve(process.cwd(), '.env.staging')
const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'E2E_USER_EMAIL',
  'E2E_USER_PASSWORD',
]

/** Ref del proyecto de PRODUCCIÓN — nunca puede ser el destino de un E2E. */
const PROD_REF = 'uvphfpqeevmhqmyorhcm'

export function parseEnvFile(text) {
  const out = {}
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
  }
  return out
}

/** Lo que hace fallar la guarda, como lista de problemas legibles. */
export function stagingEnvProblems(env, { prodRef = PROD_REF } = {}) {
  const problems = []
  for (const key of REQUIRED) {
    if (!env[key]) problems.push(`falta ${key}`)
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  if (url.includes(prodRef)) {
    problems.push(`NEXT_PUBLIC_SUPABASE_URL apunta a PRODUCCIÓN (${prodRef}) — los E2E jamás corren contra prod`)
  }
  return problems
}

function main() {
  if (!existsSync(ENV_FILE)) {
    console.error(`\n✖ No hay .env.staging.\n  Créalo copiando env.staging.example y ver docs/STAGING.md.\n`)
    process.exit(1)
  }
  const env = parseEnvFile(readFileSync(ENV_FILE, 'utf8'))
  const problems = stagingEnvProblems(env)
  if (problems.length) {
    console.error(`\n✖ .env.staging no sirve para E2E:\n${problems.map((p) => `  · ${p}`).join('\n')}\n  Ver docs/STAGING.md.\n`)
    process.exit(1)
  }
  console.log('✓ staging env OK —', env.NEXT_PUBLIC_SUPABASE_URL)
}

// pathToFileURL, no `file://${argv[1]}`: la ruta del repo tiene un espacio
// ("Nate Media") y sin codificar la comparación falla — la guarda se saltaba
// entera y salía 0 sin comprobar nada.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
