import { requirePermission } from '@/lib/auth/server'
import { getPipelineTotals } from '@/lib/utils/content-pipeline'
import { computeRunway } from '@/lib/utils/content-runway'
import { PageHeader } from '@/components/shared/page-header'
import { RunwayBoard } from '@/components/runway/runway-board'
import { WeeklyPlanView } from '@/components/runway/weekly-plan-view'
import { getWeeklyPlan } from '@/lib/actions/weekly-plan'
import type { RunwayRowData } from '@/components/runway/runway-row'

export const dynamic = 'force-dynamic'

export default async function RunwayPage() {
  await requirePermission('runway.read')

  const [{ perClient }, plan] = await Promise.all([getPipelineTotals(), getWeeklyPlan()])

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Runway"
        description="A quién le toca esta semana, y cuánto contenido tiene cada cliente en banco."
      />

      {/* The short list first: with ~50 clients, "who do I touch NOW" is the
          question. The full board below is the detail behind it. */}
      {plan && <WeeklyPlanView plan={plan} />}

      {/* The detail behind the short list: weeks buffered at each stage. The old
          summary line lived here and now says the same thing as the header above. */}
      <div className="space-y-3 border-t pt-6">
        <h2 className="text-sm font-semibold">Semanas en banco por cliente</h2>
        <RunwayBoard rows={rows} />
      </div>
    </div>
  )
}
