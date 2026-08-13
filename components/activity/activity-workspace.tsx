'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ActivityFeed } from './activity-feed'
import { SessionFeed } from './session-feed'
import type { ActivityLogEntry } from '@/lib/actions/activity'
import type { UiEventLogEntry } from '@/lib/actions/ui-events'

interface Props {
  activity: ActivityLogEntry[]
  session: UiEventLogEntry[]
  members: { id: string; full_name: string | null }[]
  canViewSession: boolean
  currentUserId: string | null
  day: string
}

export function ActivityWorkspace({
  activity,
  session,
  members,
  canViewSession,
  currentUserId,
  day,
}: Props) {
  if (!canViewSession) {
    return <ActivityFeed activity={activity} members={members} />
  }

  return (
    <Tabs defaultValue="sesion" className="space-y-4">
      <TabsList>
        <TabsTrigger value="sesion">Sesión</TabsTrigger>
        <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
      </TabsList>
      <TabsContent value="sesion">
        <SessionFeed
          events={session}
          members={members}
          defaultUserId={currentUserId}
          day={day}
        />
      </TabsContent>
      <TabsContent value="pipeline">
        <ActivityFeed activity={activity} members={members} />
      </TabsContent>
    </Tabs>
  )
}
