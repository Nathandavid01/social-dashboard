import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getClientById } from '@/lib/actions/clients'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/clients/status-badge'
import { PlatformBadges } from '@/components/clients/platform-badges'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Pencil, Calendar, CheckSquare } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [client, supabase] = await Promise.all([getClientById(id), createClient()])

  if (!client) notFound()

  const [{ data: tasks }, { data: events }] = await Promise.all([
    supabase
      .from('tasks')
      .select('*')
      .eq('client_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('content_events')
      .select('*')
      .eq('client_id', id)
      .order('scheduled_at', { ascending: false })
      .limit(10),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title={client.name}
        description={client.industry ?? undefined}
        action={
          <Button asChild variant="outline">
            <Link href={`/clients/${id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
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
                {tasks.map((task) => (
                  <li key={task.id} className="text-sm flex items-center justify-between gap-2">
                    <span className="truncate">{task.title}</span>
                    <span className="text-xs text-muted-foreground capitalize shrink-0">
                      {task.status.replace('_', ' ')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm">Recent Content ({events?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {!events?.length ? (
              <p className="text-sm text-muted-foreground">No content scheduled.</p>
            ) : (
              <ul className="space-y-2">
                {events.map((event) => (
                  <li key={event.id} className="text-sm flex items-center justify-between gap-2">
                    <span className="truncate">{event.title}</span>
                    <span className="text-xs text-muted-foreground capitalize shrink-0">
                      {event.platform}
                    </span>
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
