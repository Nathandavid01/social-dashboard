export type MetricoolPublishedPost = {
  id?: string | number
  draft?: boolean
  text?: string | null
  media?: string[] | null
  providers?: { status?: string | null }[] | null
}

export const VIDEO_URL = /\.(mp4|mov|m4v)(\?|$)/i

function isPublishedVideoPost(post: MetricoolPublishedPost): boolean {
  if (post.draft) return false
  const video = (post.media ?? []).some((url) => VIDEO_URL.test(url))
  const live = (post.providers ?? []).some((provider) => provider.status === 'PUBLISHED')
  return video && live
}

export function countPublishedVideos(posts: MetricoolPublishedPost[]): number {
  return posts.filter(isPublishedVideoPost).length
}
