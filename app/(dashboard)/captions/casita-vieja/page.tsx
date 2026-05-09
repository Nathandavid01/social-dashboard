import { PageHeader } from '@/components/shared/page-header'
import { SavedCaptionsView } from '@/components/captions/saved-captions-view'
import { casitaViejaCaptions } from '@/lib/data/casita-vieja-captions'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function CasitaViejaCaptionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/captions">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a Captions
          </Link>
        </Button>
        <PageHeader
          title="Casita Vieja"
          description={`${casitaViejaCaptions.length} captions guardados de Facebook e Instagram`}
        />
      </div>
      <SavedCaptionsView captions={casitaViejaCaptions} clientName="Casita Vieja" />
    </div>
  )
}
