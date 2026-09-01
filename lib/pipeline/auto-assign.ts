import type { IdeaWithPipeline } from '@/lib/supabase/types'
import { deadlineStatus, todayISOInTimeZone, type DeadlineStatus } from '@/lib/utils/deadlines'
import { clientAssigneeId, ideaAssigneeId, isRawReadyWork } from './editor-video-bank'

/**
 * Autoasignación del banco: reparte los crudos SIN editor (ni por idea ni
 * heredado del cliente) a los espacios libres de los editores, por orden de
 * prioridad — deadline más urgente primero, luego el más viejo, empate por id.
 * El editor con más espacios libres recibe primero (y va rotando).
 *
 * PURO y determinista: el plan se calcula aquí; escribirlo a la DB es del
 * caller (página/acción con planning.assign). Corre idempotente — lo ya
 * asignado jamás entra al plan.
 */

const URGENCY_RANK: Record<DeadlineStatus, number> = { none: 0, future: 1, 'due-soon': 2, overdue: 3 }
const NATE_TZ = 'America/Puerto_Rico'

export interface AutoAssignEditor {
  id: string
  /** wipLimit - activos ahora; 0 = lleno. */
  freeSlots: number
}

export interface AutoAssignMove {
  productionTaskId: string
  ideaId: string
  editorId: string
}

function urgency(idea: IdeaWithPipeline, today: string): number {
  return URGENCY_RANK[deadlineStatus(idea.deadline, idea.status, today, idea.published_at)]
}

export function planAutoAssign(
  ideas: IdeaWithPipeline[],
  editors: AutoAssignEditor[],
  today: string = todayISOInTimeZone(NATE_TZ),
): AutoAssignMove[] {
  const queue = ideas
    .filter((idea) =>
      isRawReadyWork(idea) &&
      !ideaAssigneeId(idea) &&
      !clientAssigneeId(idea) &&
      !!idea.production_task?.id,
    )
    .sort((a, b) => {
      const u = urgency(b, today) - urgency(a, today)
      if (u !== 0) return u
      const byDate = (a.created_at ?? '').localeCompare(b.created_at ?? '')
      return byDate !== 0 ? byDate : a.id.localeCompare(b.id)
    })

  const slots = editors
    .filter((e) => e.freeSlots > 0)
    .map((e) => ({ ...e }))
    .sort((a, b) => (b.freeSlots !== a.freeSlots ? b.freeSlots - a.freeSlots : a.id.localeCompare(b.id)))

  const plan: AutoAssignMove[] = []
  for (const idea of queue) {
    // El de más espacio primero; re-orden tras cada asignación mantiene el balance.
    slots.sort((a, b) => (b.freeSlots !== a.freeSlots ? b.freeSlots - a.freeSlots : a.id.localeCompare(b.id)))
    const target = slots[0]
    if (!target || target.freeSlots === 0) break
    plan.push({ productionTaskId: idea.production_task!.id, ideaId: idea.id, editorId: target.id })
    target.freeSlots -= 1
  }
  return plan
}
