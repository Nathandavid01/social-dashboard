export type MetricoolPublishedPost = {
  id?: string | number
  draft?: boolean
  text?: string | null
  media?: string[] | null
  providers?: { status?: string | null }[] | null
}

const VIDEO_URL = /\.(mp4|mov|m4v)(\?|$)/i

export function isPublishedVideoPost(post: MetricoolPublishedPost): boolean {
  if (post.draft) return false
  const video = (post.media ?? []).some((url) => VIDEO_URL.test(url))
  const live = (post.providers ?? []).some((provider) => provider.status === 'PUBLISHED')
  return video && live
}

export function countPublishedVideos(posts: MetricoolPublishedPost[]): number {
  return posts.filter(isPublishedVideoPost).length
}

function norm(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * One published post that is the same video, or null when nothing is specific enough.
 * Shared words like the brand name are not enough.
 */
export function matchingPublishedPost<T extends MetricoolPublishedPost>(
  idea: { title?: string | null; generated_caption?: string | null; metricool_post_id?: number | null },
  posts: T[],
): T | null {
  const published = posts.filter(isPublishedVideoPost)
  const title = norm(idea.title)
  const caption = norm(idea.generated_caption)
  const hits = published.filter((post) => {
    if (idea.metricool_post_id != null && String(post.id) === String(idea.metricool_post_id)) return true
    const text = norm(post.text)
    if (title.length >= 12 && text.includes(title)) return true
    if (caption.length >= 40 && text.includes(caption.slice(0, 48))) return true
    return false
  })
  return hits.length === 1 ? hits[0] : null
}
