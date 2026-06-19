import { createClient } from '@/lib/supabase/server'
import { ClientOnboardingWizard } from '@/components/clients/client-onboarding-wizard'
import { PageHeader } from '@/components/shared/page-header'
import { requirePermission } from '@/lib/auth/server'

export default async function NewClientPage() {
  await requirePermission('clients.create')
  const supabase = await createClient()
  const { data: teamMembers } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .order('full_name')

  return (
    <div className="space-y-6">
      <PageHeader title="Agregar cliente" description="Te guiamos paso a paso hasta dejarlo listo para automatizar" />
      <ClientOnboardingWizard teamMembers={teamMembers ?? []} />
    </div>
  )
}
