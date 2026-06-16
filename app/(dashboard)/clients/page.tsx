import Link from 'next/link'
import { getClients } from '@/lib/actions/clients'
import { ClientTable } from '@/components/clients/client-table'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Users } from 'lucide-react'
import { RoleGate } from '@/components/auth/role-gate'
import { ImportMetricoolButton } from '@/components/clients/import-metricool-button'

export default async function ClientsPage() {
  const clients = await getClients()

  const active = clients.filter((c) => c.status === 'active').length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description={`${clients.length} cliente${clients.length !== 1 ? 's' : ''} en total`}
        action={
          <div className="flex items-center gap-2">
            <RoleGate perm="clients.create">
              <ImportMetricoolButton />
            </RoleGate>
            <Button asChild>
              <Link href="/clients/new">
                <Plus className="mr-2 h-4 w-4" />
                Agregar cliente
              </Link>
            </Button>
          </div>
        }
      />

      {clients.length > 0 && (
        <div className="max-w-xs">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Activos</p>
                  <p className="text-2xl font-bold">{active}</p>
                </div>
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <ClientTable clients={clients} />
    </div>
  )
}
