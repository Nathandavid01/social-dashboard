/**
 * Carátula del Panel (/pool).
 *
 * Prioridad: thumbnail ya guardado (drive_thumb_url o primer thumb_key)
 * → extraer un frame del mp4 → placeholder. Nunca inventa un FK extra
 * entre content_ideas y content_idea_videos: el poster vive en thumb_keys
 * del mismo video y en el mismo bucket (r2 vs entregas-r2).
 */

export type PoolVideoCoverInput = {
  id: string
  kind?: string | null
  status?: string | null
  drive_thumb_url?: string | null
  thumb_keys?: string[] | null
  storage_provider?: string | null
  drive_file_id?: string | null
}

export type PoolCaratulaThumb = {
  videoId: string
  key: string
  storageProvider: string
}

export type PoolCaratulaResolved = {
  coverUrl: string | null
  coverVideoId: string | null
  coverThumb: PoolCaratulaThumb | null
}

const KIND_ORDER = ['edited', 'raw', 'broll'] as const

function usable(v: PoolVideoCoverInput): boolean {
  return v.status !== 'archived' && v.status !== 'failed'
}

function pickByKind(videos: PoolVideoCoverInput[]): PoolVideoCoverInput[] {
  const live = videos.filter(usable)
  const ordered: PoolVideoCoverInput[] = []
  const seen = new Set<string>()
  for (const kind of KIND_ORDER) {
    for (const v of live) {
      if (v.kind === kind && !seen.has(v.id)) {
        ordered.push(v)
        seen.add(v.id)
      }
    }
  }
  for (const v of live) {
    if (!seen.has(v.id)) {
      ordered.push(v)
      seen.add(v.id)
    }
  }
  return ordered
}

function firstThumbKey(v: PoolVideoCoverInput): string | null {
  return (v.thumb_keys ?? []).find((k) => typeof k === 'string' && k.length > 0) ?? null
}

function isR2Provider(provider: string | null | undefined): boolean {
  return provider === 'r2' || provider === 'entregas-r2'
}

export function resolvePoolCaratula(videos: PoolVideoCoverInput[]): PoolCaratulaResolved {
  const ordered = pickByKind(videos)

  for (const v of ordered) {
    const url = v.drive_thumb_url?.trim()
    if (url) {
      return { coverUrl: url, coverVideoId: v.id, coverThumb: null }
    }
  }

  for (const v of ordered) {
    const key = firstThumbKey(v)
    if (key && isR2Provider(v.storage_provider)) {
      return {
        coverUrl: null,
        coverVideoId: v.id,
        coverThumb: {
          videoId: v.id,
          key,
          storageProvider: v.storage_provider as string,
        },
      }
    }
  }

  const first = ordered[0]
  if (first) {
    return { coverUrl: null, coverVideoId: first.id, coverThumb: null }
  }

  return { coverUrl: null, coverVideoId: null, coverThumb: null }
}

export function applySignedPoolCaratula(
  resolved: PoolCaratulaResolved,
  signedByVideoId: Record<string, string>,
): { coverUrl: string | null; coverVideoId: string | null } {
  if (resolved.coverUrl) {
    return { coverUrl: resolved.coverUrl, coverVideoId: null }
  }
  const signed = resolved.coverThumb ? signedByVideoId[resolved.coverThumb.videoId] : undefined
  if (signed) {
    return { coverUrl: signed, coverVideoId: null }
  }
  return { coverUrl: null, coverVideoId: resolved.coverVideoId }
}

/** Carpeta del video (todo antes del último segmento de la key). */
export function dirnameOfKey(key: string): string {
  const i = key.lastIndexOf('/')
  return i === -1 ? '' : key.slice(0, i)
}

export function poolPosterObjectKey(driveFileId: string): string {
  const folder = dirnameOfKey(driveFileId)
  return folder ? `${folder}/thumbs/poster.jpg` : 'thumbs/poster.jpg'
}

export function isSafePoolPosterKey(driveFileId: string, key: string): boolean {
  const folder = dirnameOfKey(driveFileId)
  if (!folder || !key) return false
  return key.startsWith(`${folder}/thumbs/`)
}
