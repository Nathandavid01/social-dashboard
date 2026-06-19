'use client'

import { useTransition, useState, useMemo } from 'react'
import Link from 'next/link'
import type { Task } from '@/lib/supabase/types'
import { updateTaskStatus } from '@/lib/actions/tasks'
import { TaskStatusBadge } from './task-status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/lib/hooks/use-toast'
import { cn, formatDueDate } from '@/lib/utils'
import { Clock, Flag, CheckCircle2, ArrowUpDown, ArrowUp, ArrowDown, PlayCircle, AlertCircle, Circle, X } from 'lucide-react'
import { friendlyError } from '@/lib/utils/error-message'

type SortKey = 'title' | 'status' | 'priority' | 'due_at' | 'type'
type SortDir = 'asc' | 'desc'

const taskTypeLabels: Record<string, string> = {
  content_creation: 'Contenido',
  scheduling: 'Programación',
  reporting: 'Reporte',
  client_call: 'Llamada',
  review: 'Revisión',
  other: 'Otro',
}

const priorityLabels: Record<number, { label: string; color: string }> = {
  1: { label: 'Alta', color: 'text-red-500' },
  2: { label: 'Media', color: 'text-yellow-500' },
  3: { label: 'Baja', color: 'text-muted-foreground' },
}

interface TaskListViewProps {
  tasks: Task[]
  onOpenDetail?: (task: Task) => void
}

export function TaskListView({ tasks, onOpenDetail }: TaskListViewProps) {
  const [isPending, startTransition] = useTransition()
  const [sortKey, setSortKey] = useState<SortKey>('priority')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const { toast } = useToast()

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = useMemo(() => {
    return [...tasks].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'title') cmp = a.title.localeCompare(b.title)
      else if (sortKey === 'status') cmp = a.status.localeCompare(b.status)
      else if (sortKey === 'priority') cmp = a.priority - b.priority
      else if (sortKey === 'due_at') {
        if (!a.due_at && !b.due_at) cmp = 0
        else if (!a.due_at) cmp = 1
        else if (!b.due_at) cmp = -1
        else cmp = a.due_at.localeCompare(b.due_at)
      } else if (sortKey === 'type') cmp = a.type.localeCompare(b.type)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [tasks, sortKey, sortDir])

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-40" />
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
  }

  function ColHeader({ col, label }: { col: SortKey; label: string }) {
    return (
      <button
        onClick={() => toggleSort(col)}
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {label}
        <SortIcon col={col} />
      </button>
    )
  }

  function handleStatusChange(taskId: string, status: string) {
    startTransition(async () => {
      const result = await updateTaskStatus(taskId, status)
      if (result.error) toast({ title: 'Error', description: friendlyError(result.error), variant: 'destructive' })
    })
  }

  function toggleSelect(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === sorted.length) setSelected(new Set())
    else setSelected(new Set(sorted.map((t) => t.id)))
  }

  function bulkStatusChange(status: string) {
    const ids = Array.from(selected)
    startTransition(async () => {
      await Promise.all(ids.map((id) => updateTaskStatus(id, status)))
      toast({ title: `${ids.length} tarea${ids.length !== 1 ? 's' : ''} actualizadas` })
      setSelected(new Set())
    })
  }

  const allSelected = sorted.length > 0 && selected.size === sorted.length
  const someSelected = selected.size > 0 && !allSelected

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No hay tareas que mostrar con los filtros actuales.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/60 px-4 py-2.5 text-sm">
          <span className="font-medium text-xs">{selected.size} seleccionada{selected.size !== 1 ? 's' : ''}</span>
          <div className="flex items-center gap-1.5 ml-2">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => bulkStatusChange('completed')} disabled={isPending}>
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Completar
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => bulkStatusChange('in_progress')} disabled={isPending}>
              <PlayCircle className="h-3.5 w-3.5 text-blue-500" /> En Progreso
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => bulkStatusChange('pending')} disabled={isPending}>
              <Circle className="h-3.5 w-3.5 text-muted-foreground" /> Pendiente
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => bulkStatusChange('blocked')} disabled={isPending}>
              <AlertCircle className="h-3.5 w-3.5 text-red-500" /> Bloqueada
            </Button>
          </div>
          <Button size="sm" variant="ghost" className="ml-auto h-7 text-xs" onClick={() => setSelected(new Set())}>
            <X className="h-3.5 w-3.5 mr-1" /> Limpiar
          </Button>
        </div>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[auto_2fr_1fr_1fr_1fr_1fr_1fr] gap-3 px-4 py-2.5 bg-muted/40 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide border-b">
          <button
            onClick={toggleAll}
            className={cn(
              'h-4 w-4 rounded border-2 flex items-center justify-center transition-colors shrink-0',
              allSelected ? 'border-primary bg-primary' : someSelected ? 'border-primary' : 'border-muted-foreground/30 hover:border-primary'
            )}
            title="Seleccionar todos"
          >
            {(allSelected || someSelected) && <CheckCircle2 className={cn('h-2.5 w-2.5', allSelected ? 'text-primary-foreground' : 'text-primary')} />}
          </button>
          <ColHeader col="title" label="Tarea" />
          <ColHeader col="status" label="Estado" />
          <ColHeader col="type" label="Tipo" />
          <ColHeader col="priority" label="Prioridad" />
          <ColHeader col="due_at" label="Vencimiento" />
          <span>Asignado</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-border">
          {sorted.map((task) => {
            const dueInfo = task.due_at ? formatDueDate(task.due_at) : null
            const priority = priorityLabels[task.priority] ?? priorityLabels[2]
            const isSelected = selected.has(task.id)

            return (
              <div
                key={task.id}
                className={cn(
                  'grid grid-cols-[auto_2fr_1fr_1fr_1fr_1fr_1fr] gap-3 px-4 py-3 items-center hover:bg-muted/30 transition-colors cursor-pointer group',
                  isSelected && 'bg-primary/5'
                )}
                onClick={() => onOpenDetail?.(task)}
              >
                {/* Checkbox */}
                <button
                  onClick={(e) => toggleSelect(task.id, e)}
                  className={cn(
                    'h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors',
                    isSelected
                      ? 'border-primary bg-primary'
                      : 'border-muted-foreground/30 hover:border-primary opacity-0 group-hover:opacity-100'
                  )}
                >
                  {isSelected && <CheckCircle2 className="h-2.5 w-2.5 text-primary-foreground" />}
                </button>

                {/* Title + client */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="min-w-0">
                    <p className={cn('text-sm font-medium truncate', task.status === 'completed' && 'line-through text-muted-foreground')}>
                      {task.title}
                    </p>
                    {task.client && (
                      <Link
                        href={`/clients/${(task.client as { id: string; name: string }).id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[10px] text-muted-foreground hover:text-primary truncate transition-colors"
                      >
                        @ {(task.client as { id?: string; name: string }).name}
                      </Link>
                    )}
                  </div>
                </div>

                {/* Status — click to change */}
                <div onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="focus:outline-none">
                        <TaskStatusBadge status={task.status} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-36">
                      <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'pending')} disabled={task.status === 'pending'}>
                        <Circle className="mr-2 h-3.5 w-3.5 text-muted-foreground" /> Pending
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'in_progress')} disabled={task.status === 'in_progress'}>
                        <PlayCircle className="mr-2 h-3.5 w-3.5 text-blue-500" /> In Progress
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'blocked')} disabled={task.status === 'blocked'}>
                        <AlertCircle className="mr-2 h-3.5 w-3.5 text-red-500" /> Blocked
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'completed')} disabled={task.status === 'completed'}>
                        <CheckCircle2 className="mr-2 h-3.5 w-3.5 text-green-500" /> Completed
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Type */}
                <div>
                  <Badge variant="outline" className="text-[10px]">
                    {taskTypeLabels[task.type] ?? task.type}
                  </Badge>
                </div>

                {/* Priority */}
                <div className={cn('flex items-center gap-1 text-xs font-medium', priority.color)}>
                  <Flag className="h-3 w-3" />
                  {priority.label}
                </div>

                {/* Due date */}
                <div>
                  {dueInfo ? (
                    <span className={cn(
                      'text-xs flex items-center gap-1',
                      task.status !== 'completed' && dueInfo.isOverdue
                        ? 'text-red-500 font-semibold'
                        : task.status !== 'completed' && dueInfo.isDueToday
                          ? 'text-yellow-500 font-medium'
                          : 'text-muted-foreground'
                    )}>
                      <Clock className="h-3 w-3" />
                      {dueInfo.label}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground/40">—</span>
                  )}
                </div>

                {/* Assignee */}
                <div>
                  {task.assignee ? (
                    <div className="flex items-center gap-1.5">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[9px] bg-primary text-primary-foreground">
                          {task.assignee.full_name?.split(' ').map((n) => n[0]).join('').toUpperCase() ?? '?'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground truncate">{task.assignee.full_name}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground/40">—</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
