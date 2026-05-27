import { cn } from '@/lib/utils'
import type { ProductionTaskStatus } from '@/lib/supabase/types'

const STATUS_CONFIG: Record<ProductionTaskStatus, { label: string; className: string }> = {
  pendiente:    { label: 'Pendiente',    className: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' },
  en_edicion:   { label: 'En Edición',   className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
  en_revision:  { label: 'En Revisión',  className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
  revisiones:   { label: 'Cambios',      className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' },
  aprobado:     { label: 'Aprobado',     className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
  publicado:    { label: 'Publicado',    className: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
}

export function StatusBadge({ status, size = 'sm' }: { status: ProductionTaskStatus; size?: 'xs' | 'sm' }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={cn(
      'inline-flex items-center rounded-full font-medium whitespace-nowrap',
      size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
      cfg.className
    )}>
      {cfg.label}
    </span>
  )
}

export { STATUS_CONFIG }
