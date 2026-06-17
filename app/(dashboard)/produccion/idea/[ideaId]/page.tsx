import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft, Palette, History,
} from 'lucide-react'
import { IdeaStudio } from '@/components/produccion/idea-studio'
import { ClientAssetsDownload } from '@/components/produccion/client-assets-download'
import { PipelineTimeline, type TimelineStage } from '@/components/produccion/pipeline-timeline'
import { IdeaProgressBar } from '@/components/produccion/idea-progress-bar'
import { computeIdeaProgress, type StageKey } from '@/lib/utils/idea-progress'
import { getIdeaVideos } from '@/lib/actions/idea-videos'
import { getClientAssets } from '@/lib/actions/client-profile'
import { getIdeaActivity } from '@/lib/utils/idea-activity'
import { isR2PublicConfigured } from '@/lib/integrations/r2'
import { currentUserHas } from '@/lib/auth/server'
import { IdeaActivityTimeline } from '@/components/produccion/idea-activity-timeline'
import type { ContentIdea, ContentIdeaVideo, ClientAsset } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

const TYPE_LABEL: Record<string, string> = { R: 'Reel', P: 'Post', C: 'Carrusel', S: 'Story' }

export default async function IdeaWorkspacePage({ params }: { params: Promise<{ ideaId: string }> }) {
  const { ideaId } = await params
  const supabase = await createClient()

  const { data: ideaRaw } = await supabase
    .from('content_ideas')
    .select('*, client:clients(id, name, industry)')
    .eq('id', ideaId)
    .single()

  if (!ideaRaw) notFound()
  const idea = ideaRaw as unknown as ContentIdea

  const canSeeActivity = await currentUserHas('activity.read')
  const [videos, assets, activity] = await Promise.all([
    getIdeaVideos(ideaId),
    idea.client_id ? getClientAssets(idea.client_id) : Promise.resolve([] as ClientAsset[]),
    canSeeActivity ? getIdeaActivity(ideaId) : Promise.resolve([]),
  ])

  const vids = videos as ContentIdeaVideo[]
  const progress = computeIdeaProgress({ idea, videos: vids, assetCount: (assets as ClientAsset[]).length })
  const ANCHOR_BY_KEY: Record<StageKey, string> = {
    idea: 'stage-idea',
    caption: 'stage-caption',
    material: 'stage-material',
    edited: 'stage-material',
    assets: 'stage-assets',
    approval: 'stage-assets',
    published: 'stage-assets',
  }
  const timeline: TimelineStage[] = progress.stages.map((s) => ({
    id: ANCHOR_BY_KEY[s.key],
    label: s.label,
    icon: s.key,
    done: s.done,
    count: s.count,
    detail: s.detail,
  }))

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/planning" className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
            <ArrowLeft className="h-3 w-3" /> Workflow
          </Link>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">
            {idea.title}
            <Badge variant="outline" className="text-xs">{TYPE_LABEL[idea.content_type] ?? idea.content_type}</Badge>
          </h1>
          {idea.client?.name && (
            <Link href={`/clients/${idea.client_id}`} className="text-sm text-muted-foreground hover:text-primary">
              {idea.client.name}
            </Link>
          )}
        </div>
      </div>

      {/* Clickable timeline — jumps to each stage */}
      <PipelineTimeline stages={timeline} />

      {/* Overall progress + what's missing */}
      <IdeaProgressBar progress={progress} />

      <IdeaStudio ideaId={ideaId} idea={idea} videos={vids} publicEnabled={isR2PublicConfigured()} />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Client assets to download */}
        <Card id="stage-assets" className="scroll-mt-20 animate-in fade-in slide-in-from-bottom-1 duration-300 lg:col-span-2" style={{ animationDelay: '180ms', animationFillMode: 'backwards' }}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Palette className="h-4 w-4 text-pink-500" /> Assets del cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ClientAssetsDownload assets={assets as ClientAsset[]} />
          </CardContent>
        </Card>
      </div>

      {/* Activity log — who did what, when */}
      {canSeeActivity && (
        <Card className="scroll-mt-20 animate-in fade-in slide-in-from-bottom-1 duration-300" style={{ animationDelay: '240ms', animationFillMode: 'backwards' }}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-muted-foreground" /> Actividad
            </CardTitle>
          </CardHeader>
          <CardContent>
            <IdeaActivityTimeline activities={activity} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

