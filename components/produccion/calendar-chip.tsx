import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isReallyPublished } from '@/lib/utils/publication-state'
import type { ProductionTask } from '@/lib/supabase/types'
import { StatusBadge } from './status-badge'

interface Props {
  contentType: 'R' | 'P'
  task: ProductionTask | undefined
}

/**
 * One Reel/Post slot in the weekly production calendar grid. Shows a green ✓
 * inline (never growing the cell) once the content is really published —
 * task.status='publicado' OR idea.status='publicada' OR idea.published_at set
 * — vs. still-pending, which renders exactly as before.
 */
export function CalendarChip({ contentType, task }: Props) {
  const published = task
    ? isReallyPublished({
        taskStatus: task.status,
        ideaStatus: task.idea?.status ?? null,
        publishedAt: task.idea?.published_at ?? null,
      })
    : false

  return (
    <div
      className={cn(
        'rounded-md px-1.5 py-0.5 text-[10px] font-bold leading-tight',
        contentType === 'R'
          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300'
          : 'bg-zinc-900 text-yellow-300 dark:bg-zinc-700',
        published && 'ring-1 ring-emerald-500/40'
      )}
    >
      <div className="flex items-center gap-1">
        <span>{contentType === 'R' ? 'Reel' : 'Post'}</span>
        {published && (
          <Check data-testid="calendar-chip-check" className="h-3 w-3 shrink-0 text-emerald-500" />
        )}
      </div>
      {task && (
        <div className="mt-0.5">
          <StatusBadge status={task.status} size="xs" />
        </div>
      )}
    </div>
  )
}
