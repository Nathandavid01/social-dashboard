'use server'

import { getAllSimpleProfiles } from '@/lib/metricool/client'
import { mapMetricoolPictures } from '@/lib/utils/metricool-pictures'

/**
 * Map of Metricool blogId → brand profile picture URL, fetched from Metricool's
 * /admin/simpleProfiles. Best-effort: returns {} when Metricool isn't configured
 * (missing METRICOOL_TOKEN) or the request fails, so callers gracefully fall
 * back to an uploaded logo or initials.
 */
export async function getMetricoolPicturesByBlogId(): Promise<Record<string, string>> {
  const userToken = process.env.METRICOOL_TOKEN
  if (!userToken) return {}

  try {
    const profiles = await getAllSimpleProfiles(userToken, process.env.METRICOOL_USER_ID)
    return mapMetricoolPictures(profiles)
  } catch (err) {
    console.warn('[client-pictures] Metricool fetch failed:', err instanceof Error ? err.message : err)
    return {}
  }
}
