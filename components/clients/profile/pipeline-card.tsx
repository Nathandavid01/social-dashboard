import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Lightbulb, Video, Scissors, CalendarCheck, Send, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import type { ClientPipeline, PipelineTotals } from '@/lib/utils/content-pipeline'

interface Props {
  /** Either a single client's pipeline or aggregated totals. */
  data: ClientPipeline | (PipelineTotals & { title?: string })
  title?: string
  /** When true, each funnel node links to its corresponding view. */
  linkable?: boolean
  /** Optional client id to scope the links (?client=). */
  clientId?: string
}

interface Step {
  key: string
  label: string
  value: number
  icon: LucideIcon
  tone: string          // full classes for the card border + text accent
  iconBg: string        // classes for the icon circle background
  href: string
}

export function PipelineCard({ data, title, linkable, clientId }: Props) {
  const q = clientId ? `?client=${clientId}` : ''
  const steps: Step[] = [
    { key: 'ideas',       label: 'Ideas',        value: data.ideas,        icon: Lightbulb,     tone: 'text-purple-600 bg-purple-500/10 border-purple-500/25', iconBg: 'bg-purple-500/15 text-purple-600', href: `/planning${q}` },
    { key: 'porGrabar',   label: 'Por grabar',   value: data.porGrabar,    icon: Video,         tone: 'text-cyan-600 bg-cyan-500/10 border-cyan-500/25',   iconBg: 'bg-cyan-500/15 text-cyan-600',   href: `/recording-calendar${q}` },
    { key: 'porEditar',   label: 'Por editar',   value: data.porEditar,    icon: Scissors,      tone: 'text-orange-600 bg-orange-500/10 border-orange-500/25', iconBg: 'bg-orange-500/15 text-orange-600', href: `/produccion${q}` },
    { key: 'porPublicar', label: 'Por publicar', value: data.porPublicar,  icon: CalendarCheck, tone: 'text-blue-600 bg-blue-500/10 border-blue-500/25',   iconBg: 'bg-blue-500/15 text-blue-600',   href: `/posting${q}` },
    { key: 'publicadas',  label: 'Publicados (sem)', value: data.publicadasSemana, icon: Send,  tone: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/25', iconBg: 'bg-emerald-500/15 text-emerald-600', href: `/published${q}` },
  ]

  const weekPct = data.targetSemana > 0 ? Math.min((data.publicadasSemana / data.targetSemana) * 100, 100) : 0
  const monthPct = data.targetMes > 0 ? Math.min((data.publicadasMes / data.targetMes) * 100, 100) : 0
  const weekDeficit = data.semanaRemaining
  const monthDeficit = data.mesRemaining

  return (
    <Card className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title ?? 'Pipeline de contenido'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Funnel - Premium pipeline stages */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {steps.map((s, i) => {
            const inner = (
              <div className="flex flex-col items-center gap-2.5 text-center">
                {/* Larger icon in colored circle */}
                <div className={cn('rounded-full p-3 shadow-sm', s.iconBg)}>
                  <s.icon className="h-6 w-6" />
                </div>

                {/* Dominant number */}
                <div className="text-[42px] leading-none font-semibold tabular-nums tracking-[-2px] text-foreground">
                  {s.value}
                </div>

                {/* Label */}
                <div className="text-xs font-semibold tracking-[0.5px] text-foreground/70 uppercase">
                  {s.label}
                </div>
              </div>
            )

            const nodeClass = cn(
              'group flex w-full flex-col items-center justify-center rounded-3xl border bg-background/70 p-5 transition-all duration-200',
              'hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-lg',
              s.tone,
              'animate-in fade-in slide-in-from-bottom-1 duration-300',
              linkable && 'cursor-pointer active:scale-[0.985]',
            )

            return (
              <div key={s.key} className="relative">
                {linkable ? (
                  <Link href={s.href} className={nodeClass} style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'backwards' }}>
                    {inner}
                  </Link>
                ) : (
                  <div className={nodeClass} style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'backwards' }}>
                    {inner}
                  </div>
                )}

                {/* Nicer connectors */}
                {i < steps.length - 1 && (
                  <div className="absolute -right-3 top-1/2 hidden -translate-y-1/2 items-center justify-center md:flex">
                    <div className="h-px w-5 bg-border" />
                    <ArrowRight className="h-4 w-4 -ml-1 text-muted-foreground/50 group-hover:text-foreground/60 transition-colors" />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Progress vs target — much stronger visual treatment */}
        <div className="space-y-4 pt-1">
          <ProgressRow
            label="Esta semana"
            done={data.publicadasSemana}
            target={data.targetSemana}
            pct={weekPct}
            deficit={weekDeficit}
          />
          <ProgressRow
            label="Este mes"
            done={data.publicadasMes}
            target={data.targetMes}
            pct={monthPct}
            deficit={monthDeficit}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function ProgressRow({ label, done, target, pct, deficit }: {
  label: string
  done: number
  target: number
  pct: number
  deficit: number
}) {
  const onTrack = target === 0 || done >= target

  const barColor = target === 0
    ? 'bg-muted-foreground/50'
    : onTrack
      ? 'bg-emerald-500'
      : pct >= 50
        ? 'bg-amber-500'
        : 'bg-red-500'

  const hasTarget = target > 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-foreground">{label}</span>

        {hasTarget ? (
          <div className="flex items-center gap-2 text-sm tabular-nums">
            <span className="font-semibold text-foreground">
              {done}
            </span>
            <span className="text-muted-foreground">/ {target}</span>

            {deficit > 0 && (
              <span className="ml-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600">
                Faltan {deficit}
              </span>
            )}
            {deficit === 0 && (
              <span className="ml-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
                ¡Al día!
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Sin target definido</span>
        )}
      </div>

      {/* Much more prominent progress bar */}
      <div className="relative h-3 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700 ease-out',
            barColor
          )}
          style={{ width: hasTarget ? `${pct}%` : '0%' }}
        />

        {/* Target marker line */}
        {hasTarget && (
          <div
            className="absolute top-0 h-3 w-px bg-foreground/30"
            style={{ left: `${Math.min(pct, 100)}%` }}
          />
        )}
      </div>

      {hasTarget && (
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{pct}% completado</span>
          <span>{target} objetivo</span>
        </div>
      )}
    </div>
  )
}
