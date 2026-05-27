'use client'

import { useTransition, useState, useRef } from 'react'
import Link from 'next/link'
import { updateTaskStatus, deleteTask, updateTask, duplicateTask } from '@/lib/actions/tasks'
import type { Task } from '@/lib/supabase/types'
import { useToast } from '@/lib/hooks/use-toast'
import { TaskStatusBadge } from './task-status-badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  MoreHorizontal,
  Clock,
  CheckCircle2,
  AlertCircle,
  Trash2,
  PlayCircle,
  CalendarPlus,
  Copy,
} from 'lucide-react'
import { cn, formatDueDate } from '@/lib/utils'

const taskTypeLabels: Record<string, string> = {
  content_creation: 'Contenido',
  scheduling: 'Programación',
  reporting: 'Reporte',
  client_call: 'Llamada',
  review: 'Revisión',
  other: 'Otro',
}

const priorityColors = ['', 'text-red-500', 'text-yellow-500', 'text-muted-foreground']

interface TaskCardProps {
  task: Task
  onEdit?: (task: Task) => void
  onOpenDetail?: (task: Task) => void
}

export function TaskCard({ task, onEdit, onOpenDetail }: TaskCardProps) {
  const [isPending, startTransition] = useTransition()
  const [editingDue, setEditingDue] = useState(false)
  const dueDateRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const assigneeInitials = task.assignee?.full_name
    ? task.assignee.full_name.split(' ').map((n) => n[0]).join('').toUpperCase()
    : '?'

  function handleStatusChange(status: string) {
    startTransition(async () => {
      const result = await updateTaskStatus(task.id, status)
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      }
    })
  }

  function handleDelete() {
    if (!confirm('¿Eliminar esta tarea?')) return
    startTransition(async () => {
      const result = await deleteTask(task.id)
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      }
    })
  }

  function handleDueDateSave(value: string) {
    setEditingDue(false)
    if (!value) return
    startTransition(async () => {
      const result = await updateTask(task.id, { due_at: new Date(value).toISOString() })
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      }
    })
  }

  return (
    <Card
      className={cn('transition-opacity group/card cursor-pointer hover:shadow-md', isPending && 'opacity-60')}
      onClick={() => onOpenDetail?.(task)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs shrink-0">
                {taskTypeLabels[task.type]}
              </Badge>
              {task.client && (
                <Link
                  href={`/clients/${(task.client as { id: string; name: string }).id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-muted-foreground hover:text-primary truncate transition-colors"
                >
                  @ {(task.client as { id: string; name: string }).name}
                </Link>
              )}
              <span className={cn('text-xs ml-auto', priorityColors[task.priority])}>
                {task.priority === 1 ? '↑ Alta' : task.priority === 2 ? '→ Media' : '↓ Baja'}
              </span>
            </div>

            <div className="flex items-start gap-2">
              {task.status !== 'completed' && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleStatusChange('completed') }}
                  disabled={isPending}
                  title="Marcar completa"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/30 hover:border-green-500 hover:bg-green-500/10 transition-colors opacity-0 group-hover/card:opacity-100 flex items-center justify-center"
                >
                  <span className="sr-only">Marcar completa</span>
                </button>
              )}
              <p className="font-medium text-sm leading-snug">{task.title}</p>
            </div>

            {task.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <TaskStatusBadge status={task.status} />

              {task.due_at && (() => {
                const { label, isOverdue, isDueToday } = formatDueDate(task.due_at)
                const isActive = task.status !== 'completed'
                return (
                  <span className={cn(
                    'text-xs flex items-center gap-1',
                    isActive && isOverdue
                      ? 'text-red-500 font-semibold'
                      : isActive && isDueToday
                        ? 'text-yellow-500 font-medium'
                        : 'text-muted-foreground',
                  )}>
                    <Clock className="h-3 w-3" />
                    {label}
                  </span>
                )
              })()}

              <div className="ml-auto flex items-center gap-2">
                {task.assignee && (
                  <div className="flex items-center gap-1.5">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                        {assigneeInitials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground">
                      {task.assignee.full_name}
                    </span>
                  </div>
                )}
                {task.collaborators && task.collaborators.length > 0 && (
                  <span className="text-[10px] text-muted-foreground border rounded-full px-1.5 py-0.5">
                    +{task.collaborators.length} collab
                  </span>
                )}

                {editingDue ? (
                  <input
                    ref={dueDateRef}
                    type="datetime-local"
                    defaultValue={task.due_at ? new Date(task.due_at).toISOString().slice(0, 16) : ''}
                    autoFocus
                    className="text-xs border rounded px-1.5 py-0.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    onBlur={(e) => handleDueDateSave(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleDueDateSave((e.target as HTMLInputElement).value)
                      if (e.key === 'Escape') setEditingDue(false)
                    }}
                  />
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingDue(true) }}
                    disabled={isPending}
                    title="Set due date"
                    className="h-5 w-5 shrink-0 flex items-center justify-center rounded text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-colors opacity-0 group-hover/card:opacity-100"
                  >
                    <CalendarPlus className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={isPending}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {task.status !== 'in_progress' && (
                <DropdownMenuItem onClick={() => handleStatusChange('in_progress')}>
                  <PlayCircle className="mr-2 h-4 w-4" />
                  En Progreso
                </DropdownMenuItem>
              )}
              {task.status !== 'completed' && (
                <DropdownMenuItem onClick={() => handleStatusChange('completed')}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Marcar Completada
                </DropdownMenuItem>
              )}
              {task.status !== 'blocked' && (
                <DropdownMenuItem onClick={() => handleStatusChange('blocked')}>
                  <AlertCircle className="mr-2 h-4 w-4" />
                  Marcar Bloqueada
                </DropdownMenuItem>
              )}
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(task)}>
                  Editar Tarea
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); startTransition(async () => { await duplicateTask(task.id) }) }}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive cursor-pointer"
                onClick={handleDelete}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  )
}
