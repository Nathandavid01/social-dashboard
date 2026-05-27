'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { updateTaskStatus } from '@/lib/actions/tasks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, CircleDot, Circle, Ban, ArrowRight } from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'
import type { Task } from '@/lib/supabase/types'

const statusConfig = {
  pending: { label: 'Pendiente', icon: Circle, color: 'text-muted-foreground' },
  in_progress: { label: 'En Progreso', icon: CircleDot, color: 'text-blue-500' },
  blocked: { label: 'Bloqueada', icon: Ban, color: 'text-red-500' },
  completed: { label: 'Completada', icon: CheckCircle2, color: 'text-green-500' },
} as const

function formatDue(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleTimeString('es-PR', {
      hour: 'numeric', minute: '2-digit', hour12: true,
    })
  } catch { return '' }
}

interface UrgentTaskListProps {
  tasks: Task[]
  title: string
  emptyMsg: string
  linkHref: string
}

export function UrgentTaskList({ tasks, title, emptyMsg, linkHref }: UrgentTaskListProps) {
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  function handleComplete(taskId: string, taskTitle: string) {
    startTransition(async () => {
      const result = await updateTaskStatus(taskId, 'completed')
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      } else {
        toast({ title: 'Tarea completada', description: taskTitle })
      }
    })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          <Link href={linkHref} className="text-xs text-primary hover:underline flex items-center gap-1">
            Ver todas <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">{emptyMsg}</p>
        ) : (
          <div className="space-y-2">
            {tasks.slice(0, 6).map((task) => {
              const cfg = statusConfig[task.status as keyof typeof statusConfig] ?? statusConfig.pending
              const Icon = cfg.icon
              return (
                <div
                  key={task.id}
                  className="group flex items-start gap-2.5 rounded-lg border bg-muted/20 px-3 py-2.5 hover:bg-muted/40 transition-colors"
                >
                  <button
                    onClick={() => handleComplete(task.id, task.title)}
                    disabled={isPending}
                    title="Marcar como completada"
                    className="mt-0.5 shrink-0 flex items-center justify-center"
                  >
                    <Icon className={`h-3.5 w-3.5 ${cfg.color} group-hover:text-green-500 transition-colors`} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-snug line-clamp-1">{task.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {(task.client as { name?: string } | null)?.name && (
                        <span className="text-xs text-primary font-medium">
                          {(task.client as { name: string }).name}
                        </span>
                      )}
                      {task.due_at && (
                        <span className="text-xs text-red-500 font-medium">
                          {formatDue(task.due_at)}
                        </span>
                      )}
                    </div>
                  </div>
                  {task.priority === 1 && (
                    <Badge variant="outline" className="text-[10px] text-red-500 border-red-500/30 bg-red-500/10 shrink-0">
                      Alta
                    </Badge>
                  )}
                </div>
              )
            })}
            {tasks.length > 6 && (
              <Link href={linkHref} className="block text-xs text-muted-foreground text-center hover:text-primary transition-colors pt-1">
                +{tasks.length - 6} más
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
