import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { CaptionGenerator } from '@/components/captions/caption-generator'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowRight, MessageSquareText } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function CaptionsPage() {
  const supabase = await createClient()
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, metricool_blog_id')
    .not('metricool_blog_id', 'is', null)
    .eq('status', 'active')
    .order('name')

  const activeClients = clients ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Captions"
        description="Genera y exporta captions para tus clientes en segundos"
      />

      {/* Saved Client Captions */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">
          CAPTIONS POR CLIENTE
        </h2>
        {activeClients.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No hay clientes activos con Metricool conectado.{' '}
              <Link href="/clients" className="text-primary hover:underline">
                Configura un cliente
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {activeClients.map((client) => (
              <Link key={client.id} href={`/captions/${client.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                  <CardContent className="pt-5 pb-4">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{client.name}</p>
                        <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                          <MessageSquareText className="h-3.5 w-3.5" />
                          Ver captions publicados
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <CaptionGenerator />
    </div>
  )
}
