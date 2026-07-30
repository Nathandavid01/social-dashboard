import { createClient } from '@/lib/supabase/server'
import { computePostingTargets } from './posting-cadence'

/**
 * Pipeline buckets — derived from content_ideas.status semantics:
 *   idea       → "Por idear / refinar" — needs assignment to a recording
 *   asignada   → "Por grabar" — booked into a recording_session, not shot yet
 *   grabada    → "Por editar" — footage in the buffer, not yet produced
 *   producida  → "Por publicar" — edited, awaiting Metricool schedule / publish
 *   publicada  → "Publicado" — done (we count this in current week/month)
 *   descartada → ignored
 *
 * The posting target (per posting_days) tells us how many SHOULD ship.
 */

export interface ClientPipeline {
  clientId: string
  clientName: string
  ideas: number
  porGrabar: number
  porEditar: number
  porPublicar: number
  publicadasSemana: number
  publicadasMes: number
  targetSemana: number
  targetMes: number
  semanaRemaining: number
  mesRemaining: number
}

export interface PipelineTotals {
  ideas: number
  porGrabar: number
  porEditar: number
  porPublicar: number
  publicadasSemana: number
  publicadasMes: number
  targetSemana: number
  targetMes: number
  /** Sum across clients of posts still owed this week/month (each clamped at 0). */
  semanaRemaining: number
  mesRemaining: number
}

const COUNTED_STATUSES = ['idea', 'asignada', 'grabada', 'producida', 'publicada'] as const

function startOfWeekMonIso(): string {
  const d = new Date()
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function startOfMonthIso(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
}

export interface IdeaRow {
  client_id: string | null
  status: string
  published_at?: string | null
  updated_at: string | null
  created_at: string
}

export async function getClientPipeline(clientId: string, postingDays: number[]): Promise<ClientPipeline | null> {
  const supabase = await createClient()
  const { data: client } = await supabase.from('clients').select('name').eq('id', clientId).single()
  if (!client) return null

  const weekStart = startOfWeekMonIso()
  const monthStart = startOfMonthIso()
  const { data: ideas } = await supabase
    .from('content_ideas')
    .select('client_id, status, published_at, updated_at, created_at')
    .eq('client_id', clientId)
    .in('status', COUNTED_STATUSES)

  const buckets = bucketize((ideas ?? []) as IdeaRow[], weekStart, monthStart)
  const targets = computePostingTargets(postingDays)

  return {
    clientId,
    clientName: client.name,
    ...buckets,
    targetSemana: targets.perWeek,
    targetMes: targets.perMonth,
    semanaRemaining: Math.max(targets.perWeek - buckets.publicadasSemana, 0),
    mesRemaining: Math.max(targets.perMonth - buckets.publicadasMes, 0),
  }
}

export function bucketize(rows: IdeaRow[], weekStart: string, monthStart: string) {
  let ideas = 0
  let porGrabar = 0
  let porEditar = 0
  let porPublicar = 0
  let publicadasSemana = 0
  let publicadasMes = 0

  for (const r of rows) {
    switch (r.status) {
      case 'idea':
        ideas++
        break
      case 'asignada':
        porGrabar++
        break
      case 'grabada':
        porEditar++
        break
      case 'producida':
        porPublicar++
        break
      case 'publicada': {
        // Count by published_at (set by the set_idea_published_at trigger).
        // Fall back to updated_at/created_at only for legacy rows with no stamp.
        const ts = r.published_at ?? r.updated_at ?? r.created_at
        if (ts >= monthStart) publicadasMes++
        if (ts >= weekStart) publicadasSemana++
        break
      }
    }
  }

  return { ideas, porGrabar, porEditar, porPublicar, publicadasSemana, publicadasMes }
}

/**
 * Aggregated pipeline across all active clients.
 * Returns both per-client and totals.
 */
export async function getPipelineTotals(): Promise<{
  totals: PipelineTotals
  perClient: ClientPipeline[]
}> {
  const supabase = await createClient()

  const [{ data: clients }, { data: ideas }] = await Promise.all([
    supabase.from('clients').select('id, name, posting_days').eq('status', 'active'),
    supabase
      .from('content_ideas')
      .select('client_id, status, published_at, updated_at, created_at')
      .in('status', COUNTED_STATUSES),
  ])

  const weekStart = startOfWeekMonIso()
  const monthStart = startOfMonthIso()
  const rows = (ideas ?? []) as IdeaRow[]

  const byClient = new Map<string, IdeaRow[]>()
  for (const r of rows) {
    if (!r.client_id) continue
    const arr = byClient.get(r.client_id) ?? []
    arr.push(r)
    byClient.set(r.client_id, arr)
  }

  const perClient: ClientPipeline[] = []
  const totals: PipelineTotals = {
    ideas: 0,
    porGrabar: 0,
    porEditar: 0,
    porPublicar: 0,
    publicadasSemana: 0,
    publicadasMes: 0,
    targetSemana: 0,
    targetMes: 0,
    semanaRemaining: 0,
    mesRemaining: 0,
  }

  for (const c of clients ?? []) {
    const buckets = bucketize(byClient.get(c.id) ?? [], weekStart, monthStart)
    const targets = computePostingTargets(c.posting_days ?? [])

    const entry: ClientPipeline = {
      clientId: c.id,
      clientName: c.name,
      ...buckets,
      targetSemana: targets.perWeek,
      targetMes: targets.perMonth,
      semanaRemaining: Math.max(targets.perWeek - buckets.publicadasSemana, 0),
      mesRemaining: Math.max(targets.perMonth - buckets.publicadasMes, 0),
    }
    perClient.push(entry)

    totals.ideas += entry.ideas
    totals.porGrabar += entry.porGrabar
    totals.porEditar += entry.porEditar
    totals.porPublicar += entry.porPublicar
    totals.publicadasSemana += entry.publicadasSemana
    totals.publicadasMes += entry.publicadasMes
    totals.targetSemana += entry.targetSemana
    totals.targetMes += entry.targetMes
    totals.semanaRemaining += entry.semanaRemaining
    totals.mesRemaining += entry.mesRemaining
  }

  return { totals, perClient }
}
