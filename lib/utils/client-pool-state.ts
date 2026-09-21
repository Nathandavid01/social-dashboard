/**
 * Panel clientes — estados Listo / Agendado / Publicado.
 *
 * Se derivan de columnas que ya existen (Recibo, /aprobacion, Metricool).
 * No hay tabla ni enum nuevo. El pool Listo es solo Recibo/AI: un video
 * de Entregas humano no entra aquí (saltar Revisión sería el atajo).
 */

export type PoolPublishState = 'recibo' | 'listo' | 'agendado' | 'publicado'
export type ClientEditMode = 'ai' | 'human'

export interface PoolStateInput {
  status?: string | null
  published_at?: string | null
  manual_posted_status?: string | null
  metricool_post_id?: number | null
  posted_at?: string | null
  /** Planned date only — never enough to mark Agendado. */
  publish_date?: string | null
  staff_client_approval?: string | null
  client_review_status?: string | null
  entregas_review_status?: string | null
  client_edit_mode?: ClientEditMode | null
}

export function isPublishedIdea(input: PoolStateInput): boolean {
  return Boolean(input.published_at)
    || input.status === 'publicada'
    || input.manual_posted_status === 'posted'
}

export function isAgendadoIdea(input: PoolStateInput): boolean {
  if (isPublishedIdea(input)) return false
  return input.metricool_post_id != null || Boolean(input.posted_at)
}

export function isReciboAiClient(editMode: ClientEditMode | null | undefined): boolean {
  return editMode === 'ai'
}

export function isClientApproved(input: PoolStateInput): boolean {
  return input.staff_client_approval === 'approved'
    || input.client_review_status === 'approved'
    || input.entregas_review_status === 'approved'
}

export function poolPublishState(input: PoolStateInput): PoolPublishState {
  if (input.status === 'descartada') return 'recibo'
  if (isPublishedIdea(input)) return 'publicado'
  if (isAgendadoIdea(input)) return 'agendado'
  if (isReciboAiClient(input.client_edit_mode) && isClientApproved(input)) return 'listo'
  return 'recibo'
}

export function isCalendarEligible(state: PoolPublishState): boolean {
  return state === 'agendado' || state === 'publicado'
}

export function canCreateMetricoolSchedule(
  state: PoolPublishState,
  editMode: ClientEditMode | null | undefined,
): boolean {
  return state === 'listo' && isReciboAiClient(editMode)
}

export function canReschedulePoolIdea(state: PoolPublishState): boolean {
  return state === 'agendado'
}

/** Aviso de /aprobacion: silencioso solo cuando Recibo/AI aprueba. */
export function shouldNotifyClientVote(
  decision: 'approved' | 'rejected' | string,
  editMode: ClientEditMode | null | undefined,
): boolean {
  if (decision === 'approved' && isReciboAiClient(editMode)) return false
  return decision === 'approved' || decision === 'rejected'
}

export function weekCadenceDates(
  postingDays: number[] | null | undefined,
  week: { desde: string; hasta: string },
): string[] {
  const days = new Set((postingDays ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))
  if (days.size === 0) return []
  const out: string[] = []
  const [ys, ms, ds] = week.desde.split('-').map(Number)
  const [ye, me, de] = week.hasta.split('-').map(Number)
  const cursor = new Date(ys, ms - 1, ds, 12)
  const end = new Date(ye, me - 1, de, 12)
  while (cursor.getTime() <= end.getTime()) {
    if (days.has(cursor.getDay())) {
      const y = cursor.getFullYear()
      const m = String(cursor.getMonth() + 1).padStart(2, '0')
      const d = String(cursor.getDate()).padStart(2, '0')
      out.push(`${y}-${m}-${d}`)
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

/** Hueco de la semana: Recibo/AI debe publicar y no hay Listo para esos días. */
export function weekCadenceGap(opts: {
  editMode: ClientEditMode | null | undefined
  weekDates: string[]
  weekPosts: { publishDate: string | null }[]
  poolCount: number
}): { hasWeekGap: boolean; gapDates: string[] } {
  if (!isReciboAiClient(opts.editMode) || opts.poolCount > 0) {
    return { hasWeekGap: false, gapDates: [] }
  }
  const covered = new Set(
    opts.weekPosts.map((p) => p.publishDate).filter((d): d is string => Boolean(d)),
  )
  const gapDates = opts.weekDates.filter((d) => !covered.has(d))
  return { hasWeekGap: gapDates.length > 0, gapDates }
}

export interface PoolClientInput {
  id: string
  name: string
  logo_url?: string | null
  posting_days: number[]
  posting_time?: string | null
  posting_schedule?: Record<string, string> | null
  metricool_blog_id?: string | null
  edit_mode?: ClientEditMode | null
}

export interface PoolIdeaInput {
  id: string
  client_id: string
  title: string
  hook?: string | null
  status: string
  publish_date: string | null
  published_at: string | null
  manual_posted_status?: string | null
  metricool_post_id: number | null
  posted_at: string | null
  staff_client_approval?: string | null
  client_review_status?: string | null
  entregas_review_status?: string | null
  generated_caption?: string | null
  coverVideoId?: string | null
  coverUrl?: string | null
}

export type PoolVideoState = Exclude<PoolPublishState, 'recibo'>

export interface PoolVideo {
  id: string
  clientId: string
  clientName: string
  title: string
  state: PoolVideoState
  publishDate: string | null
  coverVideoId: string | null
  coverUrl: string | null
  scheduledFromHere: boolean
}

export interface PoolClientRow {
  client: PoolClientInput
  weekDates: string[]
  weekPosts: PoolVideo[]
  pool: PoolVideo[]
  hidePool: boolean
  hasWeekGap: boolean
  gapDates: string[]
}

export interface ClientPoolPanel {
  week: { desde: string; hasta: string }
  clients: PoolClientRow[]
  calendar: PoolVideo[]
}

function toVideo(
  row: PoolIdeaInput,
  client: PoolClientInput,
  state: PoolVideoState,
): PoolVideo {
  return {
    id: row.id,
    clientId: client.id,
    clientName: client.name,
    title: row.title?.trim() || row.hook?.trim() || 'Sin título',
    state,
    publishDate: row.publish_date,
    coverVideoId: row.coverVideoId ?? null,
    coverUrl: row.coverUrl ?? null,
    scheduledFromHere: state === 'agendado',
  }
}

function inWeek(date: string | null | undefined, week: { desde: string; hasta: string }): boolean {
  if (!date) return false
  return date >= week.desde && date <= week.hasta
}

export function buildClientPoolPanel(opts: {
  clients: PoolClientInput[]
  ideas: PoolIdeaInput[]
  reviewByIdea?: Record<string, string>
  week: { desde: string; hasta: string }
}): ClientPoolPanel {
  const reviewByIdea = opts.reviewByIdea ?? {}
  const ideasByClient = new Map<string, PoolIdeaInput[]>()
  for (const idea of opts.ideas) {
    const list = ideasByClient.get(idea.client_id) ?? []
    list.push(idea)
    ideasByClient.set(idea.client_id, list)
  }

  const calendar: PoolVideo[] = []
  const rows: PoolClientRow[] = []

  for (const client of [...opts.clients].sort((a, b) => a.name.localeCompare(b.name, 'es'))) {
    const weekDates = weekCadenceDates(client.posting_days, opts.week)
    const pool: PoolVideo[] = []
    const weekPosts: PoolVideo[] = []
    for (const raw of ideasByClient.get(client.id) ?? []) {
      const state = poolPublishState({
        ...raw,
        entregas_review_status: raw.entregas_review_status ?? reviewByIdea[raw.id] ?? null,
        client_edit_mode: client.edit_mode ?? null,
      })
      if (state === 'recibo') continue
      const video = toVideo(raw, client, state)
      if (state === 'listo') pool.push(video)
      if (isCalendarEligible(state) && inWeek(raw.publish_date, opts.week)) {
        weekPosts.push(video)
        calendar.push(video)
      }
    }
    const hidePool = pool.length === 0
    const { hasWeekGap, gapDates } = weekCadenceGap({
      editMode: client.edit_mode,
      weekDates,
      weekPosts,
      poolCount: pool.length,
    })
    if (hidePool && weekDates.length === 0 && weekPosts.length === 0) continue
    rows.push({ client, weekDates, weekPosts, pool, hidePool, hasWeekGap, gapDates })
  }

  return { week: opts.week, clients: rows, calendar }
}

export function publicacionCalendarState(input: PoolStateInput): 'agendado' | 'publicado' | null {
  const state = poolPublishState(input)
  if (state === 'agendado' || state === 'publicado') return state
  return null
}
