/** natemedia-staging. Never point live/session tests at production. */
export const STAGING_PROJECT_REF = 'mnqgesxmtsxtsajxfesy'

export function parseDotEnv(contents: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of contents.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#') || !t.includes('=')) continue
    const i = t.indexOf('=')
    const k = t.slice(0, i).trim()
    let v = t.slice(i + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    out[k] = v
  }
  return out
}

/** Why local staging must not start. Null = safe to boot. */
export function stagingBootError(opts: { envFileExists: boolean; supabaseUrl: string }): string | null {
  if (!opts.envFileExists) {
    return 'Falta .env.staging. No arranco contra .env.local (puede ser producción).'
  }
  try {
    assertStagingUrl(opts.supabaseUrl)
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'La URL no es staging.'
  }
}

export function assertStagingUrl(url: string): void {
  if (!url || !url.includes(STAGING_PROJECT_REF)) {
    throw new Error(
      'Estas pruebas solo corren contra natemedia-staging. ' +
        `La URL no es el proyecto ${STAGING_PROJECT_REF} (¿estás apuntando a producción?).`,
    )
  }
}
