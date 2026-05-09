import Link from 'next/link'
import { getClients } from '@/lib/actions/clients'
import { ClientTable } from '@/components/clients/client-table'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default async function ClientsPage() {
  const clients = await getClients()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description={`${clients.length} client${clients.length !== 1 ? 's' : ''} total`}
        action={
          <Button asChild>
            <Link href="/clients/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Client
            </Link>
          </Button>
        }
      />
      <ClientTable clients={clients} />
    </div>
  )
}
