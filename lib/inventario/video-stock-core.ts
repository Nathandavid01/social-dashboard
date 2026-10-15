/**
 * Inventario de video — which clients have grabaciones waiting and how many
 * edited videos each one has left before their cadence runs dry.
 *
 * Pure: no Supabase, no React. The loader (`load-video-stock.ts`) feeds rows in.
 *
 * Every idea lands in exactly one bucket, judged by EVIDENCE (files and
 * Metricool stamps), never by `content_ideas.status` alone — `producida` also
 * holds cuts that already went out, and `grabada` is often set with no file.
 *
 *   salio        → already left: published, or scheduled/posted in Metricool
 *                  (same predicates Recibo and the Panel use)
 *   listo        → a usable edited cut that has not left  = "videos que le quedan"
 *   crudo        → raw / b-roll footage with no cut yet   = "grabaciones por editar"
 *   sin_archivo  → marked grabada/producida but no file in the system
 *                  (the footage lives somewhere else — usually Drive)
 *   por_grabar   → idea / asignada, not shot
 */
import { isAgendadoIdea, isPublishedIdea } from '@/lib/utils/client-pool-state'
import { addDaysISO } from '@/lib/utils/deadlines'

export type StockStage = 'salio' | 'listo' | 'crudo' | 'sin_archivo' | 'por_grabar'

export type StockHealth = 'agotado' | 'critico' | 'bajo' | 'ok' | 'sin_cadencia'

export interface StockVideo {
  kind?: string | null
  status?: string | null
  uploaded_at?: string | null
}

export interface StockIdea {
  id: string
  client_id: string | null
  status: string
  published_at?: string | null
  manual_posted_status?: string | null
  metricool_post_id?: number | null
  posted_at?: string | null
  videos?: StockVideo[] | null
}

export interface StockClient {
  id: string
  name: string
  /** JS weekdays 0=Sun..6=Sat (clients.posting_days). */
  posting_days: number[] | null
}

export interface ClientStock {
  clientId: string
  clientName: string
  /** Posts per week from the cadence; 0 = no cadence set. */
  perWeek: number
  listos: number
  crudo: number
  sinArchivo: number
  porGrabar: number
  salieron: number
  /** Most recent raw/b-roll upload (ISO timestamp) or null. */
  lastRawAt: string | null
  /** Days of content the edited cuts cover at the cadence; null without cadence. */
  daysLeft: number | null
  /** First posting day with no edited video ("YYYY-MM-DD"); null without cadence. */
  runOutDate: string | null
  health: StockHealth
  /** Edited + raw cover less than RECORD_AHEAD_WEEKS — time to book a shoot. */
  necesitaGrabar: boolean
}

export interface VideoStockTotals {
  listos: number
  crudo: number
  sinArchivo: number
  porGrabar: number
  clientesConCrudo: number
  necesitanGrabar: number
  sinCadencia: number
  agotados: number
}

export interface VideoStock {
  today: string
  clients: ClientStock[]
  totals: VideoStockTotals
}

/** Below this many days of edited content the client is critical. */
export const CRITICAL_DAYS = 7
/** At or above this many days the client is fine. */
export const OK_DAYS = 14
/** Edited + raw must cover this many weeks, or it is time to record. */
export const RECORD_AHEAD_WEEKS = 2

function usable(v: StockVideo): boolean {
  return v.status !== 'archived' && v.status !== 'failed'
}

function isRawKind(kind: string | null | undefined): boolean {
  return kind === 'raw' || kind === 'broll'
}

export function classifyStockIdea(idea: StockIdea): StockStage | null {
  if (idea.status === 'descartada') return null
  if (isPublishedIdea(idea) || isAgendadoIdea(idea)) return 'salio'
  const videos = (idea.videos ?? []).filter(usable)
  if (videos.some((v) => v.kind === 'edited')) return 'listo'
  if (videos.some((v) => isRawKind(v.kind))) return 'crudo'
  if (idea.status === 'grabada' || idea.status === 'producida') return 'sin_archivo'
  return 'por_grabar'
}

function cadenceDays(postingDays: number[] | null | undefined): Set<number> {
  return new Set((postingDays ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))
}

function weekdayOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/**
 * Walk forward from `today` (inclusive) over the cadence days, spending one
 * video per posting day. Returns the first posting day left without a video.
 */
export function runOutDate(
  postingDays: number[] | null | undefined,
  videos: number,
  today: string,
): string | null {
  const days = cadenceDays(postingDays)
  if (days.size === 0) return null
  let left = Math.max(0, Math.floor(videos))
  // A year of cadence is far beyond any real stock; the cap only guards the loop.
  for (let i = 0; i < 400 + left * 7; i++) {
    const date = addDaysISO(today, i)
    if (!days.has(weekdayOf(date))) continue
    if (left === 0) return date
    left--
  }
  return null
}

function healthFor(perWeek: number, listos: number, daysLeft: number | null): StockHealth {
  if (perWeek === 0 || daysLeft === null) return 'sin_cadencia'
  if (listos === 0) return 'agotado'
  if (daysLeft < CRITICAL_DAYS) return 'critico'
  if (daysLeft < OK_DAYS) return 'bajo'
  return 'ok'
}

export function buildVideoStock(clients: StockClient[], ideas: StockIdea[], today: string): VideoStock {
  const byClient = new Map<string, StockIdea[]>()
  for (const idea of ideas) {
    if (!idea.client_id) continue
    const list = byClient.get(idea.client_id) ?? []
    list.push(idea)
    byClient.set(idea.client_id, list)
  }

  const rows: ClientStock[] = clients.map((client) => {
    const counts = { listo: 0, crudo: 0, sin_archivo: 0, por_grabar: 0, salio: 0 }
    let lastRawAt: string | null = null
    for (const idea of byClient.get(client.id) ?? []) {
      const stage = classifyStockIdea(idea)
      if (!stage) continue
      counts[stage]++
      for (const v of idea.videos ?? []) {
        if (!usable(v) || !isRawKind(v.kind) || !v.uploaded_at) continue
        if (!lastRawAt || v.uploaded_at > lastRawAt) lastRawAt = v.uploaded_at
      }
    }

    const perWeek = cadenceDays(client.posting_days).size
    const daysLeft = perWeek > 0 ? Math.round((counts.listo / perWeek) * 7 * 10) / 10 : null
    const necesitaGrabar = perWeek > 0 && (counts.listo + counts.crudo) / perWeek < RECORD_AHEAD_WEEKS

    return {
      clientId: client.id,
      clientName: client.name,
      perWeek,
      listos: counts.listo,
      crudo: counts.crudo,
      sinArchivo: counts.sin_archivo,
      porGrabar: counts.por_grabar,
      salieron: counts.salio,
      lastRawAt,
      daysLeft,
      runOutDate: runOutDate(client.posting_days, counts.listo, today),
      health: healthFor(perWeek, counts.listo, daysLeft),
      necesitaGrabar,
    }
  })

  rows.sort((a, b) => {
    if (a.daysLeft === null && b.daysLeft === null) return a.clientName.localeCompare(b.clientName)
    if (a.daysLeft === null) return 1
    if (b.daysLeft === null) return -1
    if (a.daysLeft !== b.daysLeft) return a.daysLeft - b.daysLeft
    // Same runway: the one with less raw footage behind it is worse off.
    if (a.crudo !== b.crudo) return a.crudo - b.crudo
    return a.clientName.localeCompare(b.clientName)
  })

  const totals: VideoStockTotals = {
    listos: 0,
    crudo: 0,
    sinArchivo: 0,
    porGrabar: 0,
    clientesConCrudo: 0,
    necesitanGrabar: 0,
    sinCadencia: 0,
    agotados: 0,
  }
  for (const r of rows) {
    totals.listos += r.listos
    totals.crudo += r.crudo
    totals.sinArchivo += r.sinArchivo
    totals.porGrabar += r.porGrabar
    if (r.crudo > 0) totals.clientesConCrudo++
    if (r.necesitaGrabar) totals.necesitanGrabar++
    if (r.health === 'sin_cadencia') totals.sinCadencia++
    if (r.health === 'agotado') totals.agotados++
  }

  return { today, clients: rows, totals }
}
