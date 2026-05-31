'use server'

import { getProfiles } from '@/lib/metricool/client'

/**
 * Map of Metricool blogId → brand profile picture URL, fetched from Metricool's
 * /admin/simpleProfiles. Best-effort: returns {} when Metricool isn't configured
 * (missing METRICOOL_TOKEN / METRICOOL_USER_ID) or the request fails, so callers
 * gracefully fall back to an uploaded logo or initials.
 *
 * NOTE: requires METRICOOL_TOKEN and METRICOOL_USER_ID in the environment.
 */
export async function getMetricoolPicturesByBlogId(): Promise<Record<string, string>> {
  const userToken = process.env.METRICOOL_TOKEN
  const userId = process.env.METRICOOL_USER_ID
  if (!userToken || !userId) return {}

  try {
    const profiles = await getProfiles({ userToken, userId, blogId: process.env.METRICOOL_BLOG_ID ?? '' })
    const map: Record<string, string> = {}
    for (const p of profiles ?? []) {
      if (p?.id != null && typeof p.picture === 'string' && p.picture) {
        map[String(p.id)] = p.picture
      }
    }
    return map
  } catch (err) {
    console.warn('[client-pictures] Metricool fetch failed:', err instanceof Error ? err.message : err)
    return {}
  }
}
