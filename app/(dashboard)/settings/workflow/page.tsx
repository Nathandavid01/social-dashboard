import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/shared/page-header'
import { SettingsTabs } from '@/components/settings/settings-tabs'
import { WorkflowSettingsForm } from '@/components/settings/workflow-settings-form'
import { PipelineStepAssigneesForm } from '@/components/settings/pipeline-step-assignees-form'
import { getCurrentRole } from '@/lib/auth/server'
import { getWorkflowSettings } from '@/lib/utils/workflow-progress'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function WorkflowSettingsPage() {
  const role = await getCurrentRole()
  if (role !== 'owner') redirect('/home')

  const settings = await getWorkflowSettings()
  const supabase = await createClient()
  const { data: members } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('status', 'active')
    .order('full_name')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workflow · Planning"
        description="Configura cuándo un cliente cuenta como 'agendado', cuántas ideas necesita para considerarse listo cada semana, y quién es responsable de cada paso del pipeline. Solo los Owners pueden cambiar estos valores."
      />
      <SettingsTabs />
      <WorkflowSettingsForm initial={settings} />
      <PipelineStepAssigneesForm
        initial={settings.pipeline_step_assignees}
        members={(members ?? []) as { id: string; full_name: string | null }[]}
      />
    </div>
  )
}
