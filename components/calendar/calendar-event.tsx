import type { ContentEvent } from '@/lib/supabase/types'
import { cn, platformColors, formatTime } from '@/lib/utils'

const contentStatusDot: Record<string, string> = {
  draft: 'bg-muted-foreground',
  scheduled: 'bg-blue-500',
  published: 'bg-green-500',
  cancelled: 'bg-red-500',
}

interface CalendarEventProps {
  event: ContentEvent
}

export function CalendarEventChip({ event }: CalendarEventProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded text-xs border',
        platformColors[event.platform]
      )}
    >
      <span
        className={cn('h-1.5 w-1.5 rounded-full shrink-0', contentStatusDot[event.status])}
      />
      <span className="truncate font-medium">{event.title}</span>
      <span className="text-[10px] opacity-70 shrink-0">{formatTime(event.scheduled_at)}</span>
    </div>
  )
}
