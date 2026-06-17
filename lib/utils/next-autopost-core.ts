/**
 * Pure helpers for "when/where is this video supposed to be published" — the
 * next posting date from a client's weekly cadence (production_schedules), the
 * content type (Reel/Post), and the target platforms.
 *
 * All date math is on date-only "YYYY-MM-DD" strings (never toISOString, which
 * UTC-shifts the calendar day) and is anchored to a caller-supplied `todayISO`
 * (the posting timezone, America/Puerto_Rico) so server (UTC) and client agree.
 *
 * No Supabase / React / network here — fully unit-testable. The DB read + the
 * Grok call live in lib/actions/next-autopost.ts.
 */
import { addDaysISO } from './deadlines'

export type CadenceType = 'R' | 'P'

/** A production_schedules row: day_of_week 1=Mon..7=Sun, type R(eel)/P(ost). */
export interface CadenceRow {
  day_of_week: number
  content_type: CadenceType
}

export const TYPE_LABEL: Record<CadenceType, string> = { R: 'Reel', P: 'Post' }

// Indexed by JS getDay() (0=Sun..6=Sat).
const DAY_FULL = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const PLATFORM_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  twitter: 'Twitter',
  x: 'X',
}

/** ISO weekday (1=Mon..7=Sun) of a "YYYY-MM-DD" date — local-constructed, no UTC shift. */
export function isoWeekday(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  const js = new Date(y, m - 1, d).getDay() // 0=Sun..6=Sat
  return ((js + 6) % 7) + 1
}

/** Order types as Reel-first then Post (matches how the team reads cadence). */
function orderTypes(types: CadenceType[]): CadenceType[] {
  return Array.from(new Set(types)).sort((a, b) => (a === b ? 0 : a === 'R' ? -1 : 1))
}

export interface NextCadencePost {
  dateISO: string
  isoWeekday: number
  types: CadenceType[]
  daysFromToday: number
}

/**
 * Soonest cadence date on/after `todayISO` (inclusive) within `windowDays`.
 * Returns null if the client has no usable cadence rows.
 */
export function nextCadencePost(
  rows: CadenceRow[] | null | undefined,
  todayISO: string,
  windowDays = 14,
): NextCadencePost | null {
  const byDay = new Map<number, CadenceType[]>()
  for (const r of rows ?? []) {
    if (!r || r.day_of_week < 1 || r.day_of_week > 7) continue
    if (r.content_type !== 'R' && r.content_type !== 'P') continue
    byDay.set(r.day_of_week, [...(byDay.get(r.day_of_week) ?? []), r.content_type])
  }
  if (byDay.size === 0) return null

  for (let offset = 0; offset <= windowDays; offset++) {
    const dateISO = addDaysISO(todayISO, offset)
    const wd = isoWeekday(dateISO)
    const types = byDay.get(wd)
    if (types) {
      return { dateISO, isoWeekday: wd, types: orderTypes(types), daysFromToday: offset }
    }
  }
  return null
}

/** "viernes 20 de junio" for a "YYYY-MM-DD" date. */
export function spanishDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const wd = new Date(y, m - 1, d).getDay()
  return `${DAY_FULL[wd]} ${d} de ${MONTHS[m - 1]}`
}

/** "hoy" / "mañana" / null relative to `todayISO`. */
export function relativeDayLabel(targetISO: string, todayISO: string): string | null {
  if (targetISO === todayISO) return 'hoy'
  if (targetISO === addDaysISO(todayISO, 1)) return 'mañana'
  return null
}

/** Pretty platform names: ["instagram","facebook"] → ["Instagram","Facebook"]. */
export function platformLabels(platforms: string[]): string[] {
  return platforms.map((p) => PLATFORM_LABEL[p.toLowerCase()] ?? (p.charAt(0).toUpperCase() + p.slice(1)))
}

/** Join with commas and a Spanish "y": ["a","b","c"] → "a, b y c". */
export function humanJoinEs(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`
}

export interface NextAutopostFacts {
  clientName: string
  dateISO: string
  dateLabel: string
  relative: string | null
  typeLabels: string[]
  platformLabels: string[]
}

/** Assemble the display facts from a computed next-post + the client's platforms. */
export function buildNextAutopostFacts(
  clientName: string,
  next: NextCadencePost,
  platforms: string[],
  todayISO: string,
): NextAutopostFacts {
  return {
    clientName,
    dateISO: next.dateISO,
    dateLabel: spanishDateLabel(next.dateISO),
    relative: relativeDayLabel(next.dateISO, todayISO),
    typeLabels: next.types.map((t) => TYPE_LABEL[t]),
    platformLabels: platformLabels(platforms),
  }
}

/** Deterministic Spanish notice — instant, free, used as the fallback when Grok is off. */
export function deterministicNotice(f: NextAutopostFacts): string {
  const when = f.relative ?? `el ${f.dateLabel}`
  const tipo = humanJoinEs(f.typeLabels) || 'contenido'
  const plats = humanJoinEs(f.platformLabels)
  const where = plats ? ` en ${plats}` : ''
  return `📅 El próximo ${tipo} de ${f.clientName} está pautado para publicarse ${when}${where}.`
}

/** Prompt for Grok to phrase the same facts as one friendly PR-Spanish sentence. */
export function buildNextAutopostPrompt(f: NextAutopostFacts): string {
  return `Eres el asistente de NMedia PR, una agencia de marketing puertorriqueña. Escribe UNA sola oración corta y amigable (máximo 160 caracteres) en español de Puerto Rico que le avise al equipo cuándo y dónde se publicará automáticamente el próximo contenido de un cliente.

DATOS (no inventes nada fuera de esto):
- Cliente: ${f.clientName}
- Cuándo: ${f.relative ?? f.dateLabel}
- Tipo de contenido: ${humanJoinEs(f.typeLabels) || 'contenido'}
- Plataformas: ${humanJoinEs(f.platformLabels) || 'sus redes'}

REGLAS:
- Una sola oración, sin saltos de línea ni comillas.
- Empieza con el emoji 📅.
- Menciona el cliente, cuándo, el tipo (Reel/Post) y las plataformas.
- Tono claro y profesional, nada de relleno.
- Devuelve SOLO la oración.`
}
