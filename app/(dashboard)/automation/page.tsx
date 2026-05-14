import { PageHeader } from '@/components/shared/page-header'
import { AutomationPanel } from '@/components/automation/automation-panel'

export default function AutomationPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Automation"
        description="ClickUp → Caption → Metricool pipeline"
      />
      <AutomationPanel />
    </div>
  )
}
