import { todayISOInTimeZone } from './deadlines'
import { POSTING_TZ, validateScheduleOverride, type ScheduleOverrideResult } from './publish-override'

/** Automatic approval must never silently move an old/undated video to a new day. */
export function automaticPublishSchedule(
  publishDate: string | null | undefined,
  postingTime: string | null | undefined,
  nowMs = Date.now(),
): ScheduleOverrideResult {
  if (!publishDate || !/^\d{4}-\d{2}-\d{2}$/.test(publishDate)) {
    return { ok: false, error: 'Falta una fecha de publicación válida; guarda la fecha antes de enviar a Metricool' }
  }
  const today = todayISOInTimeZone(POSTING_TZ, new Date(nowMs))
  if (publishDate < today) return { ok: false, error: `La fecha ${publishDate} ya pasó; no se reprogramó ni se envió a Metricool` }
  const time = postingTime?.trim() || '10:00'
  if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(time)) return { ok: false, error: 'La hora de publicación del cliente no es válida' }
  const [h, m] = time.split(':')
  return validateScheduleOverride(`${publishDate}T${h.padStart(2, '0')}:${m}`, nowMs)
}
