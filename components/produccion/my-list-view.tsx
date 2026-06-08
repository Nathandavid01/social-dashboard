'use client'

import { useState } from 'react'
import type { ProductionTask, ProductionTaskStatus, Profile } from '@/lib/supabase/types'
import { updateTaskStatus } from '@/lib/actions/production'
import { StatusBadge } from './status-badge'
import { deadlineStatus, deadlineTone } from '@/lib/utils/deadlines'
import { cn } from '@/lib/utils'

const STATUS_FLOW: ProductionTaskStatus[] = ['pendiente', 'en_edicion', 'en_revision', 'revisiones', 'aprobado', 'publicado']
const STATUS_LABEL: Record<ProductionTaskStatus, string> = {
  pendiente: 'Pendiente',
  en_edicion: 'En Edición',
  en_revision: 'En Revisión',
  revisiones: 'Cambios',
  aprobado: 'Aprobado',
  publicado: 'Publicado',
}

function getWeekBounds() {
  const now = new Date()
  const monday = new Date(now)
  const day = monday.getDay()
  monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  const nextMonday = new Date(monday)
  nextMonday.setDate(monday.getDate() + 7)
  const nextSunday = new Date(nextMonday)
  nextSunday.setDate(nextMonday.getDate() + 6)
  return { monday, sunday, nextMonday, nextSunday }
}

interface Props {
  tasks: ProductionTask[]
}

export function MyListView({ tasks: initialTasks }: Props) {
  const [tasks, setTasks] = useState(initialTasks)
  const [saving, setSaving] = useState<string | null>(null)

  const { monday, sunday, nextMonday, nextSunday } = getWeekBounds()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const classify = (t: ProductionTask) => {
    const pub = new Date(t.publish_date + 'T12:00:00')
    if (pub <= today) return 'hoy'
    if (pub <= sunday) return 'semana'
    if (pub <= nextSunday) return 'proxima'
    return 'futura'
  }

  const groups: Record<string, { label: string; tasks: ProductionTask[] }> = {
    hoy:    { label: 'Hoy', tasks: [] },
    semana: { label: 'Esta Semana', tasks: [] },
    proxima: { label: 'Próxima Semana', tasks: [] },
    futura:  { label: 'Más Adelante', tasks: [] },
  }

  for (const t of tasks) {
    if (t.status === 'publicado') continue
    groups[classify(t)].tasks.push(t)
  }

  const advance = async (task: ProductionTask) => {
    const idx = STATUS_FLOW.indexOf(task.status)
    if (idx >= STATUS_FLOW.length - 1) return
    const next = STATUS_FLOW[idx + 1]
    setSaving(task.id)
    await updateTaskStatus(task.id, next)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: next } : t))
    setSaving(null)
  }

  const totalActive = tasks.filter(t => t.status !== 'publicado').length

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Mi Lista</h2>
          <p className="text-sm text-muted-foreground">{totalActive} tareas pendientes</p>
        </div>
      </div>

      {totalActive === 0 && (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
          <p className="text-sm font-medium">No tienes tareas activas</p>
          <p className="text-xs mt-1">¡Todo al día!</p>
        </div>
      )}

      {Object.entries(groups).map(([key, group]) => {
        if (group.tasks.length === 0) return null
        return (
          <div key={key}>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold">{group.label}</h3>
              <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                {group.tasks.length}
              </span>
            </div>
            <div className="space-y-2">
              {group.tasks.map(task => {
                const idx = STATUS_FLOW.indexOf(task.status)
                const nextStatus = idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null
                // Reuse the shared deadline logic; done tasks (aprobado/publicado)
                // map to 'publicada' so their badge is suppressed.
                const taskDone = task.status === 'aprobado' || task.status === 'publicado'
                const dl = deadlineStatus(task.deadline ? task.deadline.slice(0, 10) : null, taskDone ? 'publicada' : null)
                const dlt = deadlineTone(dl)

                return (
                  <div
                    key={task.id}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border bg-card px-4 py-3',
                      dl === 'overdue' && 'border-red-300 dark:border-red-900/50',
                      dl === 'due-soon' && 'border-amber-200 dark:border-amber-900/50',
                    )}
                  >
                    {/* Type badge */}
                    <div className={cn(
                      'shrink-0 w-10 text-center rounded-md py-1 text-xs font-bold',
                      task.content_type === 'R'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'
                        : 'bg-zinc-900 text-yellow-300'
                    )}>
                      {task.content_type === 'R' ? 'Reel' : 'Post'}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{task.client?.name ?? '—'}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground">
                          {new Date(task.publish_date + 'T12:00:00').toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'short' })}
                        </p>
                        {dlt.label && (
                          <span className={cn('inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium', dlt.className)}>
                            {dlt.label}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status */}
                    <StatusBadge status={task.status} />

                    {/* Advance button */}
                    {nextStatus && (
                      <button
                        onClick={() => advance(task)}
                        disabled={saving === task.id}
                        className="shrink-0 text-xs px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50"
                      >
                        {saving === task.id ? '...' : `→ ${STATUS_LABEL[nextStatus]}`}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
