import { createClient } from '@/lib/supabase/server'
import { ClientForm } from '@/components/clients/client-form'
import { PageHeader } from '@/components/shared/page-header'

export default async function NewClientPage() {
  const supabase = await createClient()
  const { data: teamMembers } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .order('full_name')

  return (
    <div className="space-y-6">
      <PageHeader title="Agregar cliente" description="Crea una nueva cuenta de cliente" />
      <ClientForm teamMembers={teamMembers ?? []} />
    </div>
  )
}
