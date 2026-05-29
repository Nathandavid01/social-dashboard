import { Suspense } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { PlanningBoard } from '@/components/planning/planning-board'
import { NateLoader } from '@/components/shared/nate-loader'
import { getWorkflowProgress } from '@/lib/utils/workflow-progress'
import { getPipelineTotals } from '@/lib/utils/content-pipeline'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function PlanningData() {
  const [{ rows }, pipeline] = await Promise.all([getWorkflowProgress(), getPipelineTotals()])
  const pipelines = Object.fromEntries(pipeline.perClient.map((p) => [p.clientId, p]))
  return <PlanningBoard rows={rows} pipelines={pipelines} />
}

export default function PlanningPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Planning"
        description="Primero, ideación: cada cliente debe tener ideas listas al menos un mes por adelantado según su cadencia. Luego se agendan las grabaciones. Hasta que todos estén listos, este trabajo sigue abierto."
      />
      <Suspense fallback={<div className="grid h-64 place-items-center"><NateLoader variant="inline" label="Calculando estado…" /></div>}>
        <PlanningData />
      </Suspense>
    </div>
  )
}
