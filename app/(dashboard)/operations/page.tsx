import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getTasks } from '@/lib/actions/tasks'
import { TaskFeed } from '@/components/operations/task-feed'
import { ClientRequestsPanel } from '@/components/operations/client-requests-panel'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { Video, Clock, CheckCircle2, AlertTriangle, PlayCircle } from 'lucide-react'
import Link from 'next/link'
import type { ClientRequest } from '@/lib/supabase/types'

export default async function OperationsPage() {
  const supabase = await createClient()

  const [tasks, { data: clients }, { data: teamMembers }, { data: approvedVideos }, clientRequestsResult] = await Promise.all([
    getTasks(),
    supabase.from('clients').select('id, name').eq('status', 'active').order('name'),
    supabase.from('profiles').select('id, full_name, email').order('full_name'),
    supabase
      .from('video_reviews')
      .select('id, title, drive_link, client:clients!video_reviews_client_id_fkey(id, name)')
      .eq('status', 'approved')
      .order('updated_at', { ascending: false })
      .limit(10),
    supabase
      .from('client_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const pendingVideos = approvedVideos ?? []
  const clientRequests = (clientRequestsResult.data ?? []) as ClientRequest[]

  const nowIso = new Date().toISOString()
  const openTasks = tasks.filter((t) => t.status !== 'completed')
  const inProgressCount = openTasks.filter((t) => t.status === 'in_progress').length
  const overdueCount = openTasks.filter((t) => t.due_at && t.due_at < nowIso).length
  const blockedCount = openTasks.filter((t) => t.status === 'blocked').length
  const completedCount = tasks.filter((t) => t.status === 'completed').length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations Board"
        description={`Today — ${format(new Date(), 'EEEE, MMMM d')}`}
      />

      {/* Task summary bar */}
      <div className="flex items-center gap-4 flex-wrap text-sm">
        <div className="flex items-center gap-1.5">
          <PlayCircle className="h-3.5 w-3.5 text-blue-500" />
          <span className="font-semibold text-blue-500">{inProgressCount}</span>
          <span className="text-muted-foreground">en progreso</span>
        </div>
        {overdueCount > 0 && (
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
            <span className="font-semibold text-red-500">{overdueCount}</span>
            <span className="text-muted-foreground">vencida{overdueCount !== 1 ? 's' : ''}</span>
          </div>
        )}
        {blockedCount > 0 && (
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
            <span className="font-semibold text-orange-500">{blockedCount}</span>
            <span className="text-muted-foreground">bloqueada{blockedCount !== 1 ? 's' : ''}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          <span className="font-semibold text-green-500">{completedCount}</span>
          <span className="text-muted-foreground">completadas</span>
        </div>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{tasks.length} total</span>
      </div>

      {/* Approved Videos — ready for caption generation */}
      {pendingVideos.length > 0 && (
        <Card className="border-yellow-500/20 bg-yellow-500/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video className="h-4 w-4 text-yellow-500" />
                <CardTitle className="text-sm text-yellow-600 dark:text-yellow-400">
                  Videos Aprobados — {pendingVideos.length} listo{pendingVideos.length !== 1 ? 's' : ''} para caption
                </CardTitle>
              </div>
              <Link href="/automation" className="text-xs text-primary hover:underline">
                Generar Captions →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingVideos.slice(0, 4).map((v) => {
              const client = v.client as unknown as { id: string; name: string } | null
              return (
                <div key={v.id} className="flex items-center gap-2 text-sm">
                  <Clock className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                  <span className="truncate">{v.title}</span>
                  <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                    {v.drive_link && (
                      <a href={v.drive_link} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary">Drive ↗</a>
                    )}
                    {client && (
                      <Badge variant="outline" className="text-xs">{client.name}</Badge>
                    )}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      <ClientRequestsPanel initialRequests={clientRequests} />

      <Suspense fallback={<div className="h-64 rounded-xl border border-border animate-pulse bg-muted/30" />}>
        <TaskFeed
          initialTasks={tasks}
          clients={clients ?? []}
          teamMembers={teamMembers ?? []}
        />
      </Suspense>
    </div>
  )
}
