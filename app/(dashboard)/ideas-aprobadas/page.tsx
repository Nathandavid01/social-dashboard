import { requirePermission } from '@/lib/auth/server'
import { getApprovedIdeas } from '@/lib/actions/idea-feedback'
import { getNextAutopostNotices, type NextAutopostNotice } from '@/lib/actions/next-autopost'
import { getClients } from '@/lib/actions/clients'
import { PageHeader } from '@/components/shared/page-header'
import { ApprovedIdeasList } from '@/components/ideas/approved-ideas-list'
import { ApprovedIdeasCaptions } from '@/components/ideas/approved-ideas-captions'
import { QuickCaptionDialog, type QuickCaptionClient } from '@/components/ideas/quick-caption-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { ApprovedIdea } from '@/lib/actions/idea-feedback-types'

export const dynamic = 'force-dynamic'

export default async function IdeasAprobadasPage() {
  await requirePermission('ideas.read')

  let ideas: ApprovedIdea[] = []
  try {
    ideas = await getApprovedIdeas()
  } catch {
    // Table not yet migrated (0033) — show the empty state instead of erroring.
    ideas = []
  }

  // "When/where will this publish" notice per client (from their cadence), so
  // each card can show it + pre-fill the schedule date. Best-effort.
  let nextPostByClient: Record<string, NextAutopostNotice> = {}
  try {
    nextPostByClient = await getNextAutopostNotices(ideas.map((i) => i.client_id))
  } catch {
    nextPostByClient = {}
  }

  // Clients for the standalone "Caption rápido" launcher.
  let clients: QuickCaptionClient[] = []
  try {
    const rows = await getClients({ status: 'active' })
    clients = rows.map((c) => ({ id: c.id, name: c.name, metricool_blog_id: c.metricool_blog_id ?? null }))
  } catch {
    clients = []
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Ideas Aprobadas"
        description="Ideas que el equipo de marketing aprobó en el Lab. Editores y diseñadores pueden tomarlas de aquí."
      />
      <Tabs defaultValue="ideas">
        <TabsList>
          <TabsTrigger value="ideas">Ideas</TabsTrigger>
          <TabsTrigger value="captions">Captions y Metricool</TabsTrigger>
        </TabsList>
        <TabsContent value="ideas" className="mt-4">
          <ApprovedIdeasList ideas={ideas} />
        </TabsContent>
        <TabsContent value="captions" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg border bg-muted/30 p-3">
            <p className="min-w-0 text-xs text-muted-foreground">
              ¿Algo de último minuto? Crea un caption y envíalo a Metricool sin pasar por una idea aprobada.
            </p>
            <div className="shrink-0">
              <QuickCaptionDialog clients={clients} />
            </div>
          </div>
          <ApprovedIdeasCaptions ideas={ideas} nextPostByClient={nextPostByClient} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
