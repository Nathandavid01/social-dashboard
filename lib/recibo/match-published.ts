import { VIDEO_URL } from '@/lib/recibo/published-videos'

/**
 * Which Recibo cuts already left through Metricool, even when the team posted
 * them by hand there (another caption, no link back to the dashboard).
 *
 * Metricool keeps the uploaded file byte for byte (measured 2026-09-25: R2 and
 * static.metricool.com sizes are identical), and its API returns no size, name
 * or duration — so the exact byte size of the media is the fingerprint. Only
 * unambiguous matches count: a false match would hide an unpublished video.
 */

export type MatchPost = {
  id: number
  uuid?: string | null
  draft?: boolean | null
  media?: unknown[] | null
  providers?: { status?: string | null }[] | null
  publicationDate?: { dateTime?: string | null } | null
}

type MatchVideo = { kind?: string | null; status?: string | null; size_bytes?: number | null }
export type MatchIdea = { id: string; videos?: MatchVideo[] | null }

export type ReciboPublishedMatch = {
  ideaId: string
  postId: number
  uuid: string | null
  /** Date part of Metricool's publicationDate. */
  publishDate: string | null
}

function mediaUrl(item: unknown): string | null {
  if (typeof item === 'string') return item
  if (item && typeof item === 'object' && typeof (item as { url?: unknown }).url === 'string') {
    return (item as { url: string }).url
  }
  return null
}

/** The post's single video URL, when the post counts as "the video left": not a draft, not failed everywhere. */
function leftVideoUrl(post: MatchPost): string | null {
  if (post.draft) return null
  const providers = post.providers ?? []
  if (providers.length > 0 && providers.every((p) => p.status === 'ERROR')) return null
  const urls = (post.media ?? []).map(mediaUrl)
  if (urls.length !== 1 || !urls[0] || !VIDEO_URL.test(urls[0])) return null
  return urls[0]
}

function isLive(post: MatchPost): boolean {
  return (post.providers ?? []).some((p) => p.status === 'PUBLISHED')
}

/** A repost of the same file: the live one wins, then the most recent. */
function isBetter(a: MatchPost, b: MatchPost): boolean {
  if (isLive(a) !== isLive(b)) return isLive(a)
  return (a.publicationDate?.dateTime ?? '') > (b.publicationDate?.dateTime ?? '')
}

/** Media worth measuring: only posts that could match. */
export function measurableMedia(posts: MatchPost[]): string[] {
  return posts.map(leftVideoUrl).filter((url): url is string => url != null)
}

export function matchReciboPublished(
  ideas: MatchIdea[],
  posts: MatchPost[],
  sizeOf: (url: string) => number | undefined,
): ReciboPublishedMatch[] {
  // size → the one idea whose usable edited cut has it; null once two ideas share it.
  const owner = new Map<number, string | null>()
  for (const idea of ideas) {
    for (const video of idea.videos ?? []) {
      if (video.kind !== 'edited' || video.status === 'archived' || video.status === 'failed') continue
      const size = video.size_bytes
      if (!size || size <= 0) continue
      const prev = owner.get(size)
      owner.set(size, prev === undefined || prev === idea.id ? idea.id : null)
    }
  }

  const best = new Map<string, MatchPost>()
  for (const post of posts) {
    const url = leftVideoUrl(post)
    const size = url ? sizeOf(url) : undefined
    const ideaId = size ? owner.get(size) : null
    if (!ideaId) continue
    const current = best.get(ideaId)
    if (!current || isBetter(post, current)) best.set(ideaId, post)
  }

  return [...best].map(([ideaId, post]) => ({
    ideaId,
    postId: post.id,
    uuid: post.uuid ?? null,
    publishDate: post.publicationDate?.dateTime?.slice(0, 10) ?? null,
  }))
}
