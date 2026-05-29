import { cn } from '@/lib/utils'
import type { IdeaPipeline } from '@/lib/utils/idea-pipeline-stages'

/** Segmented status bar: one segment per pipeline stage, filled up to the current stage. */
export function IdeaStatusBar({ pipeline }: { pipeline: IdeaPipeline }) {
  const { stages, currentIndex, completed } = pipeline
  const current = currentIndex < stages.length ? stages[currentIndex] : null

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1">
        {stages.map((s, i) => (
          <span
            key={s.key}
            data-testid="stage-segment"
            title={s.label}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors',
              s.done
                ? 'bg-emerald-500'
                : i === currentIndex
                  ? 'bg-primary animate-pulse'
                  : 'bg-muted',
            )}
          />
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {current ? (
          <>
            En <span className="font-medium text-foreground">{current.label}</span>
          </>
        ) : (
          <span className="font-medium text-emerald-600">Completado</span>
        )}
        <span className="tabular-nums"> · {completed}/{stages.length}</span>
      </p>
    </div>
  )
}
