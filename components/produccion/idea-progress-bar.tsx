'use client'

import { cn } from '@/lib/utils'
import type { IdeaProgress } from '@/lib/utils/idea-progress'

export function IdeaProgressBar({ progress }: { progress: IdeaProgress }) {
  const { percent, completed, total, missing } = progress
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
        <span className="font-semibold">{percent}%</span>
        <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
          {completed}/{total} etapas
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full bg-primary transition-all', percent === 100 && 'bg-green-500')}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {missing.length === 0 ? '✓ Pipeline completo' : <>Falta: {missing.join(', ')}</>}
      </p>
    </div>
  )
}
