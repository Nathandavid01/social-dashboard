import { createClient } from '@/lib/supabase/server'

export interface WeeklyProductionStatus {
  /** Videos (content_ideas) tied to this week's recording sessions, excluding descartadas. */
  total: number
  grabados: number
  editados: number
  conCaptions: number
}

/** Current week, Monday→Sunday, as YYYY-MM-DD strings. */
function weekRangeMon(ref: Date = new Date()): { start: string; end: string } {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
  const offset = (d.getDay() + 6) % 7
  const start = new Date(d)
  start.setDate(d.getDate() - offset)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const fmt = (x: Date) => x.toISOString().slice(0, 10)
  return { start: fmt(start), end: fmt(end) }
}

export async function getWeeklyProductionStatus(): Promise<WeeklyProductionStatus> {
  const supabase = await createClient()
  const { start, end } = weekRangeMon()

  const { data: sessions } = await supabase
    .from('recording_sessions')
    .select('id')
    .gte('session_date', start)
    .lte('session_date', end)
    .neq('status', 'cancelled')

  const sessionIds = (sessions ?? []).map((s) => s.id)
  if (sessionIds.length === 0) return { total: 0, grabados: 0, editados: 0, conCaptions: 0 }

  const { data: ideas } = await supabase
    .from('content_ideas')
    .select('status, generated_caption')
    .in('recording_session_id', sessionIds)
    .neq('status', 'descartada')

  const rows = (ideas ?? []) as { status: string; generated_caption: string | null }[]
  const grabado = new Set(['grabada', 'producida', 'publicada'])
  const editado = new Set(['producida', 'publicada'])

  let grabados = 0
  let editados = 0
  let conCaptions = 0
  for (const r of rows) {
    if (grabado.has(r.status)) grabados++
    if (editado.has(r.status)) editados++
    if (r.generated_caption) conCaptions++
  }

  return { total: rows.length, grabados, editados, conCaptions }
}
