import { publicationInstant, puertoRicoDay } from './publication-date'

export interface CalendarPullIdea {
  id: string
  metricool_post_id: number | null
  metricool_uuid?: string | null
  publish_date: string | null
}

export interface CalendarPullPost {
  id: number
  uuid?: string | null
  publicationDate?: string | { dateTime?: string | null; timezone?: string | null } | null
}

export function ideaCalendarDatePatches(
  ideas: CalendarPullIdea[],
  posts: Iterable<CalendarPullPost>,
): { id: string; publish_date: string }[] {
  const byId = new Map<number, CalendarPullPost>()
  const byUuid = new Map<string, CalendarPullPost>()
  for (const post of posts) {
    byId.set(post.id, post)
    if (post.uuid) byUuid.set(post.uuid, post)
  }
  const patches: { id: string; publish_date: string }[] = []
  for (const idea of ideas) {
    const post = (idea.metricool_post_id != null ? byId.get(idea.metricool_post_id) : undefined)
      ?? (idea.metricool_uuid ? byUuid.get(idea.metricool_uuid) : undefined)
    if (!post) continue
    const raw = post.publicationDate
    const value = typeof raw === 'string' ? { dateTime: raw, timezone: 'America/Puerto_Rico' } : raw ?? undefined
    const instant = publicationInstant(value)
    const day = instant ? puertoRicoDay(new Date(instant)) : null
    if (!day || day === idea.publish_date) continue
    patches.push({ id: idea.id, publish_date: day })
  }
  return patches
}

export function unverifiedClientsForFailedBlogs(
  clients: { id: string; name: string; metricool_blog_id: string | null }[],
  failedBlogIds: Iterable<string>,
): { id: string; name: string }[] {
  const failed = new Set(failedBlogIds)
  return clients
    .filter((client) => client.metricool_blog_id && failed.has(client.metricool_blog_id))
    .map((client) => ({ id: client.id, name: client.name }))
}
