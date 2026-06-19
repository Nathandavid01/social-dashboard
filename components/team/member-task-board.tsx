'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Task, Profile, Client } from '@/lib/supabase/types'
import { createTask, updateTaskStatus, deleteTask } from '@/lib/actions/tasks'
import { useToast } from '@/lib/hooks/use-toast'
import { cn, formatDueDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  CalendarDays,
  List,
  Plus,
  CheckCircle2,
  Clock,
  Flag,
  Users,
  Building2,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, addMonths, subMonths, parseISO } from 'date-fns'
import { friendlyError } from '@/lib/utils/error-message'

// ── Types ────────────────────────────────────────────────────────────────────

interface ExtendedTask extends Task {
  collaboratorProfiles?: Pick<Profile, 'id' | 'full_name'>[]
}

interface MemberTaskBoardProps {
  member: Profile
  initialTasks: ExtendedTask[]
  clients: Pick<Client, 'id' | 'name'>[]
  teamMembers: Pick<Profile, 'id' | 'full_name'>[]
  /** Videos assigned to this person and not yet submitted — counted as open work. */
  assignedVideoCount?: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const priorityConfig: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: 'Alta', color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20' },
  2: { label: 'Media', color: 'text-yellow-500', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  3: { label: 'Baja', color: 'text-muted-foreground', bg: 'bg-muted/50 border-border' },
}

function initials(name: string | null | undefined) {
  if (!name) return '?'
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

// ── Add Task Dialog ──────────────────────────────────────────────────────────

interface AddTaskDialogProps {
  open: boolean
  onClose: () => void
  memberId: string
  clients: Pick<Client, 'id' | 'name'>[]
  teamMembers: Pick<Profile, 'id' | 'full_name'>[]
  defaultDate?: string
}

function AddTaskDialog({ open, onClose, memberId, clients, teamMembers, defaultDate }: AddTaskDialogProps) {
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState('2')
  const [clientId, setClientId] = useState('none')
  const [collaborators, setCollaborators] = useState<string[]>([])
  const [dueAt, setDueAt] = useState(defaultDate ?? '')
  const [description, setDescription] = useState('')

  function toggleCollaborator(id: string) {
    setCollaborators((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id])
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    startTransition(async () => {
      const result = await createTask({
        title: title.trim(),
        description: description || undefined,
        type: 'other',
        client_id: clientId === 'none' ? null : clientId,
        assignee_id: memberId,
        status: 'pending',
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        priority: Number(priority) as 1 | 2 | 3,
      })
      if (result.error) {
        toast({ title: 'Error', description: friendlyError(result.error), variant: 'destructive' })
      } else {
        toast({ title: 'Tarea creada' })
        setTitle(''); setPriority('2'); setClientId('none'); setCollaborators([]); setDueAt(''); setDescription('')
        onClose()
      }
    })
  }

  const otherMembers = teamMembers.filter((m) => m.id !== memberId)

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nueva Tarea
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Nombre de la Tarea *</Label>
            <Input
              autoFocus
              placeholder="¿Qué hay que hacer?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <Flag className="h-3 w-3" /> Prioridad
              </Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1"><span className="text-red-500 font-medium">↑ Alta</span></SelectItem>
                  <SelectItem value="2"><span className="text-yellow-500 font-medium">→ Media</span></SelectItem>
                  <SelectItem value="3"><span className="text-muted-foreground">↓ Baja</span></SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <Clock className="h-3 w-3" /> Fecha Límite
              </Label>
              <Input
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>

          {/* Client */}
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              <Building2 className="h-3 w-3" /> Cliente (opcional)
            </Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Sin cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin cliente</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Collaborators */}
          {otherMembers.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <Users className="h-3 w-3" /> Colaboradores
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {otherMembers.map((m) => {
                  const selected = collaborators.includes(m.id)
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleCollaborator(m.id)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs border transition-colors',
                        selected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/50 border-border hover:border-primary/50'
                      )}
                    >
                      <Avatar className="h-4 w-4">
                        <AvatarFallback className={cn('text-[8px]', selected ? 'bg-primary-foreground text-primary' : 'bg-primary text-primary-foreground')}>
                          {initials(m.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      {m.full_name?.split(' ')[0]}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs">Notas (opcional)</Label>
            <Textarea
              placeholder="Detalles adicionales..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={isPending || !title.trim()}>
              {isPending ? 'Creando...' : 'Crear Tarea'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Task Row (List View) ─────────────────────────────────────────────────────

function TaskRow({ task, onComplete, onDelete }: { task: ExtendedTask; onComplete: () => void; onDelete: () => void }) {
  const dueInfo = task.due_at ? formatDueDate(task.due_at) : null
  const prio = priorityConfig[task.priority] ?? priorityConfig[2]

  return (
    <div className={cn(
      'group flex items-start gap-3 rounded-lg border px-4 py-3 transition-colors hover:bg-muted/30',
      task.status === 'completed' && 'opacity-60',
    )}>
      {/* Complete circle */}
      <button
        onClick={onComplete}
        className={cn(
          'mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors',
          task.status === 'completed'
            ? 'border-green-500 bg-green-500/20'
            : 'border-muted-foreground/30 hover:border-green-500 hover:bg-green-500/10'
        )}
      >
        {task.status === 'completed' && <CheckCircle2 className="h-3 w-3 text-green-500" />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium', task.status === 'completed' && 'line-through text-muted-foreground')}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {task.client && (
            <span className="text-[10px] text-primary font-medium flex items-center gap-0.5">
              <Building2 className="h-2.5 w-2.5" />
              {(task.client as { name: string }).name}
            </span>
          )}
          {task.collaboratorProfiles && task.collaboratorProfiles.length > 0 && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Users className="h-2.5 w-2.5" />
              {task.collaboratorProfiles.map((c) => c.full_name?.split(' ')[0]).join(', ')}
            </span>
          )}
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 shrink-0">
        {dueInfo && (
          <span className={cn(
            'text-xs flex items-center gap-1',
            task.status !== 'completed' && dueInfo.isOverdue ? 'text-red-500 font-semibold' :
            task.status !== 'completed' && dueInfo.isDueToday ? 'text-yellow-500' :
            'text-muted-foreground'
          )}>
            <Clock className="h-3 w-3" />
            {dueInfo.label}
          </span>
        )}
        <Badge variant="outline" className={cn('text-[10px]', prio.bg, prio.color)}>
          {prio.label}
        </Badge>
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── Calendar View ────────────────────────────────────────────────────────────

function CalendarView({ tasks, onAddTask }: { tasks: ExtendedTask[]; onAddTask: (date: string) => void }) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Pad start to Monday
  const startDow = (monthStart.getDay() + 6) % 7
  const paddedDays = [...Array(startDow).fill(null), ...days]

  function tasksForDay(day: Date) {
    return tasks.filter((t) => t.due_at && isSameDay(parseISO(t.due_at), day))
  }

  const prio1 = 'bg-red-500'
  const prio2 = 'bg-yellow-500'
  const prio3 = 'bg-muted-foreground'

  return (
    <div className="space-y-3">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1.5 rounded hover:bg-muted transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h3 className="text-sm font-semibold">{format(currentMonth, 'MMMM yyyy')}</h3>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1.5 rounded hover:bg-muted transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 text-center">
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
          <div key={d} className="text-[10px] font-semibold text-muted-foreground pb-1">{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {paddedDays.map((day, i) => {
          if (!day) return <div key={`pad-${i}`} />
          const dayTasks = tasksForDay(day)
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const dateStr = format(day, 'yyyy-MM-dd')

          return (
            <div
              key={dateStr}
              className={cn(
                'min-h-[72px] rounded-lg border p-1.5 cursor-pointer hover:border-primary/50 transition-colors group',
                isToday(day) ? 'border-primary bg-primary/5' : 'border-border',
                !isCurrentMonth && 'opacity-30'
              )}
              onClick={() => onAddTask(dateStr)}
            >
              <div className={cn(
                'text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full',
                isToday(day) ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              )}>
                {format(day, 'd')}
              </div>

              <div className="space-y-0.5">
                {dayTasks.slice(0, 3).map((t) => (
                  <div
                    key={t.id}
                    className={cn(
                      'flex items-center gap-1 rounded px-1 py-0.5',
                      t.status === 'completed' ? 'opacity-50' : ''
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className={cn('h-1.5 w-1.5 rounded-full shrink-0', t.priority === 1 ? prio1 : t.priority === 2 ? prio2 : prio3)} />
                    <span className={cn('text-[9px] font-medium leading-tight truncate', t.status === 'completed' && 'line-through')}>
                      {t.title}
                    </span>
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <p className="text-[9px] text-muted-foreground pl-1">+{dayTasks.length - 3} más</p>
                )}
              </div>

              {dayTasks.length === 0 && (
                <div className="opacity-0 group-hover:opacity-100 flex items-center justify-center h-8 text-[10px] text-muted-foreground">
                  <Plus className="h-3 w-3" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Board ───────────────────────────────────────────────────────────────

export function MemberTaskBoard({ member, initialTasks, clients, teamMembers, assignedVideoCount = 0 }: MemberTaskBoardProps) {
  const router = useRouter()
  const [tasks, setTasks] = useState<ExtendedTask[]>(initialTasks)
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [isPending, startTransition] = useTransition()
  const [showAddTask, setShowAddTask] = useState(false)
  const [addTaskDate, setAddTaskDate] = useState<string | undefined>()
  const [statusFilter, setStatusFilter] = useState<string>('open')
  const { toast } = useToast()

  const filtered = useMemo(() => {
    if (statusFilter === 'open') return tasks.filter((t) => t.status !== 'completed')
    if (statusFilter === 'completed') return tasks.filter((t) => t.status === 'completed')
    return tasks
  }, [tasks, statusFilter])

  const openCount = tasks.filter((t) => t.status !== 'completed').length
  const overdueCount = tasks.filter((t) => t.status !== 'completed' && t.due_at && t.due_at < new Date().toISOString()).length

  function handleComplete(task: ExtendedTask) {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed'
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: newStatus as Task['status'] } : t))
    startTransition(async () => {
      await updateTaskStatus(task.id, newStatus)
    })
  }

  function handleDelete(taskId: string) {
    if (!confirm('¿Eliminar esta tarea?')) return
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    startTransition(async () => {
      const result = await deleteTask(taskId)
      if (result.error) toast({ title: 'Error', description: friendlyError(result.error), variant: 'destructive' })
    })
  }

  function openAddTask(date?: string) {
    setAddTaskDate(date)
    setShowAddTask(true)
  }

  function handleTaskCreated() {
    setShowAddTask(false)
    router.refresh()
  }

  const grouped = useMemo(() => {
    const order: Task['status'][] = ['blocked', 'in_progress', 'pending', 'completed']
    const groups: Record<string, ExtendedTask[]> = {}
    for (const s of order) groups[s] = []
    for (const t of filtered) groups[t.status]?.push(t)
    return groups
  }, [filtered])

  const groupLabels: Record<string, string> = {
    blocked: 'Bloqueadas',
    in_progress: 'En Progreso',
    pending: 'Por Hacer',
    completed: 'Completadas',
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
              {initials(member.full_name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-lg font-semibold">{member.full_name ?? member.email}</h2>
            <p className="text-xs text-muted-foreground">
              {openCount} tarea{openCount !== 1 ? 's' : ''} abiert{openCount !== 1 ? 'as' : 'a'}
              {assignedVideoCount > 0 && <span className="text-primary ml-1">· {assignedVideoCount} video{assignedVideoCount !== 1 ? 's' : ''} por trabajar</span>}
              {overdueCount > 0 && <span className="text-red-500 ml-1">· {overdueCount} vencida{overdueCount !== 1 ? 's' : ''}</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Abiertas</SelectItem>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="completed">Completadas</SelectItem>
            </SelectContent>
          </Select>

          {/* View toggle */}
          <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
            <button
              onClick={() => setView('list')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                view === 'list' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <List className="h-3.5 w-3.5" /> Lista
            </button>
            <button
              onClick={() => setView('calendar')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                view === 'calendar' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" /> Calendario
            </button>
          </div>

          <Button size="sm" className="gap-1.5 h-8" onClick={() => openAddTask()}>
            <Plus className="h-3.5 w-3.5" /> Agregar Tarea
          </Button>
        </div>
      </div>

      {/* Views */}
      {view === 'list' ? (
        <div className="space-y-5">
          {(['blocked', 'in_progress', 'pending', 'completed'] as Task['status'][]).map((status) => {
            const group = grouped[status] ?? []
            if (group.length === 0) return null
            return (
              <div key={status} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {groupLabels[status]}
                  </h3>
                  <span className="text-xs font-bold text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 leading-none">
                    {group.length}
                  </span>
                  <div className="flex-1 border-t border-border" />
                </div>
                <div className="space-y-1.5">
                  {group.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onComplete={() => handleComplete(task)}
                      onDelete={() => handleDelete(task.id)}
                    />
                  ))}
                </div>
              </div>
            )
          })}

          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <CheckCircle2 className="mx-auto h-10 w-10 opacity-20 mb-3" />
              <p className="text-sm font-medium">¡Todo al día!</p>
              <p className="text-xs mt-1">Sin tareas en esta vista</p>
              <Button size="sm" variant="outline" className="mt-4 gap-1.5" onClick={() => openAddTask()}>
                <Plus className="h-3.5 w-3.5" /> Agregar Primera Tarea
              </Button>
            </div>
          )}
        </div>
      ) : (
        <CalendarView tasks={filtered} onAddTask={openAddTask} />
      )}

      <AddTaskDialog
        open={showAddTask}
        onClose={handleTaskCreated}
        memberId={member.id}
        clients={clients}
        teamMembers={teamMembers}
        defaultDate={addTaskDate}
      />
    </div>
  )
}
