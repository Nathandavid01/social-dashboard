'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ActivityFeed } from './activity-feed'
import { SessionFeed } from './session-feed'
import { JornadaBoard } from './jornada-board'
import type { ActivityLogEntry } from '@/lib/actions/activity'
import type { UiEventLogEntry } from '@/lib/actions/ui-events'
import type { TeamTimeBoard } from '@/lib/actions/presence'

interface Props {
  activity: ActivityLogEntry[]
  session: UiEventLogEntry[]
  members: { id: string; full_name: string | null }[]
  canViewSession: boolean
  canViewPipeline: boolean
  board: TeamTimeBoard
  currentUserId: string | null
  day: string
}

export function ActivityWorkspace({
  activity,
  session,
  members,
  canViewSession,
  canViewPipeline,
  board,
  currentUserId,
  day,
}: Props) {
  const jornada = <JornadaBoard board={board} currentUserId={currentUserId} />
  if (!canViewSession && !canViewPipeline) return jornada

  return (
    <Tabs defaultValue="jornada" className="space-y-4">
      <TabsList>
        <TabsTrigger value="jornada">Jornada</TabsTrigger>
        {canViewSession ? <TabsTrigger value="sesion">Sesión</TabsTrigger> : null}
        {canViewPipeline ? <TabsTrigger value="pipeline">Pipeline</TabsTrigger> : null}
      </TabsList>
      <TabsContent value="jornada">{jornada}</TabsContent>
      {canViewSession ? (
        <TabsContent value="sesion">
          <SessionFeed
            events={session}
            members={members}
            defaultUserId={currentUserId}
            day={day}
          />
        </TabsContent>
      ) : null}
      {canViewPipeline ? (
        <TabsContent value="pipeline">
          <ActivityFeed activity={activity} members={members} />
        </TabsContent>
      ) : null}
    </Tabs>
  )
}
