import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MemberTaskBoard } from '@/components/team/member-task-board'
import { MemberUploadHistory } from '@/components/team/member-upload-history'
import { ClientIdeasRows } from '@/components/ideas/client-ideas-rows'
import { getAssignedVideosForMember } from '@/lib/actions/content-ideas'
import { getVideoUploadMetricsByUser } from '@/lib/actions/video-uploads'
import { Film, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { Task, Profile, Client } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ memberId: string }>
}

export default async function MemberPage({ params }: Props) {
  const { memberId } = await params
  const supabase = await createClient()

  const [{ data: profile }, { data: tasks }, { data: clients }, { data: teamMembers }, assignedVideos, uploadMetrics] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', memberId).single(),
    supabase
      .from('tasks')
      .select(`
        *,
        client:clients!tasks_client_id_fkey(id, name),
        assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url)
      `)
      .eq('assignee_id', memberId)
      .order('priority', { ascending: true })
      .order('due_at', { ascending: true, nullsFirst: false }),
    supabase.from('clients').select('id, name').eq('status', 'active').order('name'),
    supabase.from('profiles').select('id, full_name').order('full_name'),
    getAssignedVideosForMember(memberId),
    getVideoUploadMetricsByUser({ userId: memberId }),
  ])

  if (!profile) notFound()

  const firstName = (profile as Profile).full_name?.split(' ')[0] ?? 'esta persona'

  return (
    <div className="space-y-6">
      <Link
        href="/team"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Team
      </Link>

      <MemberTaskBoard
        member={profile as Profile}
        initialTasks={(tasks ?? []) as unknown as Task[]}
        clients={(clients ?? []) as Pick<Client, 'id' | 'name'>[]}
        teamMembers={(teamMembers ?? []) as Pick<Profile, 'id' | 'full_name'>[]}
        assignedVideoCount={assignedVideos.length}
      />

      <MemberUploadHistory userId={memberId} initial={uploadMetrics[0] ?? null} />

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <Film className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Videos asignados</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
            {assignedVideos.length}
          </span>
        </div>
        {assignedVideos.length === 0 ? (
          <p className="rounded-lg border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
            {firstName} no tiene videos asignados pendientes de enviar.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Asignados a {firstName} — permanecen aquí hasta que se envíen a revisión.
            </p>
            <ClientIdeasRows ideas={assignedVideos} canAssign={false} showNextAction />
          </>
        )}
      </section>
    </div>
  )
}
