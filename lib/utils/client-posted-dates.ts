import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { collectPostedDates, type MetricoolPostLike } from './posting-schedule'

/**
 * Resolve the set of local YYYY-MM-DD dates a client actually posted within a
 * window, unioning content_ideas marked `publicada` with non-draft Metricool
 * posts. Server-only (touches Supabase + Metricool). The matching logic lives in
 * the pure `collectPostedDates` helper.
 */
export async function getClientPostedDates(
  clientId: string,
  blogId: string | null,
  startIso: string,
  endIso: string,
): Promise<Set<string>> {
  const supabase = await createClient()

  const { data: ideas } = await supabase
    .from('content_ideas')
    .select('published_at')
    .eq('client_id', clientId)
    .eq('status', 'publicada')
    .gte('published_at', startIso)
    .lte('published_at', endIso)

  let metricoolPosts: MetricoolPostLike[] = []
  if (blogId) {
    const token = process.env.METRICOOL_TOKEN
    const userId = process.env.METRICOOL_USER_ID
    if (token && userId) {
      try {
        const start = startIso.slice(0, 19)
        const end = endIso.slice(0, 19)
        const url = `https://app.metricool.com/api/v2/scheduler/posts?userId=${userId}&blogId=${blogId}&start=${start}&end=${end}`
        const res = await fetch(url, { headers: { 'X-Mc-Auth': token } })
        if (res.ok) {
          const json = (await res.json()) as { data?: MetricoolPostLike[] }
          metricoolPosts = json.data ?? []
        }
      } catch {
        /* proceed with just the idea-derived dates */
      }
    }
  }

  return collectPostedDates(ideas ?? [], metricoolPosts)
}
