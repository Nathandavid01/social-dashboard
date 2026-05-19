import { createClient } from '@/lib/supabase/server'
import { getVideoQueueTasks } from '@/lib/clickup/client'
import { getTasks } from '@/lib/actions/tasks'
import { TaskFeed } from '@/components/operations/task-feed'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { Video, Clock } from 'lucide-react'
import Link from 'next/link'

export default async function OperationsPage() {
  const supabase = await createClient()

  const [tasks, { data: clients }, { data: teamMembers }, videoQueue] = await Promise.all([
    getTasks(),
    supabase.from('clients').select('id, name').eq('status', 'active').order('name'),
    supabase.from('profiles').select('id, full_name, email').order('full_name'),
    getVideoQueueTasks().catch(() => []),
  ])

  const pendingVideos = videoQueue.filter((t) => t.status?.status === 'por hacer')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations Board"
        description={`Today — ${format(new Date(), 'EEEE, MMMM d')}`}
      />

      {/* Video Queue Preview */}
      {pendingVideos.length > 0 && (
        <Card className="border-yellow-500/20 bg-yellow-500/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video className="h-4 w-4 text-yellow-500" />
                <CardTitle className="text-sm text-yellow-600 dark:text-yellow-400">
                  Video Queue — {pendingVideos.length} pendiente{pendingVideos.length !== 1 ? 's' : ''}
                </CardTitle>
              </div>
              <Link href="/automation" className="text-xs text-primary hover:underline">
                Ver en Automation →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingVideos.slice(0, 4).map((t) => {
              const clientField = t.custom_fields?.find((f) => f.name === 'Client Name')
              const clientName = clientField?.value ? String(clientField.value) : null
              return (
                <div key={t.id} className="flex items-center gap-2 text-sm">
                  <Clock className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                  <span className="truncate">{t.name}</span>
                  {clientName && (
                    <Badge variant="outline" className="text-xs shrink-0 ml-auto">{clientName}</Badge>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      <TaskFeed
        initialTasks={tasks}
        clients={clients ?? []}
        teamMembers={teamMembers ?? []}
      />
    </div>
  )
}
