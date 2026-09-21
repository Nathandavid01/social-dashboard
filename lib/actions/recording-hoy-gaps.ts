'use server'

import { currentUserHas } from '@/lib/auth/server'
import { createClient } from '@/lib/supabase/server'
import {
  buildRecordingHoyGaps,
  emptyRecordingHoyGaps,
  type HoyGapIdea,
  type HoyGapSession,
  type RecordingHoyGapsResult,
} from '@/lib/onsite/recording-hoy-gaps'
import { addDaysISO, todayISOInTimeZone } from '@/lib/utils/deadlines'
import { readCompletePages } from '@/lib/utils/read-complete-pages'

const HORIZON_DAYS = 30

/**
 * Huecos de grabación para Mi Día y el badge del nav.
 * Fail-closed: sin recording.read devuelve vacío (no lanza) — /mi-dia no tiene gate.
 */
export async function getRecordingHoyGaps(): Promise<RecordingHoyGapsResult> {
  if (!await currentUserHas('recording.read')) return emptyRecordingHoyGaps(false)
  const today = todayISOInTimeZone('America/Puerto_Rico')
  const until = addDaysISO(today, HORIZON_DAYS)
  try {
    const db = await createClient()
    const rows = await readCompletePages<HoyGapSession>((from, to) =>
      db.from('recording_sessions')
        .select(
          'id,title,session_date,status,client_id,videographer_id,start_time,client:clients!recording_sessions_client_id_fkey(name,posting_days)',
          { count: 'exact' },
        )
        .gte('session_date', today)
        .lte('session_date', until)
        .not('status', 'in', '(completed,cancelled)')
        .order('id')
        .range(from, to) as unknown as PromiseLike<{
          data: HoyGapSession[] | null
          count: number | null
          error?: unknown
        }>,
    )
    const ideas: HoyGapIdea[] = []
    for (let n = 0; n < rows.length; n += 100) {
      ideas.push(...await readCompletePages<HoyGapIdea>((from, to) =>
        db.from('content_ideas')
          .select('id,title,status,client_id,recording_session_id', { count: 'exact' })
          .in('recording_session_id', rows.slice(n, n + 100).map((s) => s.id))
          .order('id')
          .range(from, to),
      ))
    }
    return { visible: true, ...buildRecordingHoyGaps(rows, ideas, today) }
  } catch {
    return emptyRecordingHoyGaps(true, 'No se pudieron verificar los huecos de grabación')
  }
}
