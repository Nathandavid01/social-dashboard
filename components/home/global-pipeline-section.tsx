import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PipelineCard } from '@/components/clients/profile/pipeline-card'
import { Lightbulb, Video, Scissors, CalendarCheck, Send, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { ClientPipeline, PipelineTotals } from '@/lib/utils/content-pipeline'

interface Props {
  totals: PipelineTotals
  perClient: ClientPipeline[]
}

export function GlobalPipelineSection({ totals, perClient }: Props) {
  const atRiskWeek = perClient
    .filter((c) => c.targetSemana > 0 && c.semanaRemaining > 0 && c.porPublicar + c.publicadasSemana < c.targetSemana)
    .sort((a, b) => b.semanaRemaining - a.semanaRemaining)
    .slice(0, 5)

  return (
    <section className="space-y-4">
      <PipelineCard data={totals} title="Pipeline global — todos los clientes activos" />

      {/* Top clients at risk this week */}
      {atRiskWeek.length > 0 && (
        <Card className="animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ animationDelay: '120ms', animationFillMode: 'backwards' }}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              Clientes que necesitan empuje esta semana
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {atRiskWeek.map((c, i) => (
                <li
                  key={c.clientId}
                  className="flex items-center justify-between py-2 animate-in fade-in slide-in-from-left-1 duration-300"
                  style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'backwards' }}
                >
                  <Link href={`/clients/${c.clientId}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary">
                    {c.clientName}
                  </Link>
                  <div className="flex shrink-0 items-center gap-3 text-xs">
                    <span className="text-muted-foreground tabular-nums">
                      <strong className="text-foreground">{c.publicadasSemana}</strong>/{c.targetSemana} sem
                    </span>
                    <span
                      className={cn(
                        'rounded-full border px-2 py-0.5 font-medium',
                        c.semanaRemaining >= 3
                          ? 'border-red-500/30 bg-red-500/10 text-red-500'
                          : 'border-orange-500/30 bg-orange-500/10 text-orange-500',
                      )}
                    >
                      Faltan {c.semanaRemaining}
                    </span>
                    <span className="text-muted-foreground">
                      Buffer: <strong className="text-foreground tabular-nums">{c.porPublicar}</strong>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </section>
  )
}
