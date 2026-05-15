import Link from 'next/link'
import { getClients } from '@/lib/actions/clients'
import { ClientTable } from '@/components/clients/client-table'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Users, Zap, Brain } from 'lucide-react'

export default async function ClientsPage() {
  const clients = await getClients()

  const active = clients.filter((c) => c.status === 'active').length
  const withMetricool = clients.filter((c) => c.metricool_blog_id).length
  const withAiProfile = clients.filter((c) => c.brand_voice).length

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

      <div className="grid gap-4 grid-cols-3">
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
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Metricool</p>
                <p className="text-2xl font-bold">{withMetricool}</p>
              </div>
              <Zap className="h-5 w-5 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Con IA</p>
                <p className="text-2xl font-bold">{withAiProfile}</p>
              </div>
              <Brain className="h-5 w-5 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <ClientTable clients={clients} />
    </div>
  )
}
