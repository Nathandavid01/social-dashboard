import type { PublicBlog } from '@/lib/metricool/client'

/** Build blogId → profile picture URL from Metricool simpleProfiles. */
export function mapMetricoolPictures(profiles: PublicBlog[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const p of profiles ?? []) {
    const row = p as Record<string, unknown>
    if (row.deleted || row.isDemo) continue
    const id = p.id ?? row.id
    const picture =
      (typeof p.picture === 'string' && p.picture.trim()) ||
      (typeof row.userPicture === 'string' && row.userPicture.trim()) ||
      (typeof row.picture === 'string' && row.picture.trim()) ||
      null
    if (id != null && picture) {
      map[String(id)] = picture
    }
  }
  return map
}
