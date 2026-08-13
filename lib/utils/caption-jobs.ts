/** One caption generation job per social network. Day-1 contract for auto captions. */

export interface CaptionJob {
  platform: string
  focus: string
}

const FOCUS: Record<string, string> = {
  instagram: 'hook en la primera línea, emojis con medida, hashtags al final',
  tiktok: 'corto y oral, sin muro de hashtags',
  facebook: 'un poco más de contexto y un CTA claro',
  linkedin: 'tono profesional, pocos emojis',
}

export function captionJobsForPlatforms(
  platforms: Array<string | null | undefined> | null | undefined,
): CaptionJob[] {
  const seen = new Set<string>()
  const jobs: CaptionJob[] = []
  for (const raw of platforms ?? []) {
    const p = (raw ?? '').trim().toLowerCase()
    if (!p || seen.has(p)) continue
    seen.add(p)
    jobs.push({ platform: p, focus: FOCUS[p] ?? 'tono natural de esa red' })
  }
  if (jobs.length === 0) {
    return [{ platform: 'all', focus: 'un solo caption que funcione en todas las redes' }]
  }
  return jobs
}
