import { PRIMER_ROUND_DEFAULT_COLLABS } from './constants'

export type IgCollaborator = { username: string; deleted: false }

/**
 * Resolve IG collab usernames for Metricool.
 * Priority: env PRIMER_ROUND_COLLAB_USERNAMES (comma-separated) → hardcoded defaults.
 * Never invent handles beyond the locked defaults / env override.
 */
export function resolvePrimerRoundCollaborators(
  env: NodeJS.ProcessEnv = process.env,
): IgCollaborator[] {
  const fromEnv = (env.PRIMER_ROUND_COLLAB_USERNAMES ?? '')
    .split(',')
    .map((s) => s.trim().replace(/^@/, ''))
    .filter(Boolean)
  const usernames = fromEnv.length > 0
    ? fromEnv
    : PRIMER_ROUND_DEFAULT_COLLABS.map((c) => c.username)
  return usernames.map((username) => ({ username, deleted: false as const }))
}

export function primerRoundCollabLabels(
  env: NodeJS.ProcessEnv = process.env,
): Array<{ username: string; label: string }> {
  const collabs = resolvePrimerRoundCollaborators(env)
  return collabs.map((c) => {
    const known = PRIMER_ROUND_DEFAULT_COLLABS.find((d) => d.username === c.username)
    return { username: c.username, label: known?.label ?? c.username }
  })
}
