import { describe, it, expect } from 'vitest'
// @ts-expect-error — script en .mjs sin tipos; se prueba la lógica pura.
import { parseEnvFile, stagingEnvProblems } from './check-staging-env.mjs'

/**
 * La guarda que impide que un E2E escriba en la base de producción. Si esto se
 * rompe, la suite ensucia datos reales sin avisar.
 */

const OK = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://staging123.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  E2E_USER_EMAIL: 'e2e@natemedia.test',
  E2E_USER_PASSWORD: 'secreto-largo',
}

describe('parseEnvFile', () => {
  it('lee pares, ignora comentarios y quita comillas', () => {
    expect(parseEnvFile('# nota\nA=1\nB="dos"\n\nC=tres=cuatro')).toEqual({ A: '1', B: 'dos', C: 'tres=cuatro' })
  })
})

describe('stagingEnvProblems', () => {
  it('no se queja de un staging bien configurado', () => {
    expect(stagingEnvProblems(OK)).toEqual([])
  })

  it('exige cada variable que el E2E necesita', () => {
    for (const key of Object.keys(OK)) {
      const sin = { ...OK, [key]: '' }
      expect(stagingEnvProblems(sin).join(' ')).toContain(key)
    }
  })

  // Las dos: la base real de la app y el proyecto viejo que sigue enlazado en
  // supabase/.temp y que cualquiera confundiría con producción.
  it.each(['bgqdtfhelknmfudcvrzz', 'uvphfpqeevmhqmyorhcm'])('RECHAZA apuntar a producción (%s)', (ref) => {
    const prod = { ...OK, NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co` }
    expect(stagingEnvProblems(prod).join(' ')).toMatch(/PRODUCCIÓN/)
  })
})
