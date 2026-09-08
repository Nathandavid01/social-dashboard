import type { SocialPlatform } from '@/lib/supabase/types'
export type ProfileLinks = Partial<Record<SocialPlatform, string>>
const domains: Record<SocialPlatform, string> = {instagram:'instagram.com',facebook:'facebook.com',tiktok:'tiktok.com',linkedin:'linkedin.com'}

/** Only provider identifiers/URLs from Metricool; never guess from a brand name. */
export function metricoolProfileLinks(profile: Record<string, unknown>): ProfileLinks {
  const result: ProfileLinks = {}
  for (const platform of Object.keys(domains) as SocialPlatform[]) {
    const value = profile[platform]
    if (typeof value !== 'string' || !value.trim()) continue
    const raw = value.trim()
    if (/^https:\/\//i.test(raw)) {
      try {
        const url = new URL(raw)
        if (!url.username && !url.password && (url.hostname === domains[platform] || url.hostname === `www.${domains[platform]}`)) result[platform] = url.href
      } catch { /* Missing links remain unavailable. */ }
      continue
    }
    const handle = raw.replace(/^@/, '')
    if (!/^[\w.-]+$/.test(handle)) continue
    if (platform === 'instagram') result.instagram = `https://www.instagram.com/${handle}/`
    if (platform === 'facebook') result.facebook = `https://www.facebook.com/${handle}`
    if (platform === 'tiktok') result.tiktok = `https://www.tiktok.com/@${handle}`
    // LinkedIn identifiers alone don't distinguish a person from a company.
  }
  return result
}
