'use client'

import { useState } from 'react'
import type { ProductionTask, ProductionTaskStatus, Profile } from '@/lib/supabase/types'
import { updateTaskStatus, reassignTask } from '@/lib/actions/production'
import { StatusBadge } from './status-badge'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const STATUS_FLOW: ProductionTaskStatus[] = ['pendiente', 'en_edicion', 'en_revision', 'revisiones', 'aprobado', 'publicado']
const STATUS_LABEL: Record<ProductionTaskStatus, string> = {
  pendiente: 'Pendiente',
  en_edicion: 'En Edición',
  en_revision: 'En Revisión',
  revisiones: 'Cambios',
  aprobado: 'Aprobado',
  publicado: 'Publicado',
}

const STATUS_COLORS: Record<ProductionTaskStatus, string> = {
  pendiente:   'bg-zinc-200 dark:bg-zinc-700',
  en_edicion:  'bg-blue-200 dark:bg-blue-800',
  en_revision: 'bg-amber-200 dark:bg-amber-800',
  revisiones:  'bg-orange-200 dark:bg-orange-800',
  aprobado:    'bg-emerald-200 dark:bg-emerald-800',
  publicado:   'bg-green-200 dark:bg-green-800',
}

function getMonday(d: Date) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

interface Props {
  tasks: ProductionTask[]
  profiles: Pick<Profile, 'id' | 'full_name'>[]
}

export function AssignmentsView({ tasks: initialTasks, profiles }: Props) {
  const [tasks, setTasks] = useState(initialTasks)
  const [weekStart, setWeekStart] = useState(() => {
    const d = getMonday(new Date())
    return d.toISOString().slice(0, 10)
  })
  const [filterStatus, setFilterStatus] = useState<ProductionTaskStatus | 'all'>('all')
  const [saving, setSaving] = useState<string | null>(null)

  const monday = new Date(weekStart + 'T12:00:00Z')
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().slice(0, 10)
  })

  const prevWeek = () => {
    const d = new Date(monday)
    d.setDate(d.getDate() - 7)
    setWeekStart(d.toISOString().slice(0, 10))
  }

  const nextWeek = () => {
    const d = new Date(monday)
    d.setDate(d.getDate() + 7)
    setWeekStart(d.toISOString().slice(0, 10))
  }

  const weekTasks = tasks.filter(t =>
    t.publish_date >= weekDates[0] && t.publish_date <= weekDates[6]
  )

  const filteredTasks = filterStatus === 'all'
    ? weekTasks
    : weekTasks.filter(t => t.status === filterStatus)

  // Group by assignee
  const unassigned = filteredTasks.filter(t => !t.assigned_to_id)
  const byMember = new Map<string, { profile: Pick<Profile, 'id' | 'full_name'>; tasks: ProductionTask[] }>()

  for (const p of profiles) {
    byMember.set(p.id, { profile: p, tasks: [] })
  }

  for (const t of filteredTasks) {
    if (t.assigned_to_id && byMember.has(t.assigned_to_id)) {
      byMember.get(t.assigned_to_id)!.tasks.push(t)
    }
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

  const reassign = async (taskId: string, profileId: string) => {
    await reassignTask(taskId, profileId || null)
    const profile = profiles.find(p => p.id === profileId) ?? null
    setTasks(prev => prev.map(t =>
      t.id === taskId
        ? { ...t, assigned_to_id: profileId || null, assigned_to: profile ? { id: profile.id, full_name: profile.full_name } : null }
        : t
    ))
  }

  const TaskRow = ({ task }: { task: ProductionTask }) => {
    const idx = STATUS_FLOW.indexOf(task.status)
    const nextStatus = idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null

    return (
      <div className={cn(
        'flex items-center gap-3 rounded-lg border bg-card px-3 py-2',
      )}>
        <div className={cn(
          'shrink-0 w-8 text-center rounded-md py-0.5 text-[10px] font-bold',
          task.content_type === 'R'
            ? 'bg-yellow-100 text-yellow-800'
            : 'bg-zinc-900 text-yellow-300'
        )}>
          {task.content_type}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{task.client?.name ?? '—'}</p>
          <p className="text-[10px] text-muted-foreground">
            {new Date(task.publish_date + 'T12:00:00').toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })}
          </p>
        </div>

        <StatusBadge status={task.status} size="xs" />

        {/* Reassign select */}
        <select
          defaultValue={task.assigned_to_id ?? ''}
          onChange={e => reassign(task.id, e.target.value)}
          className="text-[10px] rounded border border-border bg-card px-1 py-0.5 max-w-[90px]"
        >
          <option value="">Sin asignar</option>
          {profiles.map(p => (
            <option key={p.id} value={p.id}>{p.full_name?.split(' ')[0]}</option>
          ))}
        </select>

        {nextStatus && (
          <button
            onClick={() => advance(task)}
            disabled={saving === task.id}
            className="shrink-0 text-[10px] px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            {saving === task.id ? '...' : `→ ${STATUS_LABEL[nextStatus]}`}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <button onClick={prevWeek} className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setWeekStart(getMonday(new Date()).toISOString().slice(0, 10))}
            className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-muted transition-colors"
          >
            Esta semana
          </button>
          <button onClick={nextWeek} className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <span className="text-sm font-semibold">
          {new Date(weekDates[0] + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })}
          {' — '}
          {new Date(weekDates[6] + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })}
        </span>

        {/* Status filter */}
        <div className="ml-auto flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setFilterStatus('all')}
            className={cn('text-xs px-2.5 py-1 rounded-full border transition-colors',
              filterStatus === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
            )}
          >
            Todos
          </button>
          {STATUS_FLOW.filter(s => s !== 'publicado').map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn('text-xs px-2.5 py-1 rounded-full border transition-colors',
                filterStatus === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
              )}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {STATUS_FLOW.map(s => {
          const count = weekTasks.filter(t => t.status === s).length
          return (
            <div key={s} className={cn('rounded-lg p-2.5 text-center', STATUS_COLORS[s])}>
              <p className="text-lg font-bold">{count}</p>
              <p className="text-[10px] font-medium">{STATUS_LABEL[s]}</p>
            </div>
          )
        })}
      </div>

      {/* Team columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from(byMember.values()).filter(m => m.tasks.length > 0).map(({ profile, tasks: memberTasks }) => (
          <div key={profile.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                {profile.full_name?.charAt(0) ?? '?'}
              </div>
              <span className="text-sm font-semibold">{profile.full_name}</span>
              <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{memberTasks.length}</span>
            </div>
            <div className="space-y-1.5">
              {memberTasks.map((t: ProductionTask) => <TaskRow key={t.id} task={t} />)}
            </div>
          </div>
        ))}

        {unassigned.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">?</div>
              <span className="text-sm font-semibold text-muted-foreground">Sin asignar</span>
              <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{unassigned.length}</span>
            </div>
            <div className="space-y-1.5">
              {unassigned.map(t => <TaskRow key={t.id} task={t} />)}
            </div>
          </div>
        )}

        {filteredTasks.length === 0 && (
          <div className="col-span-full py-16 text-center text-muted-foreground">
            <p className="text-sm">No hay tareas para esta semana.</p>
            <p className="text-xs mt-1">Genera las tareas desde la pestaña Calendario.</p>
          </div>
        )}
      </div>
    </div>
  )
}
