import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PipelineCard } from '../pipeline-card'
import { PostingDaysEditor } from '../posting-days-editor'
import { OwnerForm } from '../owner-form'
import { LastMeetingEditor } from '../last-meeting-editor'
import { ColorSwatches } from '../color-swatches'
import { CalendarDays, User, Users, Palette } from 'lucide-react'
import type { Client } from '@/lib/supabase/types'
import type { ClientPipeline } from '@/lib/utils/content-pipeline'

interface Props {
  client: Client
  pipeline: ClientPipeline | null
}

export function OverviewTab({ client, pipeline }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {/* Pipeline spans full width on mobile, half on md, full on xl */}
      <div className="md:col-span-2 xl:col-span-3">
        {pipeline && <PipelineCard data={pipeline} title="Pipeline de contenido" linkable clientId={client.id} />}
      </div>

      <Card className="animate-in fade-in duration-500" style={{ animationDelay: '60ms', animationFillMode: 'backwards' }}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><User className="h-4 w-4" /> Owner</CardTitle>
        </CardHeader>
        <CardContent>
          <OwnerForm
            clientId={client.id}
            initial={{
              owner_name: client.owner_name,
              owner_email: client.owner_email,
              owner_phone: client.owner_phone,
            }}
          />
        </CardContent>
      </Card>

      <Card className="animate-in fade-in duration-500" style={{ animationDelay: '120ms', animationFillMode: 'backwards' }}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4" /> Días de posting</CardTitle>
        </CardHeader>
        <CardContent>
          <PostingDaysEditor clientId={client.id} initial={client.posting_days ?? []} />
        </CardContent>
      </Card>

      <Card className="animate-in fade-in duration-500" style={{ animationDelay: '180ms', animationFillMode: 'backwards' }}>
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

      <Card className="animate-in fade-in duration-500 md:col-span-2 xl:col-span-3" style={{ animationDelay: '240ms', animationFillMode: 'backwards' }}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Palette className="h-4 w-4" /> Brand colors</CardTitle>
        </CardHeader>
        <CardContent>
          <ColorSwatches colors={client.brand_colors} />
        </CardContent>
      </Card>
    </div>
  )
}
