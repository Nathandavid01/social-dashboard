import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Lightbulb, Video, Scissors, CalendarCheck, Send, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import type { ClientPipeline, PipelineTotals } from '@/lib/utils/content-pipeline'

interface Props {
  /** Either a single client's pipeline or aggregated totals. */
  data: ClientPipeline | (PipelineTotals & { title?: string })
  title?: string
}

interface Step {
  key: string
  label: string
  value: number
  icon: LucideIcon
  tone: string
}

export function PipelineCard({ data, title }: Props) {
  const steps: Step[] = [
    { key: 'ideas',       label: 'Ideas',        value: data.ideas,        icon: Lightbulb,     tone: 'text-purple-500 bg-purple-500/10 border-purple-500/30' },
    { key: 'porGrabar',   label: 'Por grabar',   value: data.porGrabar,    icon: Video,         tone: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30' },
    { key: 'porEditar',   label: 'Por editar',   value: data.porEditar,    icon: Scissors,      tone: 'text-orange-500 bg-orange-500/10 border-orange-500/30' },
    { key: 'porPublicar', label: 'Por publicar', value: data.porPublicar,  icon: CalendarCheck, tone: 'text-blue-500 bg-blue-500/10 border-blue-500/30' },
    { key: 'publicadas',  label: 'Publicados (sem)', value: data.publicadasSemana, icon: Send,  tone: 'text-green-500 bg-green-500/10 border-green-500/30' },
  ]

  const weekPct = data.targetSemana > 0 ? Math.min((data.publicadasSemana / data.targetSemana) * 100, 100) : 0
  const monthPct = data.targetMes > 0 ? Math.min((data.publicadasMes / data.targetMes) * 100, 100) : 0
  const weekDeficit = Math.max(data.targetSemana - data.publicadasSemana, 0)
  const monthDeficit = Math.max(data.targetMes - data.publicadasMes, 0)

  return (
    <Card className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title ?? 'Pipeline de contenido'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Funnel */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
          {steps.map((s, i) => (
            <div key={s.key} className="relative">
              <div
                className={cn(
                  'flex flex-col items-center gap-1 rounded-lg border p-3 transition-transform hover:scale-[1.02] hover:-translate-y-0.5',
                  s.tone,
                  'animate-in fade-in slide-in-from-bottom-1 duration-300',
                )}
                style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'backwards' }}
              >
                <s.icon className="h-4 w-4" />
                <p className="text-2xl font-bold tabular-nums">{s.value}</p>
                <p className="text-[10px] text-center uppercase tracking-wide opacity-90 md:text-xs">{s.label}</p>
              </div>
              {/* Connector arrow (desktop only) */}
              {i < steps.length - 1 && (
                <ArrowRight className="absolute -right-3 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-muted-foreground/50 md:block" />
              )}
            </div>
          ))}
        </div>

        {/* Progress vs target */}
        <div className="space-y-3">
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
    ? 'bg-muted-foreground/30'
    : onTrack
      ? 'bg-green-500'
      : pct >= 50
        ? 'bg-yellow-500'
        : 'bg-red-500'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {target === 0 ? 'Sin target' : `${done}/${target}${deficit > 0 ? ` (faltan ${deficit})` : ' ✓'}`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full transition-all duration-700 ease-out', barColor)}
          style={{ width: target === 0 ? '0%' : `${pct}%` }}
        />
      </div>
    </div>
  )
}
