import { Suspense } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { PlanningBoard } from '@/components/planning/planning-board'
import { NateLoader } from '@/components/shared/nate-loader'
import { getWorkflowProgress } from '@/lib/utils/workflow-progress'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function PlanningData() {
  const { rows } = await getWorkflowProgress()
  return <PlanningBoard rows={rows} />
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
