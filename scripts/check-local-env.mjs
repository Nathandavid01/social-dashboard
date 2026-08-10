import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import nextEnv from '@next/env'

const { loadEnvConfig } = nextEnv

const REQUIRED_LOCAL_ENV = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']

/** @param {Record<string, string | undefined>} env */
export function missingLocalEnv(env = process.env) {
  return REQUIRED_LOCAL_ENV.filter((name) => !env[name]?.trim())
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null
if (invokedPath === fileURLToPath(import.meta.url)) {
  loadEnvConfig(process.cwd())
  const missing = missingLocalEnv()
  if (missing.length > 0) {
    console.error(`Falta configuración local de Supabase: ${missing.join(', ')}`)
    console.error('Configura .env.local antes de iniciar el dashboard local.')
    process.exitCode = 1
  } else {
    console.log('Configuración local de Supabase lista.')
  }
}
