'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import { getAllSimpleProfiles } from '@/lib/metricool/client'
import { metricoolProfileLinks, type ProfileLinks } from '@/lib/utils/metricool-profile-links'
import type { SocialPlatform } from '@/lib/supabase/types'

export interface CachedMetricoolProfile {
  id: string
  name: string
  picture: string | null
  networks: SocialPlatform[]
  links?: ProfileLinks
}

/**
 * Client roster from Supabase, enriched with exact provider links from the
 * server-side Metricool response (cached for five minutes).
 */
export async function getCachedMetricoolProfiles(): Promise<CachedMetricoolProfile[]> {
  await requirePermission('metricool.read')
  let linked = new Map<string, ProfileLinks>()
  if (process.env.METRICOOL_TOKEN) {
    try {
      const profiles = await getAllSimpleProfiles(process.env.METRICOOL_TOKEN, process.env.METRICOOL_USER_ID)
      linked = new Map(profiles.map(p => [String(p.id), metricoolProfileLinks(p)]))
    } catch { /* Cached profiles remain visible; unavailable links are labelled. */ }
  }
  const supabase = await createClient()
  const { data } = await supabase
    .from('clients')
    .select('name, metricool_blog_id, platforms, logo_url')
    .not('metricool_blog_id', 'is', null)
    .eq('status', 'active')
    .order('name', { ascending: true })

  return (data ?? []).map((c) => ({
    id: c.metricool_blog_id as string,
    name: c.name as string,
    links: linked.get(String(c.metricool_blog_id)) ?? {},
    picture: (c.logo_url as string | null) ?? null,
    networks: ((c.platforms as SocialPlatform[] | null) ?? []),
  }))
}
