import { notFound } from 'next/navigation'
import { getClientById } from '@/lib/actions/clients'
import { createClient } from '@/lib/supabase/server'
import { ClientForm } from '@/components/clients/client-form'
import { PageHeader } from '@/components/shared/page-header'

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [client, supabase] = await Promise.all([getClientById(id), createClient()])

  if (!client) notFound()

  const { data: teamMembers } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .order('full_name')

  return (
    <div className="space-y-6">
      <PageHeader title={`Edit ${client.name}`} description="Update client information" />
      <ClientForm client={client} teamMembers={teamMembers ?? []} />
    </div>
  )
}
