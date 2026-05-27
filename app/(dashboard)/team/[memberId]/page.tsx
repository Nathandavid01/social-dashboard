import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MemberTaskBoard } from '@/components/team/member-task-board'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { Task, Profile, Client } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ memberId: string }>
}

export default async function MemberPage({ params }: Props) {
  const { memberId } = await params
  const supabase = await createClient()

  const [{ data: profile }, { data: tasks }, { data: clients }, { data: teamMembers }] = await Promise.all([
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
  ])

  if (!profile) notFound()

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
      />
    </div>
  )
}
