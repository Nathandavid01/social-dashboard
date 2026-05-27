'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ProductionSchedule, ProductionTask, Profile } from '@/lib/supabase/types'
import { generateProductionTasks, updateScheduleAssignment } from '@/lib/actions/production'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Loader2, RefreshCw } from 'lucide-react'
import { StatusBadge } from './status-badge'

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function getMonday(d: Date) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function formatWeekStart(d: Date) {
  return d.toISOString().slice(0, 10)
}

function formatDateShort(d: Date) {
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

interface CalendarCell {
  scheduleId: string
  clientId: string
  clientName: string
  industry: string | null
  dayOfWeek: number
  contentType: 'R' | 'P'
  editorName: string | null
  designerName: string | null
  tasks: ProductionTask[]
}

interface Props {
  schedules: ProductionSchedule[]
  initialTasks: ProductionTask[]
  profiles: Pick<Profile, 'id' | 'full_name'>[]
  currentWeekStart: string
}

export function ProductionCalendar({ schedules, initialTasks, profiles, currentWeekStart }: Props) {
  const router = useRouter()
  const [weekStart, setWeekStart] = useState(currentWeekStart)
  const [tasks, setTasks] = useState(initialTasks)
  const [generating, startGenerating] = useTransition()
  const [generatedMsg, setGeneratedMsg] = useState<string | null>(null)
  const [expandedClient, setExpandedClient] = useState<string | null>(null)

  const monday = new Date(weekStart + 'T12:00:00Z')
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })

  const prevWeek = () => {
    const d = new Date(monday)
    d.setDate(d.getDate() - 7)
    setWeekStart(formatWeekStart(d))
  }

  const nextWeek = () => {
    const d = new Date(monday)
    d.setDate(d.getDate() + 7)
    setWeekStart(formatWeekStart(d))
  }

  const thisWeek = () => {
    setWeekStart(formatWeekStart(getMonday(new Date())))
  }

  const generateTasks = () => {
    startGenerating(async () => {
      const result = await generateProductionTasks(weekStart)
      if (result.error) {
        setGeneratedMsg(`Error: ${result.error}`)
      } else {
        setGeneratedMsg(`${result.count} tareas generadas`)
        setTimeout(() => setGeneratedMsg(null), 3000)
        router.refresh()
      }
    })
  }

  // Group schedules by client
  const clientGroups = new Map<string, { name: string; industry: string | null; cells: CalendarCell[] }>()

  for (const s of schedules) {
    const clientId = s.client?.id ?? s.client_id
    const clientName = s.client?.name ?? '—'
    const industry = s.client?.industry ?? null

    if (!clientGroups.has(clientId)) {
      clientGroups.set(clientId, { name: clientName, industry, cells: [] })
    }

    const weekTasks = tasks.filter(
      t => t.client_id === clientId &&
           t.content_type === s.content_type &&
           t.publish_date === weekDates[s.day_of_week - 1]?.toISOString().slice(0, 10)
    )

    clientGroups.get(clientId)!.cells.push({
      scheduleId: s.id,
      clientId,
      clientName,
      industry,
      dayOfWeek: s.day_of_week,
      contentType: s.content_type,
      editorName: s.assigned_editor?.full_name ?? null,
      designerName: s.assigned_designer?.full_name ?? null,
      tasks: weekTasks,
    })
  }

  // Sort clients alphabetically
  const sortedClients = Array.from(clientGroups.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name))

  // Count daily totals
  const dailyTotals = weekDates.map((_, dayIdx) =>
    Array.from(clientGroups.values()).reduce((sum, g) =>
      sum + g.cells.filter((c: CalendarCell) => c.dayOfWeek === dayIdx + 1).length, 0)
  )

  const totalTasks = tasks.filter(t => {
    const dateStr = t.publish_date
    return dateStr >= weekDates[0].toISOString().slice(0, 10) &&
           dateStr <= weekDates[6].toISOString().slice(0, 10)
  }).length

  return (
    <div className="space-y-4">
      {/* Week Navigator */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <button
            onClick={prevWeek}
            className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={thisWeek}
            className="px-3 py-1.5 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors"
          >
            Esta semana
          </button>
          <button
            onClick={nextWeek}
            className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="text-sm font-semibold text-foreground">
          {formatDateShort(weekDates[0])} — {formatDateShort(weekDates[6])}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {generatedMsg && (
            <span className="text-xs text-green-600 font-medium">{generatedMsg}</span>
          )}
          <button
            onClick={generateTasks}
            disabled={generating}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Generar semana
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span><span className="font-semibold text-foreground">{sortedClients.length}</span> clientes</span>
        <span><span className="font-semibold text-foreground">{schedules.length}</span> publicaciones programadas</span>
        <span><span className="font-semibold text-foreground">{totalTasks}</span> tareas esta semana</span>
        <div className="flex items-center gap-2 ml-auto">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-yellow-200 border border-yellow-300" /> Reel</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-zinc-800" /> Post</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-xl border border-border overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-[200px_repeat(7,1fr)] bg-muted/50 border-b border-border">
          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Cliente
          </div>
          {DAYS.map((day, i) => {
            const isToday = weekDates[i].toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10)
            return (
              <div key={day} className={cn(
                'px-2 py-2 text-center border-l border-border',
                isToday && 'bg-primary/5',
              )}>
                <div className={cn('text-xs font-semibold', isToday ? 'text-primary' : 'text-muted-foreground')}>
                  {isToday ? '● ' : ''}{day}
                </div>
                <div className={cn(
                  'text-xs mt-0.5',
                  isToday ? 'text-primary font-semibold' : dailyTotals[i] > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'
                )}>
                  {formatDateShort(weekDates[i])}
                </div>
                {dailyTotals[i] > 0 && (
                  <div className="text-[10px] text-primary mt-0.5">{dailyTotals[i]} ítems</div>
                )}
              </div>
            )
          })}
        </div>

        {/* Client rows */}
        {sortedClients.map(([clientId, group]) => {
          const isExpanded = expandedClient === clientId

          // Build day → cells map
          const dayCells = new Map<number, CalendarCell[]>()
          for (const cell of group.cells) {
            if (!dayCells.has(cell.dayOfWeek)) dayCells.set(cell.dayOfWeek, [])
            dayCells.get(cell.dayOfWeek)!.push(cell)
          }

          const clientTasks = tasks.filter(t => t.client_id === clientId &&
            t.publish_date >= weekDates[0].toISOString().slice(0, 10) &&
            t.publish_date <= weekDates[6].toISOString().slice(0, 10)
          )

          return (
            <div key={clientId} className="border-b border-border last:border-b-0">
              {/* Main row */}
              <div className="grid grid-cols-[200px_repeat(7,1fr)] hover:bg-muted/20 transition-colors">
                {/* Client name */}
                <button
                  onClick={() => setExpandedClient(isExpanded ? null : clientId)}
                  className="px-3 py-2 text-left flex items-start gap-1.5"
                >
                  <span className="text-xs font-medium text-foreground leading-snug truncate">{group.name}</span>
                  {clientTasks.length > 0 && (
                    <span className="shrink-0 text-[10px] bg-primary/10 text-primary px-1 rounded-full">
                      {clientTasks.length}
                    </span>
                  )}
                </button>

                {/* Day cells */}
                {[1, 2, 3, 4, 5, 6, 7].map((dayNum) => {
                  const cells = dayCells.get(dayNum) ?? []
                  const isTodayCol = weekDates[dayNum - 1].toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10)
                  return (
                    <div key={dayNum} className={cn('border-l border-border px-1.5 py-1.5 flex flex-col gap-1 min-h-[44px]', isTodayCol && 'bg-primary/5')}>
                      {cells.map((cell) => {
                        const taskForCell = cell.tasks[0]
                        return (
                          <div
                            key={cell.scheduleId + cell.contentType}
                            className={cn(
                              'rounded-md px-1.5 py-0.5 text-[10px] font-bold leading-tight',
                              cell.contentType === 'R'
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'
                                : 'bg-zinc-900 text-yellow-300 dark:bg-zinc-700'
                            )}
                          >
                            <div>{cell.contentType === 'R' ? 'Reel' : 'Post'}</div>
                            {taskForCell && (
                              <div className="mt-0.5">
                                <StatusBadge status={taskForCell.status} size="xs" />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>

              {/* Expanded task detail */}
              {isExpanded && (
                <div className="bg-muted/10 border-t border-dashed border-border px-3 py-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Tareas de {group.name} — esta semana
                  </p>
                  {clientTasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No hay tareas generadas para esta semana.</p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {clientTasks.map(task => (
                        <div key={task.id} className="bg-card rounded-lg border border-border p-2 text-xs space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className={cn(
                              'font-bold px-1.5 py-0.5 rounded-sm text-[10px]',
                              task.content_type === 'R'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-zinc-900 text-yellow-300'
                            )}>
                              {task.content_type === 'R' ? 'Reel' : 'Post'}
                            </span>
                            <span className="text-muted-foreground">
                              {new Date(task.publish_date + 'T12:00:00').toLocaleDateString('es', { weekday: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          <StatusBadge status={task.status} size="xs" />
                          {task.assigned_to && (
                            <p className="text-muted-foreground">→ {task.assigned_to.full_name}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {sortedClients.length === 0 && (
          <div className="py-16 text-center text-muted-foreground">
            <p className="text-sm">No hay horarios configurados.</p>
            <p className="text-xs mt-1">Agrega clientes desde la pestaña Asignaciones.</p>
          </div>
        )}
      </div>

      {/* Daily total footer */}
      {sortedClients.length > 0 && (
        <div className="grid grid-cols-[200px_repeat(7,1fr)] rounded-lg border border-border overflow-hidden text-xs">
          <div className="bg-muted/50 px-3 py-2 font-semibold text-muted-foreground">Total diario</div>
          {dailyTotals.map((total, i) => {
            const isTodayFoot = weekDates[i].toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10)
            return (
              <div key={i} className={cn(
                'border-l border-border px-2 py-2 text-center font-semibold',
                isTodayFoot ? 'bg-primary/10 text-primary' : total > 0 ? 'bg-primary/5 text-primary' : 'bg-muted/30 text-muted-foreground'
              )}>
                {total || '—'}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
