import Link from 'next/link'
import { AlertOctagon, CheckCircle2, ArrowRight, Calendar, Lightbulb, RefreshCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  pendingCount: number
  /** Breakdown so the banner can show what's actually pending. */
  buckets: { reagendar: number; agendar: number; ideas: number; listo: number }
  total: number
}

/**
 * Non-dismissible banner shown at the very top of /home.
 * Stays visible until every active client has been processed through
 * the weekly planning workflow (agendar / ideas / no reagendar pendiente).
 *
 * When the workflow is fully complete, the banner becomes a small
 * celebratory confirmation instead of disappearing — so the team always
 * sees "where we stand" on planning.
 */
export function PlanningBanner({ pendingCount, buckets, total }: Props) {
  if (pendingCount === 0 && total > 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/5 p-4 animate-in fade-in slide-in-from-top-2 duration-500">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Planning al día</p>
          <p className="text-xs text-muted-foreground">
            Los {total} clientes activos tienen su próxima sesión agendada y suficientes ideas listas.
          </p>
        </div>
        <Link
          href="/planning"
          className="shrink-0 text-xs text-muted-foreground hover:text-primary"
        >
          Ver detalle <ArrowRight className="ml-0.5 inline h-3 w-3" />
        </Link>
      </div>
    )
  }

  const tone = 'border-red-500/40 bg-red-500/[0.06] text-red-500'

  return (
    <Link
      href="/planning"
      className={cn(
        'group flex flex-wrap items-center gap-3 rounded-xl border-2 p-4 transition-colors',
        'animate-in fade-in slide-in-from-top-2 duration-500',
        tone,
      )}
      aria-live="polite"
    >
      <div className="relative shrink-0">
        <AlertOctagon className="h-6 w-6" />
        <span className="absolute -right-1 -top-1 inline-flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-current" />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-foreground">
          {pendingCount} cliente{pendingCount === 1 ? '' : 's'} requieren tu acción esta semana
        </p>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
          {buckets.ideas > 0 && (
            <span className="inline-flex items-center gap-1 text-yellow-500">
              <Lightbulb className="h-3 w-3" /> {buckets.ideas} sin ideas
            </span>
          )}
          {buckets.reagendar > 0 && (
            <span className="inline-flex items-center gap-1 text-red-500">
              <RefreshCcw className="h-3 w-3" /> {buckets.reagendar} reagendar
            </span>
          )}
          {buckets.agendar > 0 && (
            <span className="inline-flex items-center gap-1 text-orange-500">
              <Calendar className="h-3 w-3" /> {buckets.agendar} sin agendar
            </span>
          )}
        </div>
      </div>
      <span className="shrink-0 rounded-full bg-background/80 px-3 py-1.5 text-xs font-semibold text-foreground transition-transform group-hover:translate-x-0.5">
        Ir a Planning <ArrowRight className="ml-0.5 inline h-3 w-3" />
      </span>
    </Link>
  )
}
