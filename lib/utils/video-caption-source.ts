export type CaptionSourceVideo = {
  id: string
  kind: string | null
  status: string | null
  drive_file_id: string | null
  storage_provider: string | null
}

const KIND_RANK: Record<string, number> = { edited: 0, raw: 1, broll: 2 }

/** Best file to listen to / watch when writing the caption. */
export function pickCaptionSourceVideo(
  videos: CaptionSourceVideo[],
): CaptionSourceVideo | null {
  const live = videos.filter((v) => v.status !== 'archived' && v.drive_file_id)
  if (live.length === 0) return null
  return [...live].sort((a, b) => {
    const ra = KIND_RANK[a.kind ?? ''] ?? 9
    const rb = KIND_RANK[b.kind ?? ''] ?? 9
    return ra - rb
  })[0]
}

/**
 * Permanent public URL — only when the object is actually fetchable.
 * Pipeline R2's worker 404s everything except `/edited/`. Entregas R2
 * is the public domain Metricool already uses.
 */
export function publicUrlForCaptionVideo(
  video: CaptionSourceVideo | null,
  urls: { r2: (key: string) => string | null; entregas: (key: string) => string | null },
): string | null {
  const key = video?.drive_file_id?.replace(/^\//, '') ?? null
  if (!key) return null
  if (video?.storage_provider === 'entregas-r2') return urls.entregas(key)
  if (video?.kind !== 'edited') return null
  return urls.r2(key)
}
