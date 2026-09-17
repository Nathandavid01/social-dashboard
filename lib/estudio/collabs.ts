import { isPrimerRoundClientId } from '@/lib/primer-round/constants'
import {
  resolvePrimerRoundCollaborators,
  type IgCollaborator,
} from '@/lib/primer-round/collabs'

export type { IgCollaborator }

/** Strip @, drop junk, de-dupe (case-insensitive). Never invent handles. */
export function sanitizeCollabUsernames(raw: string[] | null | undefined): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of raw ?? []) {
    const username = item.trim().replace(/^@+/, '').replace(/[^a-zA-Z0-9._]/g, '')
    const key = username.toLowerCase()
    if (!username || seen.has(key)) continue
    seen.add(key)
    out.push(username)
  }
  return out
}

/**
 * IG collabs for a Metricool draft.
 * Explicit usernames win. Primer Round falls back to rafaellenin + denniseyperez.
 * includeCollabs=false always yields [].
 */
export function resolveStudioCollaborators(input: {
  clientId: string
  includeCollabs?: boolean
  usernames?: string[] | null
}): IgCollaborator[] {
  if (input.includeCollabs === false) return []
  const requested = sanitizeCollabUsernames(input.usernames)
  if (requested.length > 0) {
    return requested.map((username) => ({ username, deleted: false as const }))
  }
  if (isPrimerRoundClientId(input.clientId)) {
    return resolvePrimerRoundCollaborators()
  }
  return []
}

export function studioNeedsDefaultCollabs(clientId: string): boolean {
  return isPrimerRoundClientId(clientId)
}
