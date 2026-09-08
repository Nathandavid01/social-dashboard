import { currentUserHas } from '@/lib/auth/server'
import { createClient } from '@/lib/supabase/server'
import { RecoveryPanel } from '@/components/metricool/recovery-panel'
import { PageHeader } from '@/components/shared/page-header'
import { SettingsTabs } from '@/components/settings/settings-tabs'
import { MetricoolPage } from '@/components/metricool/metricool-page'
import { getCachedMetricoolProfiles } from '@/lib/actions/metricool-profiles'

export const dynamic = 'force-dynamic'

export default async function MetricoolSettingsRoute() {
  const cachedProfiles = await getCachedMetricoolProfiles()
  const canRecover = await currentUserHas('posting.publish')
  const recovery = canRecover ? await (await createClient()).from('content_ideas')
    .select('id, title, posting_error').not('posting_started_at', 'is', null).is('metricool_post_id', null)
    .order('posting_started_at', {ascending:true}).limit(100) : null
  return (
    <div className="space-y-6">
      <PageHeader
        title="Metricool"
        description="Metricas y datos de tus redes sociales conectadas"
      />
      <SettingsTabs />
      {canRecover && <RecoveryPanel rows={recovery?.data ?? []} error={recovery?.error ? 'No se pudieron cargar los envíos pendientes.' : undefined} />}
      <MetricoolPage cachedProfiles={cachedProfiles} />
    </div>
  )
}
