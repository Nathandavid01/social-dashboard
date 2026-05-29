import { createClient } from '@/lib/supabase/server'

/** Current week, Monday→Sunday, as ISO datetimes. */
function weekRangeMon(ref: Date = new Date()) {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
  const offset = (d.getDay() + 6) % 7
  const start = new Date(d)
  start.setDate(d.getDate() - offset)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

interface SchedulerPost {
  publicationDate?: { dateTime?: string }
  draft?: boolean
}

async function fetchWeekCount(blogId: string, startStr: string, endStr: string, nowStr: string): Promise<number> {
  const token = process.env.METRICOOL_TOKEN
  const userId = process.env.METRICOOL_USER_ID
  if (!token || !userId) return 0
  const url = `https://app.metricool.com/api/v2/scheduler/posts?userId=${userId}&blogId=${blogId}&start=${startStr}&end=${endStr}`
  try {
    const res = await fetch(url, { headers: { 'X-Mc-Auth': token }, next: { revalidate: 300 } })
    if (!res.ok) return 0
    const json = (await res.json()) as { data?: SchedulerPost[] }
    // "Posted" = not a draft and already published (publicationDate in [weekStart, now]).
    return (json.data ?? []).filter((p) => {
      if (p.draft) return false
      const dt = p.publicationDate?.dateTime
      return !!dt && dt >= startStr && dt <= nowStr
    }).length
  } catch {
    return 0
  }
}

/** Posts actually published this week per client, pulled from Metricool. */
export async function getMetricoolWeeklyPostsByClient(): Promise<Record<string, number>> {
  const supabase = await createClient()
  const { data: clients } = await supabase
    .from('clients')
    .select('id, metricool_blog_id')
    .eq('status', 'active')
    .not('metricool_blog_id', 'is', null)

  if (!clients?.length) return {}

  const { start, end } = weekRangeMon()
  const startStr = start.toISOString().slice(0, 19)
  const endStr = end.toISOString().slice(0, 19)
  const nowStr = new Date().toISOString().slice(0, 19)

  const out: Record<string, number> = {}
  const CHUNK = 8
  for (let i = 0; i < clients.length; i += CHUNK) {
    const chunk = clients.slice(i, i + CHUNK)
    const counts = await Promise.all(
      chunk.map((c) => fetchWeekCount(c.metricool_blog_id as string, startStr, endStr, nowStr)),
    )
    chunk.forEach((c, j) => { out[c.id as string] = counts[j] })
  }
  return out
}
