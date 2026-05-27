import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { ClientRequestsPanel } from '@/components/operations/client-requests-panel'
import type { ClientRequest } from '@/lib/supabase/types'
export default async function InboxPage() {
  const supabase = await createClient()

  const { data: all } = await supabase
    .from('client_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inbox de Clientes"
        description="Solicitudes recibidas a través del portal de clientes"
      />
      <ClientRequestsPanel initialRequests={(all ?? []) as ClientRequest[]} showHistory />
    </div>
  )
}
