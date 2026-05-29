'use server'

import { createClient } from '@/lib/supabase/server'
import type { SocialPlatform } from '@/lib/supabase/types'

export interface CachedMetricoolProfile {
  id: string
  name: string
  picture: string | null
  networks: SocialPlatform[]
}

/**
 * Connected profiles served from Supabase (the `clients` table) instead of
 * hitting the Metricool API on every page load. Refreshed on demand only.
 */
export async function getCachedMetricoolProfiles(): Promise<CachedMetricoolProfile[]> {
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
    picture: (c.logo_url as string | null) ?? null,
    networks: ((c.platforms as SocialPlatform[] | null) ?? []),
  }))
}
