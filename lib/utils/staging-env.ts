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

export function assertStagingUrl(url: string): void {
  if (!url || !url.includes(STAGING_PROJECT_REF)) {
    throw new Error(
      'Estas pruebas solo corren contra natemedia-staging. ' +
        `La URL no es el proyecto ${STAGING_PROJECT_REF} (¿estás apuntando a producción?).`,
    )
  }
}
