import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PipelineCard } from '../pipeline-card'
import { LastMeetingEditor } from '../last-meeting-editor'
import { VideoThresholdCard } from '../video-threshold-card'
import { EditModeCard } from '../edit-mode-card'
import { ClientRunwayWidget } from '@/components/runway/client-runway-widget'
import { Users, Video, Globe, Scissors, Settings2, ChevronDown, StickyNote } from 'lucide-react'
import { MetricoolBlogEditor } from '../metricool-blog-editor'
import { ClientOnboardingCard } from '../../client-onboarding-card'
import { clientOnboardingStatus } from '@/lib/utils/client-onboarding'
import type { Client } from '@/lib/supabase/types'
import type { ClientPipeline } from '@/lib/utils/content-pipeline'

interface Props {
  client: Client
  pipeline: ClientPipeline | null
}

export function OverviewTab({ client, pipeline }: Props) {
  const hasVideos =
    !!pipeline && pipeline.ideas + pipeline.porGrabar + pipeline.porEditar + pipeline.porPublicar > 0
  const onboarding = clientOnboardingStatus({
    status: client.status,
    metricool_blog_id: client.metricool_blog_id,
    posting_days: client.posting_days,
    brand_voice: client.brand_voice,
    hasVideos,
  })

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {/* Onboarding checklist — visible only while setup is incomplete */}
      {!onboarding.complete && (
        <div className="md:col-span-2 xl:col-span-3">
          <ClientOnboardingCard clientId={client.id} status={onboarding} />
        </div>
      )}

      {/* Pipeline spans full width on mobile, half on md, full on xl */}
      <div className="md:col-span-2 xl:col-span-3">
        {pipeline && <PipelineCard data={pipeline} title="Pipeline de contenido" linkable clientId={client.id} />}
      </div>

      {pipeline && <ClientRunwayWidget pipeline={pipeline} />}

      {client.notes && (
        <Card className="md:col-span-1 xl:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><StickyNote className="h-4 w-4" /> Notas internas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{client.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Ajustes que se tocan poco: cerrados por defecto para que el Resumen
          muestre solo cómo va el cliente. Cadencia vive en Calendario, colores
          en Marca y el contacto del dueño en Cuenta. */}
      <details className="group rounded-xl border bg-card md:col-span-2 xl:col-span-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          Ajustes del cliente
          <span className="text-xs font-normal text-muted-foreground">Metricool, modo de edición, último meeting, buffer de videos</span>
          <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="grid gap-4 border-t p-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Globe className="h-4 w-4" /> Metricool</CardTitle>
            </CardHeader>
            <CardContent>
              <MetricoolBlogEditor
                clientId={client.id}
                clientName={client.name}
                initialBlogId={client.metricool_blog_id}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Scissors className="h-4 w-4" /> Modo de edición</CardTitle>
            </CardHeader>
            <CardContent>
              <EditModeCard clientId={client.id} initialMode={client.edit_mode ?? 'human'} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" /> Último meeting</CardTitle>
            </CardHeader>
            <CardContent>
              <LastMeetingEditor
                clientId={client.id}
                initialAt={client.last_meeting_at}
                initialNotes={client.last_meeting_notes}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Video className="h-4 w-4" /> Buffer de videos</CardTitle>
            </CardHeader>
            <CardContent>
              <VideoThresholdCard
                clientId={client.id}
                initialThreshold={client.video_threshold ?? 0}
                accumulated={(pipeline?.porEditar ?? 0) + (pipeline?.porPublicar ?? 0)}
              />
            </CardContent>
          </Card>
        </div>
      </details>
    </div>
  )
}
