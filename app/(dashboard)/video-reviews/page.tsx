import { getVideoReviews } from '@/lib/actions/video-reviews'
import { getClientVideoPipeline } from '@/lib/actions/video-pipeline'
import { getMetricoolPicturesByBlogId } from '@/lib/actions/client-pictures'
import { createClient } from '@/lib/supabase/server'
import { resolveClientLogo } from '@/lib/utils/client-logo'
import { currentUserHas } from '@/lib/auth/server'
import { isReadyToEdit } from '@/lib/utils/edit-queue'
import { VideoReviewBoard } from '@/components/video-reviews/video-review-board'
import { ClientVideoSection } from '@/components/video-pipeline/client-video-section'
import { EditoresTab } from '@/components/video-pipeline/editores-tab'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import type { VideoReview, Client } from '@/lib/supabase/types'
import type { ClientVideoPipeline } from '@/lib/actions/video-pipeline'
import type { EditQueueItem } from '@/components/video-pipeline/editor-video-card'

export const dynamic = 'force-dynamic'

export default async function VideoReviewsPage() {
  const supabase = await createClient()

  const [reviews, { data: clients }, { data: sentDrafts }, pipeline, metricoolPics] = await Promise.all([
    getVideoReviews().catch(() => [] as VideoReview[]),
    supabase.from('clients').select('id, name').eq('status', 'active').order('name'),
    supabase.from('posting_drafts').select('video_review_id').eq('status', 'sent'),
    getClientVideoPipeline().catch(() => [] as ClientVideoPipeline[]),
    getMetricoolPicturesByBlogId().catch(() => ({} as Record<string, string>)),
  ])

  const sentReviewIds = (sentDrafts ?? []).map((d) => d.video_review_id as string)

  // Use the Metricool profile picture (the same one shown in the "Perfiles conectados"
  // list in /settings/metricool) as the client logo in the pipeline. Falls back to
  // the client's local logo_url if no Metricool picture is available.
  const pipelineWithLogos: ClientVideoPipeline[] = pipeline.map((p) => {
    const pic = p.client.metricool_blog_id
      ? metricoolPics[String(p.client.metricool_blog_id)]
      : undefined
    const displayLogo = pic || p.client.logo_url
    return {
      ...p,
      client: {
        ...p.client,
        logo_url: displayLogo,
      },
    }
  })

  // Hide clients with no pipeline videos to keep the view focused.
  const pipelineWithVideos = pipelineWithLogos.filter((p) => p.videos.length > 0)

  // Editing queue: videos with raw uploaded but no edited yet — only for uploaders.
  const canEdit = await currentUserHas('video.upload')
  const editQueue: EditQueueItem[] = canEdit
    ? pipeline.flatMap((p) =>
        p.videos.filter(isReadyToEdit).map((video) => ({
          video,
          client: { id: p.client.id, name: p.client.name, logo_url: p.client.logo_url },
        })),
      )
    : []

  return (
    <Tabs defaultValue="pipeline" className="space-y-4">
      <TabsList>
        <TabsTrigger value="pipeline">Pipeline de videos</TabsTrigger>
        <TabsTrigger value="board">Tablero de revisiones</TabsTrigger>
        {canEdit && (
          <TabsTrigger value="editores">
            Editores{editQueue.length > 0 ? ` (${editQueue.length})` : ''}
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="pipeline" className="space-y-5">
        {pipelineWithVideos.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              Aún no hay videos en el pipeline
            </p>
            <p className="text-xs text-muted-foreground/70">
              Las ideas de contenido con material o caption aparecerán aquí agrupadas por cliente.
            </p>
          </div>
        ) : (
          pipelineWithVideos.map((p) => <ClientVideoSection key={p.client.id} pipeline={p} />)
        )}
      </TabsContent>

      <TabsContent value="board">
        <VideoReviewBoard
          initialReviews={reviews as VideoReview[]}
          clients={(clients ?? []) as Pick<Client, 'id' | 'name'>[]}
          sentReviewIds={sentReviewIds}
        />
      </TabsContent>

      {canEdit && (
        <TabsContent value="editores" className="space-y-5">
          <EditoresTab items={editQueue} />
        </TabsContent>
      )}
    </Tabs>
  )
}
