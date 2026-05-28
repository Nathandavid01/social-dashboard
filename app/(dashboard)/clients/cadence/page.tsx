import { Suspense } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { CadenceTable } from '@/components/clients/cadence-table'
import { AutoApplyProfileButton } from '@/components/clients/auto-apply-profile-button'
import { NateLoader } from '@/components/shared/nate-loader'
import { inferAllActiveCadences } from '@/lib/actions/cadence'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function CadenceData() {
  const rows = await inferAllActiveCadences()
  return <CadenceTable rows={rows} />
}

export default function CadencePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Cadencia de publicación"
        description="Posts/semana, días activos, hora típica y plataformas por cliente — inferidos del historial de Metricool (últimas 8 semanas)."
        action={<AutoApplyProfileButton />}
      />
      <Suspense fallback={<div className="grid h-64 place-items-center"><NateLoader variant="inline" label="Analizando Metricool…" /></div>}>
        <CadenceData />
      </Suspense>
    </div>
  )
}
