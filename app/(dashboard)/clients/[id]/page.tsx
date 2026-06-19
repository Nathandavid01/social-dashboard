import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getClientById } from '@/lib/actions/clients'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Pencil, Plus, AlertTriangle, CheckSquare, Calendar, MessageSquareText, BarChart3 } from 'lucide-react'
import { formatDate, taskStatusColors } from '@/lib/utils'
import { ClientHero } from '@/components/clients/profile/client-hero'
import { UploadLinkButton } from '@/components/clients/upload-link-button'
import { ClientTabs, type ClientTabKey } from '@/components/clients/profile/client-tabs'
import { SavedCaptionsView } from '@/components/captions/saved-captions-view'
import { fetchClientCaptions } from '@/lib/utils/client-captions'
import { OverviewTab } from '@/components/clients/profile/tabs/overview-tab'
import { ScheduleTab } from '@/components/clients/profile/tabs/schedule-tab'
import { BrandTab } from '@/components/clients/profile/tabs/brand-tab'
import { ContractTab } from '@/components/clients/profile/tabs/contract-tab'
import { BillingTab } from '@/components/clients/profile/tabs/billing-tab'
import { AssetsTab } from '@/components/clients/profile/tabs/assets-tab'
import { VideoBufferCard } from '@/components/clients/video-buffer-card'
import { NotifyOwnerButton } from '@/components/clients/profile/notify-owner-button'
import { getClientPipeline } from '@/lib/utils/content-pipeline'
import type { Client, ClientPayment, ClientAsset, ContentIdea } from '@/lib/supabase/types'

const VALID_TABS: ClientTabKey[] = ['overview', 'schedule', 'brand', 'contract', 'billing', 'assets', 'tasks', 'content', 'captions']

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const { tab } = await searchParams
  const defaultTab = (VALID_TABS as string[]).includes(tab ?? '') ? (tab as ClientTabKey) : 'overview'
  const [clientRaw, supabase] = await Promise.all([getClientById(id), createClient()])

  if (!clientRaw) notFound()
  const client = clientRaw as unknown as Client

  const [
    { data: tasks },
    { data: clientIdeas },
    { data: payments },
    { data: assets },
    pipeline,
  ] = await Promise.all([
    supabase
      .from('tasks')
      .select('*, assignee:profiles!tasks_assignee_id_fkey(id, full_name)')
      .eq('client_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('content_ideas')
      .select('*')
      .eq('client_id', id)
      .in('status', ['idea', 'asignada', 'grabada'])
      .order('created_at', { ascending: false }),
    supabase
      .from('client_payments')
      .select('*')
      .eq('client_id', id)
      .order('paid_at', { ascending: false }),
    supabase
      .from('client_assets')
      .select('*')
      .eq('client_id', id)
      .order('uploaded_at', { ascending: false }),
    getClientPipeline(id, client.posting_days ?? []),
  ])

  const paymentsList = (payments ?? []) as ClientPayment[]
  const assetsList = (assets ?? []) as ClientAsset[]

  // Fetch recent Metricool posts if client has blog connected
  let recentPosts: { text: string; date: string; platforms: string[] }[] = []
  if (client.metricool_blog_id) {
    try {
      const token = process.env.METRICOOL_TOKEN
      const userId = process.env.METRICOOL_USER_ID
      if (token && userId) {
        const end = new Date().toISOString().slice(0, 19)
        const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19)
        const url = `https://app.metricool.com/api/v2/scheduler/posts?userId=${userId}&blogId=${client.metricool_blog_id}&start=${start}&end=${end}`
        const res = await fetch(url, { headers: { 'X-Mc-Auth': token } })
        if (res.ok) {
          const json = (await res.json()) as {
            data?: { text: string; publicationDate: { dateTime: string }; providers?: { network: string }[]; draft?: boolean }[]
          }
          recentPosts = (json.data || [])
            .filter((p) => !p.draft && p.text?.trim())
            .sort((a, b) => b.publicationDate.dateTime.localeCompare(a.publicationDate.dateTime))
            .slice(0, 5)
            .map((p) => ({
              text: p.text,
              date: p.publicationDate.dateTime,
              platforms: (p.providers || []).map((x) => x.network),
            }))
        }
      }
    } catch {
      /* proceed without posts */
    }
  }

  const captionsResult = client.metricool_blog_id
    ? await fetchClientCaptions(client.metricool_blog_id, client.name)
    : null
  const captionsSlot = (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 pb-3">
        <MessageSquareText className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-base">
          Captions publicados
          {captionsResult?.ok && captionsResult.captions.length > 0 && ` (${captionsResult.captions.length})`}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!client.metricool_blog_id ? (
          <p className="text-sm text-muted-foreground">Conecta el blog de Metricool para ver sus captions.</p>
        ) : captionsResult && !captionsResult.ok ? (
          <p className="text-sm text-red-500">{captionsResult.error}</p>
        ) : !captionsResult?.ok || captionsResult.captions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay publicaciones en los últimos 90 días.</p>
        ) : (
          <SavedCaptionsView captions={captionsResult.captions} clientName={client.name} />
        )}
      </CardContent>
    </Card>
  )

  const nowIso = new Date().toISOString()
  const openTasks = (tasks ?? []).filter((t) => t.status !== 'completed')
  const completedTasks = (tasks ?? []).filter((t) => t.status === 'completed')
  const overdueTasks = openTasks.filter((t) => t.due_at && t.due_at < nowIso)

  const tasksSlot = (
    <div className="space-y-4">
      {(tasks?.length ?? 0) > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Abiertas" value={openTasks.length} tone="text-blue-500 bg-blue-500/10" />
          <StatCard label="Vencidas" value={overdueTasks.length} tone={overdueTasks.length > 0 ? 'text-red-500 bg-red-500/10' : 'text-muted-foreground bg-muted'} />
          <StatCard label="Completadas" value={completedTasks.length} tone="text-green-500 bg-green-500/10" />
        </div>
      )}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckSquare className="h-4 w-4" /> Tareas recientes ({tasks?.length ?? 0})
          </CardTitle>
          <Button asChild size="sm" variant="outline">
            <Link href={`/operations?client=${id}`}>Ver todas</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {!tasks?.length ? (
            <p className="text-sm text-muted-foreground">Sin tareas aún.</p>
          ) : (
            <ul className="space-y-2">
              {tasks.slice(0, 10).map((task) => {
                const isOverdue = task.status !== 'completed' && task.due_at && task.due_at < nowIso
                return (
                  <li key={task.id} className="flex items-center justify-between gap-2 text-sm">
                    <div className="flex min-w-0 items-center gap-1.5">
                      {isOverdue && <AlertTriangle className="h-3 w-3 shrink-0 text-orange-500" />}
                      <span className={isOverdue ? 'truncate text-orange-500' : 'truncate'}>{task.title}</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`shrink-0 text-xs ${taskStatusColors[task.status as keyof typeof taskStatusColors] ?? ''}`}
                    >
                      {task.status.replace('_', ' ')}
                    </Badge>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )

  const contentSlot = (
    <div className="grid gap-4 lg:grid-cols-2">
      <VideoBufferCard
        clientId={id}
        initialIdeas={(clientIdeas ?? []) as unknown as ContentIdea[]}
      />
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">
            {client.metricool_blog_id ? 'Últimos posts en Metricool' : 'Posts publicados'}
            {recentPosts.length > 0 && ` (${recentPosts.length})`}
          </CardTitle>
          {client.metricool_blog_id && (
            <div className="ml-auto flex items-center gap-3">
              <Link
                href={`/clients/${id}/reporte`}
                className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/15"
              >
                <BarChart3 className="h-3.5 w-3.5" /> Reporte
              </Link>
              <Link href={`/published?blogId=${client.metricool_blog_id}`} className="text-xs text-primary hover:underline">
                Ver todos →
              </Link>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {!client.metricool_blog_id ? (
            <p className="text-sm text-muted-foreground">Conecta Metricool para ver posts recientes.</p>
          ) : recentPosts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay posts en los últimos 30 días.</p>
          ) : (
            <ul className="space-y-3">
              {recentPosts.map((post, i) => (
                <li key={i} className="space-y-0.5 text-sm">
                  <p className="text-xs text-muted-foreground">
                    {post.platforms.join(', ')} —{' '}
                    {new Date(post.date).toLocaleDateString('es-PR', { month: 'short', day: 'numeric' })}
                  </p>
                  <p className="line-clamp-2 leading-snug">{post.text}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="space-y-4">
      <ClientHero client={client} lastPayment={paymentsList[0] ?? null} />

      {/* Quick actions row */}
      <div className="flex flex-wrap gap-2">
        {pipeline && (
          <NotifyOwnerButton
            clientId={id}
            clientName={client.name}
            ownerName={client.owner_name}
            ownerPhone={client.owner_phone}
            goalReached={pipeline.targetSemana > 0 && pipeline.publicadasSemana >= pipeline.targetSemana}
            targetSemana={pipeline.targetSemana}
            publicadasSemana={pipeline.publicadasSemana}
          />
        )}
        <Button asChild variant="outline" size="sm">
          <Link href={`/operations?client=${id}`}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Nueva tarea
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/clients/${id}/edit`}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar campos base
          </Link>
        </Button>
        <UploadLinkButton clientName={client.name} clientId={id} />
        <span className="ml-auto self-center text-xs text-muted-foreground">Creado {formatDate(client.created_at)}</span>
      </div>

      <ClientTabs
        defaultTab={defaultTab}
        overview={<OverviewTab client={client} pipeline={pipeline} />}
        schedule={<ScheduleTab client={client} />}
        brand={<BrandTab client={client} />}
        contract={<ContractTab client={client} />}
        billing={<BillingTab client={client} payments={paymentsList} />}
        assets={<AssetsTab clientId={id} assets={assetsList} />}
        tasks={tasksSlot}
        content={contentSlot}
        captions={captionsSlot}
      />

      {client.notes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Notas internas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{client.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-3">
          <CheckSquare className={`h-8 w-8 rounded-lg p-1.5 ${tone}`} />
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
