'use client'

import { useTransition } from 'react'
import { updateTaskStatus, deleteTask } from '@/lib/actions/tasks'
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
} from 'lucide-react'
import { cn, formatTime } from '@/lib/utils'

const taskTypeLabels: Record<string, string> = {
  content_creation: 'Content',
  scheduling: 'Schedule',
  reporting: 'Report',
  client_call: 'Call',
  review: 'Review',
  other: 'Other',
}

const priorityColors = ['', 'text-red-500', 'text-yellow-500', 'text-muted-foreground']

interface TaskCardProps {
  task: Task
  onEdit?: (task: Task) => void
}

export function TaskCard({ task, onEdit }: TaskCardProps) {
  const [isPending, startTransition] = useTransition()
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
    if (!confirm('Delete this task?')) return
    startTransition(async () => {
      const result = await deleteTask(task.id)
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      }
    })
  }

  return (
    <Card className={cn('transition-opacity', isPending && 'opacity-60')}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs shrink-0">
                {taskTypeLabels[task.type]}
              </Badge>
              {task.client && (
                <span className="text-xs text-muted-foreground truncate">
                  @ {(task.client as { id: string; name: string }).name}
                </span>
              )}
              <span className={cn('text-xs ml-auto', priorityColors[task.priority])}>
                {task.priority === 1 ? '↑ High' : task.priority === 2 ? '→ Med' : '↓ Low'}
              </span>
            </div>

            <p className="font-medium text-sm leading-snug">{task.title}</p>

            {task.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <TaskStatusBadge status={task.status} />

              {task.due_at && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTime(task.due_at)}
                </span>
              )}

              {task.assignee && (
                <div className="flex items-center gap-1.5 ml-auto">
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
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={isPending}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {task.status !== 'in_progress' && (
                <DropdownMenuItem onClick={() => handleStatusChange('in_progress')}>
                  <PlayCircle className="mr-2 h-4 w-4" />
                  Mark In Progress
                </DropdownMenuItem>
              )}
              {task.status !== 'completed' && (
                <DropdownMenuItem onClick={() => handleStatusChange('completed')}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Mark Complete
                </DropdownMenuItem>
              )}
              {task.status !== 'blocked' && (
                <DropdownMenuItem onClick={() => handleStatusChange('blocked')}>
                  <AlertCircle className="mr-2 h-4 w-4" />
                  Mark Blocked
                </DropdownMenuItem>
              )}
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(task)}>
                  Edit Task
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive cursor-pointer"
                onClick={handleDelete}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  )
}
