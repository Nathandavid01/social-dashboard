import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/shared/page-header'
import { WorkflowSettingsForm } from '@/components/settings/workflow-settings-form'
import { getCurrentRole } from '@/lib/auth/server'
import { getWorkflowSettings } from '@/lib/utils/workflow-progress'

export const dynamic = 'force-dynamic'

export default async function WorkflowSettingsPage() {
  const role = await getCurrentRole()
  if (role !== 'owner') redirect('/home')

  const settings = await getWorkflowSettings()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workflow · Planning"
        description="Configura cuándo un cliente cuenta como 'agendado' y cuántas ideas necesita para considerarse listo cada semana. Solo los Owners pueden cambiar estos valores."
      />
      <WorkflowSettingsForm initial={settings} />
    </div>
  )
}
