import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft, Sparkles, Palette, Scissors, History,
} from 'lucide-react'
import { IdeaBriefCard } from '@/components/produccion/idea-brief-card'
import { IdeaCaptionEditor } from '@/components/produccion/idea-caption-editor'
import { IdeaVideoPanel } from '@/components/recording/idea-video-panel'
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

      {/* Stage 1: Idea brief (collapsible once generated) */}
      <IdeaBriefCard
        hook={idea.hook}
        visualBrief={idea.visual_brief}
        captionAngle={idea.caption_angle}
        hashtags={idea.hashtags_suggestion}
      />

      {/* Stage 2: Caption */}
      <Card id="stage-caption" className="scroll-mt-20 animate-in fade-in slide-in-from-bottom-1 duration-300" style={{ animationDelay: '60ms', animationFillMode: 'backwards' }}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" /> Caption
          </CardTitle>
        </CardHeader>
        <CardContent>
          <IdeaCaptionEditor
            ideaId={ideaId}
            initialCaption={idea.generated_caption}
            initialPlatform={idea.caption_platform}
          />
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Stage 3: Material crudo + b-rolls + editado */}
        <Card id="stage-material" className="scroll-mt-20 animate-in fade-in slide-in-from-bottom-1 duration-300" style={{ animationDelay: '120ms', animationFillMode: 'backwards' }}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Scissors className="h-4 w-4 text-cyan-500" /> Material de video
            </CardTitle>
          </CardHeader>
          <CardContent>
            <IdeaVideoPanel ideaId={ideaId} ideaTitle={idea.title} videos={videos as ContentIdeaVideo[]} publicEnabled={isR2PublicConfigured()} />
          </CardContent>
        </Card>

        {/* Stage 4: Client assets to download */}
        <Card id="stage-assets" className="scroll-mt-20 animate-in fade-in slide-in-from-bottom-1 duration-300" style={{ animationDelay: '180ms', animationFillMode: 'backwards' }}>
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

