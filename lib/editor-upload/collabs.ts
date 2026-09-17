import { isPrimerRoundClientId } from '@/lib/primer-round/constants'
import { resolvePrimerRoundCollaborators, type IgCollaborator } from '@/lib/primer-round/collabs'

function cleanHandle(raw: string): string {
  return raw.trim().replace(/^@/, '')
}

/**
 * Instagram collaborators for a Metricool draft.
 * Primer Round defaults to the locked hosts; other clients only get handles
 * the editor typed. Never invent usernames.
 */
export function resolveEditorUploadCollaborators(input: {
  clientId: string
  includeCollabs: boolean
  extraUsernames?: string[] | null
  env?: NodeJS.ProcessEnv
}): IgCollaborator[] {
  if (!input.includeCollabs) return []
  const extras = (input.extraUsernames ?? []).map(cleanHandle).filter(Boolean)
  if (isPrimerRoundClientId(input.clientId)) {
    const locked = resolvePrimerRoundCollaborators(input.env)
    const seen = new Set(locked.map((c) => c.username.toLowerCase()))
    const more = extras
      .filter((u) => !seen.has(u.toLowerCase()))
      .map((username) => ({ username, deleted: false as const }))
    return [...locked, ...more]
  }
  return extras.map((username) => ({ username, deleted: false as const }))
}

export function defaultIncludeCollabs(clientId: string): boolean {
  return isPrimerRoundClientId(clientId)
}
