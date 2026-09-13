/**
 * Primer Round Oficial — dedicated video studio space.
 * Client + Metricool blog + IG collabs (hosts) locked from Eric 2026-09-13.
 */

export const PRIMER_ROUND_CLIENT_ID = '7f4a8757-7811-4fb4-afc0-87dc0c50c56d'
export const PRIMER_ROUND_BLOG_ID = '5476146'
export const PRIMER_ROUND_IG_HANDLE = 'primerroundoficial'

/** Hosts Dennise Pérez + Rafael Lenín López (Magic 97.3 / Primer Round). */
export const PRIMER_ROUND_DEFAULT_COLLABS = [
  { key: 'denisse', username: 'denniseyperez', label: 'Dennise Pérez' },
  { key: 'lenin', username: 'rafaellenin', label: 'Rafael Lenín López' },
] as const

/**
 * Kill switch: set PRIMER_ROUND_AUTOPOST=false to require manual "Agendar".
 * Default (unset / anything else) = auto-schedule when overlay ortografía passes.
 */
export function primerRoundAutopostEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.PRIMER_ROUND_AUTOPOST !== 'false'
}

export function isPrimerRoundClientId(id: string | null | undefined): boolean {
  return !!id && id === PRIMER_ROUND_CLIENT_ID
}
