import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

/**
 * Acceso directo a la base de STAGING desde los E2E, para dejar el estado como
 * la prueba lo necesita.
 *
 * Hace falta porque la app ahora guarda borradores de verdad: una prueba que
 * escribe deja rastro y la siguiente lo encontraría. Sin limpiar, el orden de
 * ejecución decide si la suite pasa.
 */

function stagingEnv(): Record<string, string> {
  const text = readFileSync(resolve(process.cwd(), '.env.staging'), 'utf8')
  const out: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq > 0) out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
  }
  return out
}

export function stagingAdmin() {
  const env = stagingEnv()
  // La guarda de check-staging-env ya rechazó que esta url sea producción.
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** Borra los borradores de "Escribir ideas" — staging es de pruebas, van todos. */
export async function limpiarBorradores() {
  const admin = stagingAdmin()
  await admin.from('idea_drafts').delete().not('client_id', 'is', null)
}
