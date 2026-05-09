import Link from 'next/link'
import { PageHeader } from '@/components/shared/page-header'
import { CaptionGenerator } from '@/components/captions/caption-generator'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowRight } from 'lucide-react'
import { casitaViejaCaptions } from '@/lib/data/casita-vieja-captions'

const savedClients = [
  {
    name: 'Casita Vieja',
    href: '/captions/casita-vieja',
    count: casitaViejaCaptions.length,
    platforms: ['Facebook', 'Instagram Reel'],
  },
]

export default function CaptionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Captions"
        description="Genera y exporta captions para tus clientes en segundos"
      />

      {/* Saved Client Captions */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">CAPTIONS GUARDADOS</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {savedClients.map((client) => (
            <Link key={client.href} href={client.href}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{client.name}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {client.count} captions
                      </p>
                      <div className="flex gap-1.5 mt-2">
                        {client.platforms.map((p) => (
                          <Badge key={p} variant="secondary" className="text-xs">
                            {p}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <CaptionGenerator />
    </div>
  )
}
