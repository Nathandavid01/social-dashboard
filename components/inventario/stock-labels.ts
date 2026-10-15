import type { ClientStock, StockHealth } from '@/lib/inventario/video-stock-core'

/** One palette for the 3D scene and the list, so a color means the same thing in both. */
export const HEALTH_META: Record<StockHealth, { label: string; hex: string; text: string }> = {
  agotado: { label: 'Sin videos', hex: '#ef4444', text: 'text-red-400' },
  critico: { label: 'Menos de 1 semana', hex: '#f97316', text: 'text-orange-400' },
  bajo: { label: '1–2 semanas', hex: '#facc15', text: 'text-yellow-300' },
  ok: { label: '2+ semanas', hex: '#34d399', text: 'text-emerald-400' },
  sin_cadencia: { label: 'Sin cadencia', hex: '#71717a', text: 'text-zinc-400' },
}

export const HEALTH_ORDER: StockHealth[] = ['agotado', 'critico', 'bajo', 'ok', 'sin_cadencia']

/** Brand gold (--primary in dark mode) — the edited videos. */
export const GOLD_HEX = '#e6af23'
/** Raw footage waiting for an editor. */
export const RAW_HEX = '#93c5fd'

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function dayDiff(from: string, to: string): number {
  const [ay, am, ad] = from.split('-').map(Number)
  const [by, bm, bd] = to.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000)
}

/** "hoy", "mañana", "vie 16 oct" — for the date a client runs out of edited videos. */
export function runOutLabel(runOut: string | null, today: string): string {
  if (!runOut) return 'Sin cadencia'
  const diff = dayDiff(today, runOut)
  if (diff <= 0) return 'Hoy no hay video'
  if (diff === 1) return 'Se acaba mañana'
  const [y, m, d] = runOut.split('-').map(Number)
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `Se acaba ${wd} ${d} ${MONTHS[m - 1]}`
}

/** "hace 3 días" for the last raw upload, or null when they never uploaded. */
export function lastRawLabel(lastRawAt: string | null, today: string): string | null {
  if (!lastRawAt) return null
  const diff = dayDiff(lastRawAt.slice(0, 10), today)
  if (diff <= 0) return 'Grabó hoy'
  if (diff === 1) return 'Grabó ayer'
  return `Grabó hace ${diff} días`
}

export function daysLeftLabel(c: Pick<ClientStock, 'daysLeft'>): string {
  if (c.daysLeft === null) return '—'
  if (c.daysLeft < 1) return '0 días'
  const days = Math.floor(c.daysLeft)
  return days === 1 ? '1 día' : `${days} días`
}

export function videosLabel(n: number): string {
  return n === 1 ? '1 video' : `${n} videos`
}
