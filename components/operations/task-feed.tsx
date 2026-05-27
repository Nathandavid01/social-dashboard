'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useRealtimeTasks } from '@/lib/hooks/use-realtime-tasks'
import { useAuth } from '@/lib/context/auth-context'
import type { Task, Client, Profile } from '@/lib/supabase/types'
import { TaskCard } from './task-card'
import { TaskForm } from './task-form'
import { TaskDetailSheet } from './task-detail-sheet'
import { TaskListView } from './task-list-view'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, ClipboardList, Search, LayoutGrid, List, Flag, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TaskFeedProps {
  initialTasks: Task[]
  clients: Pick<Client, 'id' | 'name'>[]
  teamMembers: Pick<Profile, 'id' | 'full_name' | 'email'>[]
}

export function TaskFeed({ initialTasks, clients, teamMembers }: TaskFeedProps) {
  const tasks = useRealtimeTasks(initialTasks)
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()

  // Initialize filters from URL params
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || 'all')
  const [typeFilter, setTypeFilter] = useState(() => searchParams.get('type') || 'all')
  const [assigneeFilter, setAssigneeFilter] = useState(() => searchParams.get('assignee') || 'all')
  const [clientFilter, setClientFilter] = useState(() => searchParams.get('client') || 'all')
  const [priorityFilter, setPriorityFilter] = useState<'all' | '1'>(() => (searchParams.get('priority') as 'all' | '1') || 'all')
  const [search, setSearch] = useState(() => searchParams.get('q') || '')
  const [showForm, setShowForm] = useState(false)
  const [newTaskStatus, setNewTaskStatus] = useState<string>('pending')
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [detailTask, setDetailTask] = useState<Task | null>(null)
  const [viewMode, setViewMode] = useState<'kanban' | 'priority' | 'list'>(() => (searchParams.get('view') as 'kanban' | 'priority' | 'list') || 'kanban')

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams()
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (typeFilter !== 'all') params.set('type', typeFilter)
    if (assigneeFilter !== 'all') params.set('assignee', assigneeFilter)
    if (clientFilter !== 'all') params.set('client', clientFilter)
    if (priorityFilter !== 'all') params.set('priority', priorityFilter)
    if (search.trim()) params.set('q', search.trim())
    if (viewMode !== 'kanban') params.set('view', viewMode)
    const qs = params.toString()
    router.replace(qs ? `/operations?${qs}` : '/operations', { scroll: false })
  }, [statusFilter, typeFilter, assigneeFilter, clientFilter, priorityFilter, search, viewMode]) // eslint-disable-line react-hooks/exhaustive-deps

  const nowTs = new Date()
  const todayStart = new Date(nowTs.getFullYear(), nowTs.getMonth(), nowTs.getDate()).toISOString()
  const todayEnd = new Date(nowTs.getFullYear(), nowTs.getMonth(), nowTs.getDate() + 1).toISOString()
  const weekEnd = new Date(nowTs.getFullYear(), nowTs.getMonth(), nowTs.getDate() + 7).toISOString()
  const nowIso = nowTs.toISOString()

  const SPECIAL_FILTERS = ['due_today', 'overdue', 'due_this_week']

  const filtered = tasks.filter((t) => {
    const matchStatus = statusFilter === 'all' || t.status === statusFilter
    const matchType = SPECIAL_FILTERS.includes(typeFilter) || typeFilter === 'all' ? true : t.type === typeFilter
    const matchSearch = !search.trim() ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      (t.client as { name?: string } | null)?.name?.toLowerCase().includes(search.toLowerCase())
    let matchDue = true
    if (typeFilter === 'due_today') matchDue = t.due_at != null && t.due_at >= todayStart && t.due_at < todayEnd
    else if (typeFilter === 'overdue') matchDue = t.due_at != null && t.due_at < nowIso && t.status !== 'completed'
    else if (typeFilter === 'due_this_week') matchDue = t.due_at != null && t.due_at >= nowIso && t.due_at < weekEnd
    const matchAssignee =
      assigneeFilter === 'all' ? true
      : assigneeFilter === 'me' ? t.assignee_id === user?.id
      : t.assignee_id === assigneeFilter
    const matchClient =
      clientFilter === 'all' ? true
      : clientFilter === 'none' ? t.client_id == null
      : t.client_id === clientFilter
    const matchPriority = priorityFilter === 'all' || t.priority === 1
    return matchStatus && matchType && matchSearch && matchDue && matchAssignee && matchClient && matchPriority
  })

  const grouped = {
    pending: filtered.filter((t) => t.status === 'pending'),
    in_progress: filtered.filter((t) => t.status === 'in_progress'),
    blocked: filtered.filter((t) => t.status === 'blocked'),
    completed: filtered.filter((t) => t.status === 'completed'),
  }

  const overdueCount = filtered.filter(
    (t) => t.status !== 'completed' && t.due_at != null && t.due_at < nowIso
  ).length

  const hasActiveFilters = statusFilter !== 'all' || typeFilter !== 'all' || assigneeFilter !== 'all' || clientFilter !== 'all' || priorityFilter !== 'all' || !!search.trim()

  function clearAllFilters() {
    setStatusFilter('all')
    setTypeFilter('all')
    setAssigneeFilter('all')
    setClientFilter('all')
    setPriorityFilter('all')
    setSearch('')
  }

  // Quick-filter pill counts
  const dueTodayCount = tasks.filter((t) => t.status !== 'completed' && t.due_at && t.due_at >= todayStart && t.due_at < todayEnd).length
  const overdueTotal = tasks.filter((t) => t.status !== 'completed' && t.due_at && t.due_at < nowIso).length
  const highPriorityCount = tasks.filter((t) => t.status !== 'completed' && t.priority === 1).length

  return (
    <>
      {/* Quick filter pills */}
      <div className="flex gap-2 flex-wrap">
        {dueTodayCount > 0 && (
          <button
            onClick={() => setTypeFilter(typeFilter === 'due_today' ? 'all' : 'due_today')}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors',
              typeFilter === 'due_today'
                ? 'bg-yellow-500 text-white border-yellow-500'
                : 'border-yellow-500/40 text-yellow-600 hover:bg-yellow-500/10'
            )}
          >
            ⏰ Vence hoy <span className="font-bold">{dueTodayCount}</span>
          </button>
        )}
        {overdueTotal > 0 && (
          <button
            onClick={() => setTypeFilter(typeFilter === 'overdue' ? 'all' : 'overdue')}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors',
              typeFilter === 'overdue'
                ? 'bg-red-500 text-white border-red-500'
                : 'border-red-500/40 text-red-600 hover:bg-red-500/10'
            )}
          >
            🔴 Vencidas <span className="font-bold">{overdueTotal}</span>
          </button>
        )}
        {highPriorityCount > 0 && (
          <button
            onClick={() => setPriorityFilter(priorityFilter === '1' ? 'all' : '1')}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors',
              priorityFilter === '1'
                ? 'bg-red-500 text-white border-red-500'
                : 'border-red-500/30 text-red-500 hover:bg-red-500/10'
            )}
          >
            🚨 Alta prioridad <span className="font-bold">{highPriorityCount}</span>
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar tarea o cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 w-52 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="in_progress">En Progreso</SelectItem>
              <SelectItem value="blocked">Bloqueada</SelectItem>
              <SelectItem value="completed">Completada</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="due_today">Vence hoy</SelectItem>
              <SelectItem value="due_this_week">Vence esta semana</SelectItem>
              <SelectItem value="overdue">Vencidas</SelectItem>
              <SelectItem value="content_creation">Contenido</SelectItem>
              <SelectItem value="scheduling">Programación</SelectItem>
              <SelectItem value="reporting">Reportes</SelectItem>
              <SelectItem value="client_call">Llamada</SelectItem>
              <SelectItem value="review">Revisión</SelectItem>
            </SelectContent>
          </Select>

          {teamMembers.length > 0 && (
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo el equipo</SelectItem>
                {user && <SelectItem value="me">Mis tareas</SelectItem>}
                {teamMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name || m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {clients.length > 0 && (
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los clientes</SelectItem>
                <SelectItem value="none">Sin cliente</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1.5 h-9 px-3 rounded-md border border-input text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
              title="Limpiar filtros"
            >
              ✕ Limpiar
            </button>
          )}
          {user && (
            <button
              onClick={() => setAssigneeFilter(assigneeFilter === 'me' ? 'all' : 'me')}
              className={cn(
                'flex items-center gap-1.5 h-9 px-3 rounded-md border text-xs font-medium transition-colors',
                assigneeFilter === 'me'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-input text-muted-foreground hover:bg-muted'
              )}
              title="Ver solo mis tareas"
            >
              <User className="h-3.5 w-3.5" />
              Mis Tareas
            </button>
          )}
          <div className="flex rounded-md border border-input overflow-hidden">
            <button
              onClick={() => setViewMode('kanban')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                viewMode === 'kanban'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Board
            </button>
            <button
              onClick={() => setViewMode('priority')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                viewMode === 'priority'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <Flag className="h-3.5 w-3.5" />
              Prioridad
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                viewMode === 'list'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <List className="h-3.5 w-3.5" />
              Lista
            </button>
          </div>
          <Button onClick={() => { setNewTaskStatus('pending'); setShowForm(true) }}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar Tarea
          </Button>
        </div>
      </div>

      {/* Quick stats */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          <span><span className="font-semibold text-foreground">{filtered.length}</span> total</span>
          <span><span className="font-semibold text-blue-500">{grouped.in_progress.length}</span> en progreso</span>
          {overdueCount > 0 && (
            <span className="text-orange-500 font-semibold animate-pulse">{overdueCount} vencida{overdueCount !== 1 ? 's' : ''} ⏰</span>
          )}
          {grouped.blocked.length > 0 && (
            <span className="text-red-500 font-semibold animate-pulse">{grouped.blocked.length} bloqueada{grouped.blocked.length !== 1 ? 's' : ''} ⚠</span>
          )}
          <span><span className="font-semibold text-green-500">{grouped.completed.length}</span> completadas</span>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Sin tareas"
          description="Agrega una tarea o ajusta los filtros."
          action={
            <Button onClick={() => { setNewTaskStatus('pending'); setShowForm(true) }}>
              <Plus className="mr-2 h-4 w-4" />
              Agregar Tarea
            </Button>
          }
        />
      ) : viewMode === 'list' ? (
        <TaskListView tasks={filtered} onOpenDetail={setDetailTask} />
      ) : viewMode === 'priority' ? (
        <div className="grid gap-6 lg:grid-cols-3">
          {([
            { priority: 1, label: '↑ Alta Prioridad', color: 'text-red-500', border: 'border-red-200', bg: 'bg-red-50 dark:bg-red-950/20' },
            { priority: 2, label: '→ Media Prioridad', color: 'text-yellow-500', border: 'border-yellow-200', bg: 'bg-yellow-50 dark:bg-yellow-950/20' },
            { priority: 3, label: '↓ Baja Prioridad', color: 'text-muted-foreground', border: 'border-border', bg: 'bg-muted/20' },
          ]).map(({ priority, label, color, border, bg }) => {
            const priorityTasks = filtered.filter((t) => t.priority === priority && t.status !== 'completed')
            return (
              <div key={priority} className={cn('rounded-xl border p-0.5', border)}>
                <div className={cn('rounded-t-xl px-3 py-2 flex items-center gap-2', bg)}>
                  <span className={cn('text-sm font-semibold', color)}>{label}</span>
                  <span className="ml-auto text-xs text-muted-foreground font-medium">{priorityTasks.length}</span>
                </div>
                <div className="p-2 space-y-2 min-h-[100px]">
                  {priorityTasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Sin tareas</p>
                  ) : (
                    priorityTasks.map((task) => (
                      <TaskCard key={task.id} task={task} onEdit={setEditingTask} onOpenDetail={setDetailTask} />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
          {([
            { status: 'pending', label: 'Por Hacer', color: 'text-muted-foreground' },
            { status: 'in_progress', label: 'En Progreso', color: 'text-blue-500' },
            { status: 'blocked', label: 'Bloqueadas', color: 'text-red-500' },
            { status: 'completed', label: 'Completadas', color: 'text-green-500' },
          ] as const).map(({ status, label, color }) => (
            <div key={status} className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className={`text-sm font-semibold ${color}`}>{label}</h3>
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                  {grouped[status].length}
                </span>
                {status !== 'completed' && (
                  <button
                    onClick={() => { setNewTaskStatus(status); setShowForm(true) }}
                    className="ml-auto h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title={`Add ${label} task`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {grouped[status].length === 0 ? (
                  <button
                    onClick={() => { setNewTaskStatus(status); setShowForm(true) }}
                    className="w-full text-xs text-muted-foreground py-6 text-center border border-dashed border-border rounded-lg hover:border-primary/50 hover:text-primary transition-colors"
                  >
                    + Agregar tarea
                  </button>
                ) : (
                  grouped[status].map((task) => (
                    <TaskCard key={task.id} task={task} onEdit={setEditingTask} onOpenDetail={setDetailTask} />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <TaskForm
        open={showForm}
        onOpenChange={setShowForm}
        clients={clients}
        teamMembers={teamMembers}
        defaultStatus={newTaskStatus}
      />

      <TaskForm
        open={!!editingTask}
        onOpenChange={(open) => { if (!open) setEditingTask(null) }}
        clients={clients}
        teamMembers={teamMembers}
        task={editingTask ?? undefined}
      />

      <TaskDetailSheet
        task={detailTask}
        open={!!detailTask}
        onClose={() => setDetailTask(null)}
        teamMembers={teamMembers}
      />
    </>
  )
}
