import { Badge } from '@/components/ui/badge'
import { cn, taskStatusColors } from '@/lib/utils'
import type { TaskStatus } from '@/lib/supabase/types'

const taskStatusLabels: Record<TaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  blocked: 'Blocked',
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <Badge variant="outline" className={cn('text-xs capitalize', taskStatusColors[status])}>
      {taskStatusLabels[status]}
    </Badge>
  )
}
