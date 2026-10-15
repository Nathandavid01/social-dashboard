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
 *   salio        → already left: published, or scheduled in Metricool for a
 *                  date that already passed (same predicates Recibo/Panel use)
 *   agendado     → scheduled in Metricool for today or later — still covers
 *                  an upcoming posting day, so it counts toward the runway
 *   listo        → a usable edited cut that has not left  = "videos que le quedan"
 *   crudo        → raw / b-roll footage with no cut yet   = "grabaciones por editar"
 *   sin_archivo  → marked grabada/producida but no file in the system
 *                  (the footage lives somewhere else — usually Drive)
 *   por_grabar   → idea / asignada, not shot
 */
import { isAgendadoIdea, isPublishedIdea } from '@/lib/utils/client-pool-state'
import { addDaysISO } from '@/lib/utils/deadlines'
import { ideaFormat, type Format } from './cadence-formats'
import type { ScheduledSlot } from './metricool-scheduled-core'

export type StockStage = 'salio' | 'agendado' | 'listo' | 'crudo' | 'sin_archivo' | 'por_grabar'

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
  /** R = reel, P = post, C = carrusel, S = story. */
  content_type?: string | null
  /** Planned publish day "YYYY-MM-DD" — for a scheduled cut, the day it goes out. */
  publish_date?: string | null
  videos?: StockVideo[] | null
}

export interface StockClient {
  id: string
  name: string
  /** JS weekdays 0=Sun..6=Sat (clients.posting_days). */
  posting_days: number[] | null
  /** Same-origin logo URL (the loader routes it through /api/img-proxy). */
  logoUrl?: string | null
  /** Format each posting day takes (JS weekday → reel/post/story, null = either). */
  formats?: Partial<Record<number, Format | null>>
  /** Pending posts in the Metricool planner (today or later), hand-made ones included. */
  scheduled?: ScheduledSlot[]
}

export interface ClientStock {
  clientId: string
  clientName: string
  logoUrl: string | null
  /** Posts per week from the cadence; 0 = no cadence set. */
  perWeek: number
  listos: number
  /** Ready reels / ready feed posts (incl. carrusel and story) — listos split. */
  reels: number
  posts: number
  /** Scheduled in Metricool for today or later. */
  agendados: number
  crudo: number
  sinArchivo: number
  porGrabar: number
  /** Only those still loaded — the loader skips published history. */
  salieron: number
  /** Most recent raw/b-roll upload (ISO timestamp) or null. */
  lastRawAt: string | null
  /** Days from today until runOutDate (listos + agendados, format-matched); null without cadence. */
  daysLeft: number | null
  /** First posting day with no edited video ("YYYY-MM-DD"); null without cadence. */
  runOutDate: string | null
  /** Format that posting day needed (what runs out first); null = either. */
  runOutFormat: Format | null
  health: StockHealth
  /** Edited + raw cover less than RECORD_AHEAD_WEEKS — time to book a shoot. */
  necesitaGrabar: boolean
}

export interface VideoStockTotals {
  listos: number
  agendados: number
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
  /** False when the Metricool planner couldn't be read: scheduled = dashboard only. */
  plannerAvailable?: boolean
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

/**
 * `today` ("YYYY-MM-DD") lets a scheduled cut with a future publish_date count
 * as agendado. `posted_at` is when it was scheduled, not when it goes out.
 */
export function classifyStockIdea(idea: StockIdea, today?: string): StockStage | null {
  if (idea.status === 'descartada') return null
  if (isPublishedIdea(idea)) return 'salio'
  if (isAgendadoIdea(idea)) {
    const day = idea.publish_date?.slice(0, 10)
    return today && day && day >= today ? 'agendado' : 'salio'
  }
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

function dayDiff(from: string, to: string): number {
  const [ay, am, ad] = from.split('-').map(Number)
  const [by, bm, bd] = to.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000)
}

/**
 * Format-aware walk: each posting day spends one video of the format it takes
 * (a reel day needs a reel; a post day needs a post). A day with no known
 * format takes a reel first, then a post. Stops at the first uncovered day.
 */
export function runOutTyped(
  postingDays: number[] | null | undefined,
  formats: Partial<Record<number, Format | null>> | undefined,
  stock: { reel: number; post: number },
  today: string,
  /** Days already covered by a post scheduled for that exact date. */
  pinned: ReadonlySet<string> = new Set(),
): { date: string; format: Format | null } | null {
  const days = cadenceDays(postingDays)
  if (days.size === 0) return null
  const left = { reel: Math.max(0, stock.reel), post: Math.max(0, stock.post) }
  for (let i = 0; i < 400 + (left.reel + left.post) * 7; i++) {
    const date = addDaysISO(today, i)
    const wd = weekdayOf(date)
    if (!days.has(wd) || pinned.has(date)) continue
    const f = formats?.[wd] ?? null
    const bucket = f === 'reel' ? 'reel' : f ? 'post' : left.reel > 0 ? 'reel' : 'post'
    if (left[bucket] === 0) return { date, format: f }
    left[bucket]--
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
    const counts = { listo: 0, agendado: 0, crudo: 0, sin_archivo: 0, por_grabar: 0, salio: 0 }
    const ready = { reel: 0, post: 0 }
    // A scheduled post covers its own date only — same model as the profile calendar.
    const pinned = new Set<string>()
    let lastRawAt: string | null = null
    for (const idea of byClient.get(client.id) ?? []) {
      const stage = classifyStockIdea(idea, today)
      if (!stage) continue
      counts[stage]++
      if (stage === 'listo') ready[ideaFormat(idea.content_type) === 'reel' ? 'reel' : 'post']++
      if (stage === 'agendado' && idea.publish_date) pinned.add(idea.publish_date.slice(0, 10))
      for (const v of idea.videos ?? []) {
        if (!usable(v) || !isRawKind(v.kind) || !v.uploaded_at) continue
        if (!lastRawAt || v.uploaded_at > lastRawAt) lastRawAt = v.uploaded_at
      }
    }

    // Planner posts the dashboard doesn't already know as an agendado idea.
    const linked = new Set(
      (byClient.get(client.id) ?? [])
        .filter((i) => classifyStockIdea(i, today) === 'agendado' && i.metricool_post_id != null)
        .map((i) => Number(i.metricool_post_id)),
    )
    for (const slot of client.scheduled ?? []) {
      pinned.add(slot.date)
      if (!linked.has(slot.id)) counts.agendado++
    }

    const perWeek = cadenceDays(client.posting_days).size
    // Scheduled cuts fill upcoming posting days just like unscheduled ones.
    const covered = counts.listo + counts.agendado
    const runOut = runOutTyped(client.posting_days, client.formats, ready, today, pinned)
    const daysLeft = perWeek > 0 && runOut ? Math.max(0, dayDiff(today, runOut.date)) : null
    const necesitaGrabar = perWeek > 0 && (covered + counts.crudo) / perWeek < RECORD_AHEAD_WEEKS

    return {
      clientId: client.id,
      clientName: client.name,
      logoUrl: client.logoUrl ?? null,
      perWeek,
      listos: counts.listo,
      reels: ready.reel,
      posts: ready.post,
      agendados: counts.agendado,
      crudo: counts.crudo,
      sinArchivo: counts.sin_archivo,
      porGrabar: counts.por_grabar,
      salieron: counts.salio,
      lastRawAt,
      daysLeft,
      runOutDate: runOut?.date ?? null,
      runOutFormat: runOut?.format ?? null,
      health: healthFor(perWeek, covered, daysLeft),
      necesitaGrabar,
    }
  })

  // Same order as the 3D tiers: status first, then who runs out soonest.
  const rank: Record<StockHealth, number> = { agotado: 0, critico: 1, bajo: 2, ok: 3, sin_cadencia: 4 }
  rows.sort((a, b) => {
    if (rank[a.health] !== rank[b.health]) return rank[a.health] - rank[b.health]
    if (a.daysLeft !== null && b.daysLeft !== null && a.daysLeft !== b.daysLeft) return a.daysLeft - b.daysLeft
    // Same runway: the one with less raw footage behind it is worse off.
    if (a.crudo !== b.crudo) return a.crudo - b.crudo
    return a.clientName.localeCompare(b.clientName)
  })

  const totals: VideoStockTotals = {
    listos: 0,
    agendados: 0,
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
    totals.agendados += r.agendados
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
