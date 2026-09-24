import 'server-only'

import { getAllSimpleProfiles } from '@/lib/metricool/client'
import { matchMetricoolBlogId } from '@/lib/recibo/metricool-profile'
import { countPublishedVideos, type MetricoolPublishedPost } from '@/lib/recibo/published-videos'

export type PublishedVideoCounts = {
  total: number
  byClient: Record<string, number>
}

async function postsForBlog(blogId: string, userId: string, token: string): Promise<MetricoolPublishedPost[]> {
  const url = new URL('https://app.metricool.com/api/v2/scheduler/posts')
  url.searchParams.set('userId', userId)
  url.searchParams.set('blogId', blogId)
  url.searchParams.set('start', '2025-01-01T00:00:00')
  url.searchParams.set('end', '2026-12-31T23:59:59')
  const res = await fetch(url, { headers: { 'X-Mc-Auth': token }, next: { revalidate: 300 } })
  if (!res.ok) return []
  const json = await res.json()
  return (json.data ?? []) as MetricoolPublishedPost[]
}

/** Published videos in Metricool for each AI client. Missing Metricool config counts as zero. */
export async function loadPublishedVideoCounts(
  clients: { id: string; name: string; metricool_blog_id?: string | null }[],
): Promise<PublishedVideoCounts> {
  const token = process.env.METRICOOL_TOKEN?.trim()
  const userId = process.env.METRICOOL_USER_ID?.trim()
  const byClient: Record<string, number> = {}
  if (!token || !userId || clients.length === 0) return { total: 0, byClient }

  let profiles: { id: string | number; label?: string | null; name?: string | null }[] = []
  try {
    profiles = await getAllSimpleProfiles(token, userId)
  } catch {
    profiles = []
  }

  let total = 0
  for (const client of clients) {
    const blogId = client.metricool_blog_id?.trim() || matchMetricoolBlogId(client.name, profiles)
    if (!blogId) {
      byClient[client.id] = 0
      continue
    }
    try {
      const posts = await postsForBlog(blogId, userId, token)
      const count = countPublishedVideos(posts)
      byClient[client.id] = count
      total += count
    } catch {
      byClient[client.id] = 0
    }
  }
  return { total, byClient }
}
