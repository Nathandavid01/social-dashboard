import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getClientById } from '@/lib/actions/clients'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/clients/status-badge'
import { PlatformBadges } from '@/components/clients/platform-badges'
import { VideoBufferCard } from '@/components/clients/video-buffer-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Pencil, Calendar, CheckSquare, Sparkles, Brain, AlertTriangle, Plus, Clock } from 'lucide-react'
import { formatDate, taskStatusColors } from '@/lib/utils'
import type { ContentIdea } from '@/lib/supabase/types'

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [client, supabase] = await Promise.all([getClientById(id), createClient()])

  if (!client) notFound()

  const [{ data: tasks }, { data: clientIdeas }] = await Promise.all([
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
  ])

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
          const json = await res.json() as {
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
    } catch { /* proceed without posts */ }
  }

  const hasAiProfile = client.brand_voice || client.caption_language || client.default_cta || client.default_hashtags || client.caption_notes
  const nowIso = new Date().toISOString()
  const openTasks = (tasks ?? []).filter((t) => t.status !== 'completed')
  const completedTasks = (tasks ?? []).filter((t) => t.status === 'completed')
  const overdueTasks = openTasks.filter((t) => t.due_at && t.due_at < nowIso)

  return (
    <div className="space-y-6">
      <PageHeader
        title={client.name}
        description={client.industry ?? undefined}
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/captions?client=${id}`}>
                <Sparkles className="mr-2 h-4 w-4" />
                Generar Caption
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/operations?client=${id}`}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Tarea
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/clients/${id}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBadge status={client.status} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Platforms</CardTitle>
          </CardHeader>
          <CardContent>
            <PlatformBadges platforms={client.platforms} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Since</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-sm">{formatDate(client.created_at)}</span>
          </CardContent>
        </Card>
      </div>

      {/* Task Stats */}
      {(tasks?.length ?? 0) > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className={openTasks.length > 0 ? 'border-blue-500/20' : ''}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <CheckSquare className="h-8 w-8 text-blue-500 p-1.5 bg-blue-500/10 rounded-lg" />
                <div>
                  <p className="text-2xl font-bold">{openTasks.length}</p>
                  <p className="text-xs text-muted-foreground">Tareas abiertas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={overdueTasks.length > 0 ? 'border-red-500/20' : ''}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Clock className={`h-8 w-8 p-1.5 rounded-lg ${overdueTasks.length > 0 ? 'text-red-500 bg-red-500/10' : 'text-muted-foreground bg-muted'}`} />
                <div>
                  <p className={`text-2xl font-bold ${overdueTasks.length > 0 ? 'text-red-500' : ''}`}>{overdueTasks.length}</p>
                  <p className="text-xs text-muted-foreground">Vencidas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <CheckSquare className="h-8 w-8 text-green-500 p-1.5 bg-green-500/10 rounded-lg" />
                <div>
                  <p className="text-2xl font-bold text-green-500">{completedTasks.length}</p>
                  <p className="text-xs text-muted-foreground">Completadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* AI Caption Profile */}
      {hasAiProfile && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <Brain className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">Caption AI Profile</CardTitle>
            {client.metricool_blog_id && (
              <Badge variant="outline" className="text-green-600 border-green-500/30 bg-green-500/10 text-xs ml-auto">
                Metricool conectado
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {client.caption_language && (
              <div className="flex items-start gap-2 text-sm">
                <span className="font-medium text-muted-foreground w-28 shrink-0">Idioma</span>
                <span className="capitalize">{client.caption_language}</span>
              </div>
            )}
            {client.brand_voice && (
              <div className="flex items-start gap-2 text-sm">
                <span className="font-medium text-muted-foreground w-28 shrink-0">Brand Voice</span>
                <span>{client.brand_voice}</span>
              </div>
            )}
            {client.default_cta && (
              <div className="flex items-start gap-2 text-sm">
                <span className="font-medium text-muted-foreground w-28 shrink-0">CTA</span>
                <span>{client.default_cta}</span>
              </div>
            )}
            {client.default_hashtags && (
              <div className="flex items-start gap-2 text-sm">
                <span className="font-medium text-muted-foreground w-28 shrink-0">Hashtags</span>
                <span className="text-xs font-mono text-muted-foreground">{client.default_hashtags}</span>
              </div>
            )}
            {client.caption_notes && (
              <div className="flex items-start gap-2 text-sm">
                <span className="font-medium text-muted-foreground w-28 shrink-0">Reglas</span>
                <span className="text-muted-foreground">{client.caption_notes}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {client.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{client.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Video Buffer */}
      <VideoBufferCard
        clientId={id}
        initialIdeas={(clientIdeas ?? []) as unknown as ContentIdea[]}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">Recent Tasks ({tasks?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {!tasks?.length ? (
              <p className="text-sm text-muted-foreground">No tasks yet.</p>
            ) : (
              <ul className="space-y-2">
                {tasks.map((task) => {
                  const isOverdue = task.status !== 'completed' && task.due_at && task.due_at < new Date().toISOString()
                  return (
                    <li key={task.id} className="text-sm flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isOverdue && <AlertTriangle className="h-3 w-3 text-orange-500 shrink-0" />}
                        <span className={isOverdue ? 'text-orange-500 truncate' : 'truncate'}>{task.title}</span>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-xs shrink-0 ${taskStatusColors[task.status as keyof typeof taskStatusColors] ?? ''}`}
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

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">
              {client.metricool_blog_id ? 'Últimos posts en Metricool' : 'Contenido'}
              {recentPosts.length > 0 && ` (${recentPosts.length})`}
            </CardTitle>
            {client.metricool_blog_id && (
              <Link
                href={`/published?blogId=${client.metricool_blog_id}`}
                className="ml-auto text-xs text-primary hover:underline"
              >
                Ver todos →
              </Link>
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
                  <li key={i} className="text-sm space-y-0.5">
                    <p className="text-xs text-muted-foreground">
                      {post.platforms.join(', ')} — {new Date(post.date).toLocaleDateString('es-PR', { month: 'short', day: 'numeric' })}
                    </p>
                    <p className="line-clamp-2 leading-snug">{post.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
