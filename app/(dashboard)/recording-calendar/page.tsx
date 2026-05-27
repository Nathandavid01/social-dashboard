import { createClient } from '@/lib/supabase/server'
import { RecordingCalendarClient } from '@/components/recording/recording-calendar-client'
import type { Client, Profile, ContentIdea } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export default async function RecordingCalendarPage() {
  const supabase = await createClient()

  // Get the current month's sessions + clients + team members
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 1)
  const monthEnd = nextMonth.toISOString().slice(0, 10)

  const [sessionsResult, { data: clients }, { data: teamMembers }, { data: ideas }] = await Promise.all([
    supabase
      .from('recording_sessions')
      .select(`
        *,
        client:clients!recording_sessions_client_id_fkey(id, name),
        videographer:profiles!recording_sessions_videographer_id_fkey(id, full_name)
      `)
      .gte('session_date', monthStart)
      .lt('session_date', monthEnd)
      .order('session_date')
      .order('start_time', { nullsFirst: true }),
    supabase.from('clients').select('id, name').eq('status', 'active').order('name'),
    supabase.from('profiles').select('id, full_name').order('full_name'),
    // Fetch all non-discarded/non-published ideas for active clients
    supabase
      .from('content_ideas')
      .select('*')
      .in('status', ['idea', 'asignada', 'grabada'])
      .order('created_at', { ascending: false }),
  ])

  // Build a map: clientId → ideas[]
  const clientIdeasMap: Record<string, ContentIdea[]> = {}
  for (const idea of (ideas ?? []) as unknown as ContentIdea[]) {
    if (!clientIdeasMap[idea.client_id]) clientIdeasMap[idea.client_id] = []
    clientIdeasMap[idea.client_id].push(idea)
  }

  return (
    <RecordingCalendarClient
      initialSessions={(sessionsResult.data ?? []) as unknown as Parameters<typeof RecordingCalendarClient>[0]['initialSessions']}
      clients={(clients ?? []) as Pick<Client, 'id' | 'name'>[]}
      teamMembers={(teamMembers ?? []) as Pick<Profile, 'id' | 'full_name'>[]}
      clientIdeasMap={clientIdeasMap}
    />
  )
}
