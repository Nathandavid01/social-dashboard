import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  /** Smaller, secondary hint under the description (e.g. "Prueba a limpiar los filtros"). */
  hint?: string
  /** Render inside a dashed card wrapper. Default true. Set false to embed in an existing card. */
  bordered?: boolean
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  hint,
  bordered = true,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 py-16 text-center',
        bordered && 'rounded-xl border border-dashed border-border bg-muted/20',
        className,
      )}
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted ring-8 ring-muted/30">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && (
        <p className="text-muted-foreground mt-1 max-w-sm text-sm text-pretty">{description}</p>
      )}
      {hint && <p className="text-muted-foreground/70 mt-2 text-xs">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
