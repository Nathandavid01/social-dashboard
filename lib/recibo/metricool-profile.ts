/**
 * Match a dashboard client to its Metricool brand when `metricool_blog_id`
 * was never saved. Used so Recibo captions imitate THAT client's published
 * posts, not the agency default blog.
 */

export type MetricoolProfileName = {
  id: string | number
  /** simpleProfiles uses `label`. Some callers pass `name`. */
  name?: string | null
  label?: string | null
}

export function normalizeBrandName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function collapseRepeats(value: string): string {
  return value.replace(/(.)\1+/g, '$1')
}

function levenshtein(a: string, b: string): number {
  const rows = Array.from({ length: b.length + 1 }, (_, i) => [i])
  for (let j = 0; j <= a.length; j++) rows[0][j] = j
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost)
    }
  }
  return rows[b.length][a.length]
}

/** Lower is better. null = not the same brand. */
function brandDistance(clientName: string, profileName: string): number | null {
  const client = normalizeBrandName(clientName)
  const profile = normalizeBrandName(profileName)
  if (!client || !profile) return null
  if (client === profile) return 0
  const a = collapseRepeats(client)
  const b = collapseRepeats(profile)
  if (a === b) return 0
  if (a.length < 6 || b.length < 6) return null
  if (Math.abs(a.length - b.length) > 3) return null
  const distance = levenshtein(a, b)
  return distance <= 2 ? distance : null
}

/**
 * The Metricool blog id for this client, or null when nothing is close enough
 * or two brands tie.
 */
export function matchMetricoolBlogId(
  clientName: string,
  profiles: MetricoolProfileName[],
): string | null {
  const ranked = profiles
    .map((profile) => ({
      id: String(profile.id),
      distance: brandDistance(clientName, profile.label?.trim() || profile.name?.trim() || ''),
    }))
    .filter((row): row is { id: string; distance: number } => row.distance != null)
    .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id))

  if (ranked.length === 0) return null
  if (ranked.length > 1 && ranked[0].distance === ranked[1].distance) return null
  return ranked[0].id
}
