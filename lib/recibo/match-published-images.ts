import type { MatchPost, ReciboPublishedMatch } from './match-published'

export const IMAGE_URL = /\.(png|jpe?g|webp|gif)(\?|$)/i

function imageUrl(post: MatchPost): string | null {
  if (post.draft || !(post.providers ?? []).some(p => p.status === 'PUBLISHED' || p.status === 'PENDING')) return null
  if (post.media?.length !== 1) return null
  const item = post.media[0]
  const url = typeof item === 'string' ? item : item && typeof item === 'object' ? (item as {url?:unknown}).url : null
  return typeof url === 'string' && IMAGE_URL.test(url) ? url : null
}

export function measurableImages(posts: MatchPost[]): string[] {
  return [...new Set(posts.map(imageUrl).filter((url): url is string => url != null))]
}

/** Images use byte hashes, never size or captions: equal lengths do not prove equal graphics. */
export function matchReciboPublishedImages<P extends MatchPost>(
  ideas: {id:string; fingerprint?:string}[], posts:P[], fingerprintOf:(url:string)=>string|undefined,
):ReciboPublishedMatch<P>[] {
  const owners = new Map<string,string|null>()
  for (const idea of ideas) {
    if (!idea.fingerprint) continue
    const previous = owners.get(idea.fingerprint)
    owners.set(idea.fingerprint, previous === undefined || previous === idea.id ? idea.id : null)
  }
  const best = new Map<string,P>()
  for (const post of posts) {
    const url = imageUrl(post)
    const hash = url ? fingerprintOf(url) : undefined
    const id = hash ? owners.get(hash) : null
    if (!id) continue
    const previous = best.get(id)
    const live = (p:MatchPost) => (p.providers ?? []).some(provider => provider.status === 'PUBLISHED')
    if (!previous || (live(post) && !live(previous)) || live(post) === live(previous) && (post.publicationDate?.dateTime ?? '') > (previous.publicationDate?.dateTime ?? '')) best.set(id,post)
  }
  return [...best].map(([ideaId,post])=>({ideaId,post}))
}
