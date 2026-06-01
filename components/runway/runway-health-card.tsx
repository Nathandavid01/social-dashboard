import Link from 'next/link'
import { Rocket, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { computeRunway } from '@/lib/utils/content-runway'
import type { ClientPipeline } from '@/lib/utils/content-pipeline'

/**
 * Portfolio runway health for the Home page: how many clients are below one
 * month of buffer in some stage, plus the most-at-risk ones. Links to /runway.
 */
export function RunwayHealthCard({ perClient }: { perClient: ClientPipeline[] }) {
  const evaluated = perClient
    .map((c) => ({
      name: c.clientName,
      id: c.clientId,
      runway: computeRunway({
        ideas: c.ideas,
        porEditar: c.porEditar,
        porPublicar: c.porPublicar,
        weeklyCadence: c.targetSemana,
      }),
    }))
    .filter((c) => c.runway.status !== 'no_cadence')

  const behind = evaluated
    .filter((c) => c.runway.status !== 'ok')
    .sort((a, b) => (a.runway.minWeeks ?? 0) - (b.runway.minWeeks ?? 0))

  const allGood = evaluated.length > 0 && behind.length === 0

  return (
    <Card>
      <CardContent className="p-4">
        <Link href="/runway" className="group flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Rocket className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold leading-tight">Runway de contenido</p>
              <p className="text-xs text-muted-foreground">
                {evaluated.length === 0 ? (
                  'Configura cadencia para medir el runway'
                ) : allGood ? (
                  <span className="text-emerald-600">Todas tus empresas a 1 mes o más ✓</span>
                ) : (
                  <>
                    <span className="font-semibold text-foreground">{behind.length}</span> de {evaluated.length} clientes con &lt;1 mes
                  </>
                )}
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
        </Link>

        {behind.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {behind.slice(0, 4).map((c) => (
              <span
                key={c.id}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px]',
                  c.runway.status === 'risk'
                    ? 'border-red-500/20 bg-red-500/10 text-red-600'
                    : 'border-amber-500/20 bg-amber-500/10 text-amber-600',
                )}
              >
                {c.name}
                <span className="tabular-nums opacity-80">{c.runway.minWeeks}sem</span>
              </span>
            ))}
            {behind.length > 4 && (
              <span className="text-[11px] text-muted-foreground">+{behind.length - 4} más</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
