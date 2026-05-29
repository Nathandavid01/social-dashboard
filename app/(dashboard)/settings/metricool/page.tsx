import { PageHeader } from '@/components/shared/page-header'
import { SettingsTabs } from '@/components/settings/settings-tabs'
import { MetricoolPage } from '@/components/metricool/metricool-page'
import { getCachedMetricoolProfiles } from '@/lib/actions/metricool-profiles'

export const dynamic = 'force-dynamic'

export default async function MetricoolSettingsRoute() {
  const cachedProfiles = await getCachedMetricoolProfiles()
  return (
    <div className="space-y-6">
      <PageHeader
        title="Metricool"
        description="Metricas y datos de tus redes sociales conectadas"
      />
      <SettingsTabs />
      <MetricoolPage cachedProfiles={cachedProfiles} />
    </div>
  )
}
