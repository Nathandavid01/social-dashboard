import { getAlerts } from '@/lib/actions/alerts'
import { AlertsPanel } from '@/components/alerts/alerts-panel'
import { PageHeader } from '@/components/shared/page-header'

export default async function AlertsPage() {
  const alerts = await getAlerts()

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Alerts Center"
        description={`${alerts.length} active alert${alerts.length !== 1 ? 's' : ''}`}
      />
      <AlertsPanel initialAlerts={alerts} />
    </div>
  )
}
