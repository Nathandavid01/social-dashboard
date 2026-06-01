import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RunwayBar } from './runway-bar'
import { computeRunway, TARGET_WEEKS, type RunwayStatus } from '@/lib/utils/content-runway'
import type { ClientPipeline } from '@/lib/utils/content-pipeline'

const STATUS: Record<RunwayStatus, { label: string; cls: string }> = {
  ok: { label: 'Al día', cls: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
  warn: { label: 'Atrasado', cls: 'text-amber-600 bg-amber-500/10 border-amber-500/20' },
  risk: { label: 'En riesgo', cls: 'text-red-600 bg-red-500/10 border-red-500/20' },
  no_cadence: { label: 'Sin cadencia', cls: 'text-muted-foreground bg-muted border-border' },
}

/** Mini runway for one client (weeks of buffer per stage) on the profile overview. */
export function ClientRunwayWidget({ pipeline }: { pipeline: ClientPipeline }) {
  const runway = computeRunway({
    ideas: pipeline.ideas,
    porEditar: pipeline.porEditar,
    porPublicar: pipeline.porPublicar,
    weeklyCadence: pipeline.targetSemana,
  })
  const badge = STATUS[runway.status]

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-x-3 gap-y-1 pb-3">
        <CardTitle className="text-base">Runway de contenido</CardTitle>
        <span className={cn('shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium', badge.cls)}>
          {badge.label}
        </span>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {runway.status === 'no_cadence' ? (
          <p className="text-xs text-muted-foreground">
            Configura la cadencia del cliente para ver cuántas semanas de contenido tiene adelantadas.
          </p>
        ) : (
          <>
            <RunwayBar label="Ideas" weeks={runway.ideasWeeks} />
            <RunwayBar label="Grabado" weeks={runway.recordedWeeks} />
            <RunwayBar label="Editado" weeks={runway.editedWeeks} />
            <p className="pt-1 text-[10px] text-muted-foreground">Meta: {TARGET_WEEKS} semanas (1 mes) en cada etapa.</p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
