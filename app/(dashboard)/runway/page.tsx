import { requirePermission } from '@/lib/auth/server'
import { getPipelineTotals } from '@/lib/utils/content-pipeline'
import { computeRunway } from '@/lib/utils/content-runway'
import { PageHeader } from '@/components/shared/page-header'
import { RunwayBoard } from '@/components/runway/runway-board'
import type { RunwayRowData } from '@/components/runway/runway-row'

export const dynamic = 'force-dynamic'

export default async function RunwayPage() {
  await requirePermission('runway.read')

  const { perClient } = await getPipelineTotals()

  const rows: RunwayRowData[] = perClient.map((c) => ({
    clientId: c.clientId,
    clientName: c.clientName,
    logoUrl: null,
    weeklyCadence: c.targetSemana,
    runway: computeRunway({
      ideas: c.ideas,
      porEditar: c.porEditar,
      porPublicar: c.porPublicar,
      weeklyCadence: c.targetSemana,
    }),
  }))

  // Most-at-risk first; clients with no cadence (minWeeks null) sink to the bottom.
  rows.sort((a, b) => {
    const am = a.runway.minWeeks
    const bm = b.runway.minWeeks
    if (am === null && bm === null) return a.clientName.localeCompare(b.clientName)
    if (am === null) return 1
    if (bm === null) return -1
    return am - bm
  })

  const cadenced = rows.filter((r) => r.runway.status !== 'no_cadence')
  const behind = cadenced.filter((r) => r.runway.status !== 'ok').length

  return (
    <div className="space-y-4">
      <PageHeader
        title="Runway"
        description="Semanas de contenido adelantadas por cliente. La meta: siempre 1 mes (4 semanas) en Ideas, Grabado y Editado."
      />
      <p className="text-sm text-muted-foreground">
        {cadenced.length === 0 ? (
          'Configura la cadencia de tus clientes para ver su runway.'
        ) : behind === 0 ? (
          <span className="text-emerald-600">✓ Todas tus empresas están a 1 mes o más.</span>
        ) : (
          <>
            <span className="font-semibold text-foreground">{behind}</span> de {cadenced.length}{' '}
            clientes tienen <span className="font-medium">menos de 1 mes</span> en alguna etapa.
          </>
        )}
      </p>
      <RunwayBoard rows={rows} />
    </div>
  )
}
