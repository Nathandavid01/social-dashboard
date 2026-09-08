import { todayISOInTimeZone } from './deadlines'
type TaskDeadline = {due_at?: string | null; status?: string}

export function taskIsOverdue(task: TaskDeadline, now: string | Date = new Date()): boolean {
  if (!task.due_at || task.status === 'completed') return false
  const due = new Date(task.due_at).getTime()
  return Number.isFinite(due) && due < new Date(now).getTime()
}

export function taskIsDueToday(task: TaskDeadline, now: string | Date = new Date()): boolean {
  if (!task.due_at) return false
  const due = new Date(task.due_at)
  const current = new Date(now)
  if (!Number.isFinite(due.getTime()) || !Number.isFinite(current.getTime())) return false
  return todayISOInTimeZone('America/Puerto_Rico', due) === todayISOInTimeZone('America/Puerto_Rico', current)
}
