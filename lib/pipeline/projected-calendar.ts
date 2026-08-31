import type { IdeaWithPipeline } from '@/lib/supabase/types'
import { computeScheduleSlots } from '@/lib/utils/posting-schedule'

/**
 * Calendario proyectado del Banco de Video: si todo sigue aprobado, ¿qué video
 * sale qué día? Toma la cola de ideas APROBADAS y aún no publicadas de cada
 * cliente (ordenada por approved_at; fallback updated_at; empate por id) y la
 * mapea sobre los próximos posting slots del cliente — el mismo orden en que
 * Metricool las auto-postearía.
 *
 * PURO — sin imports de servidor (lo consume la pestaña Calendario, cliente).
 * Nota de semántica: el banco enseña crudos PENDIENTES; este calendario enseña
 * lo APROBADO en cola. Poblaciones disjuntas a propósito.
 */

export interface ClientQueueInput {
  clientId: string
  clientName: string
  postingDays: number[] | null | undefined
  postingTime?: string | null
  postingSchedule?: Record<string, string> | null
  /** Todas las ideas del cliente; aquí adentro se filtra a aprobadas-no-publicadas. */
  ideas: IdeaWithPipeline[]
}

export interface ProjectedPost {
  ideaId: string
  title: string
  clientId: string
  clientName: string
  /** YYYY-MM-DD local */
  date: string
  /** HH:MM o null si el cliente no tiene hora configurada */
  time: string | null
  dayOfWeek: number
}

export interface ProjectedOverflow {
  ideaId: string
  title: string
  clientId: string
  clientName: string
}

export interface ProjectedCalendar {
  posts: ProjectedPost[]
  /** Aprobados que no caben en la ventana (o cliente sin posting days). */
  overflow: ProjectedOverflow[]
}

function isQueued(idea: IdeaWithPipeline): boolean {
  return idea.approval_status === 'approved' && idea.status !== 'publicada' && !idea.published_at
}

function queueOrder(a: IdeaWithPipeline, b: IdeaWithPipeline): number {
  const ka = a.approved_at ?? a.updated_at ?? ''
  const kb = b.approved_at ?? b.updated_at ?? ''
  const byDate = ka.localeCompare(kb)
  return byDate !== 0 ? byDate : a.id.localeCompare(b.id)
}

function titleOf(idea: IdeaWithPipeline): string {
  return idea.title?.trim() || idea.hook?.trim() || 'Sin título'
}

export function projectPostingCalendar(
  clients: ClientQueueInput[],
  window: { from: Date; days?: number },
): ProjectedCalendar {
  const days = window.days ?? 14
  const rangeEnd = new Date(window.from.getFullYear(), window.from.getMonth(), window.from.getDate() + days - 1)

  const posts: ProjectedPost[] = []
  const overflow: ProjectedOverflow[] = []

  for (const clientRow of clients) {
    const queue = clientRow.ideas.filter(isQueued).sort(queueOrder)
    if (queue.length === 0) continue

    const slots = computeScheduleSlots({
      postingDays: clientRow.postingDays,
      postingTime: clientRow.postingTime,
      postingSchedule: clientRow.postingSchedule,
      rangeStart: window.from,
      rangeEnd,
      postedDates: [],
      ref: window.from,
    }).filter((s) => s.status === 'pendiente')

    queue.forEach((idea, i) => {
      const slot = slots[i]
      if (slot) {
        posts.push({
          ideaId: idea.id,
          title: titleOf(idea),
          clientId: clientRow.clientId,
          clientName: clientRow.clientName,
          date: slot.date,
          time: slot.time,
          dayOfWeek: slot.dayOfWeek,
        })
      } else {
        overflow.push({
          ideaId: idea.id,
          title: titleOf(idea),
          clientId: clientRow.clientId,
          clientName: clientRow.clientName,
        })
      }
    })
  }

  posts.sort((a, b) => {
    const byDate = a.date.localeCompare(b.date)
    if (byDate !== 0) return byDate
    const byTime = (a.time ?? '99:99').localeCompare(b.time ?? '99:99')
    return byTime !== 0 ? byTime : a.ideaId.localeCompare(b.ideaId)
  })

  return { posts, overflow }
}
