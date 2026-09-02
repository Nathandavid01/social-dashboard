import { resolveSlotTime } from './posting-schedule'
import { isoWeekday } from './next-autopost-core'
import { isoWeekdayToJs } from './posting-days-sot'

/**
 * "Aprobado para las ___": la hora objetivo a la que un corte tiene que estar
 * aprobado para llegar a su publicación (Eric, 2026-09-02: el editor debe
 * verla al bajar el crudo). Se calcula, no se inventa: fecha de publicación a
 * la hora del cliente menos un margen de revisión; si hay fecha límite
 * (deadline) más temprana, gana la fecha límite. Sin fecha de publicación ni
 * límite → null (la UI lo dice tal cual).
 */
export const REVIEW_BUFFER_HOURS = 24

export interface ApprovalTarget {
  /** "YYYY-MM-DDTHH:MM" en hora local del cliente (Puerto Rico). */
  at: string
  /** De dónde salió: la publicación menos el margen, o la fecha límite. */
  basis: 'publish' | 'deadline'
  /** Cuándo publica, para el texto "publica mié 3 · 10:00". */
  publishAt: string | null
}

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DIA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

function localDateTime(dateISO: string, hhmm: string): Date {
  const [y, m, d] = dateISO.split('-').map(Number)
  const [hh, mm] = hhmm.split(':').map(Number)
  return new Date(y, m - 1, d, hh, mm, 0, 0)
}

function toLocalIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function approvalTarget(input: {
  publishDate: string | null | undefined
  deadline?: string | null
  postingTime?: string | null
  postingSchedule?: Record<string, string> | null
  reviewBufferHours?: number
}): ApprovalTarget | null {
  const buffer = input.reviewBufferHours ?? REVIEW_BUFFER_HOURS
  let fromPublish: Date | null = null
  let publishAt: string | null = null
  if (input.publishDate && /^\d{4}-\d{2}-\d{2}$/.test(input.publishDate)) {
    const dow = isoWeekdayToJs(isoWeekday(input.publishDate))
    const time = resolveSlotTime(dow, input.postingTime, input.postingSchedule) ?? '10:00'
    const publish = localDateTime(input.publishDate, time)
    publishAt = toLocalIso(publish)
    fromPublish = new Date(publish.getTime() - buffer * 3600 * 1000)
  }
  let fromDeadline: Date | null = null
  if (input.deadline && /^\d{4}-\d{2}-\d{2}$/.test(input.deadline)) {
    fromDeadline = localDateTime(input.deadline, '17:00')
  }
  if (!fromPublish && !fromDeadline) return null
  if (fromPublish && (!fromDeadline || fromPublish <= fromDeadline)) {
    return { at: toLocalIso(fromPublish), basis: 'publish', publishAt }
  }
  return { at: toLocalIso(fromDeadline!), basis: 'deadline', publishAt }
}

/** "mar 2 sep · 10:00" */
export function formatApprovalAt(localIso: string): string {
  const [date, time] = localIso.split('T')
  const [y, m, d] = date.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay()
  const [hh, mm] = time.split(':').map(Number)
  const h12 = ((hh + 11) % 12) + 1
  const ampm = hh < 12 ? 'a. m.' : 'p. m.'
  return `${DIA[dow]} ${d} ${MES[m - 1]} · ${h12}:${String(mm).padStart(2, '0')} ${ampm}`
}

/** Texto para la tarjeta: "Aprobado para mar 2 sep · 10:00 a. m. (publica mié 3 sep · 10:00 a. m.)". */
export function approvalTargetText(t: ApprovalTarget | null): string {
  if (!t) return 'Sin fecha de publicación: pide la fecha antes de editar'
  const base = `Aprobado para ${formatApprovalAt(t.at)}`
  if (t.basis === 'deadline') return `${base} (fecha límite)`
  return t.publishAt ? `${base} · publica ${formatApprovalAt(t.publishAt)}` : base
}
