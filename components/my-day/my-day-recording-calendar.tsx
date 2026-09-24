import { RecordingCalendarClient } from '@/components/recording/recording-calendar-client'
import { currentUserHas } from '@/lib/auth/server'
import { createClient } from '@/lib/supabase/server'
import type { Client, ContentIdea, Profile } from '@/lib/supabase/types'

/** Reuses the full recording calendar on Mi Día, only for operations viewers. */
export async function MyDayRecordingCalendar() {
  if (!(await currentUserHas('operations.overview'))) return null

  const supabase = await createClient()
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 1).toISOString().slice(0, 10)

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
    supabase.from('clients').select('id, name, posting_days, assigned_to').eq('status', 'active').order('name'),
    supabase.from('profiles').select('id, full_name').eq('status', 'active').order('full_name'),
    supabase
      .from('content_ideas')
      .select('*')
      .in('status', ['idea', 'asignada', 'grabada'])
      .order('created_at', { ascending: false }),
  ])

  const clientIdeasMap: Record<string, ContentIdea[]> = {}
  for (const idea of (ideas ?? []) as unknown as ContentIdea[]) {
    if (!clientIdeasMap[idea.client_id]) clientIdeasMap[idea.client_id] = []
    clientIdeasMap[idea.client_id].push(idea)
  }

  return (
    <section aria-label="Calendario y pendientes de grabación" className="min-w-0">
      <h2 className="mb-3 text-lg font-semibold">Calendario de grabación</h2>
      <RecordingCalendarClient
        initialSessions={(sessionsResult.data ?? []) as unknown as Parameters<typeof RecordingCalendarClient>[0]['initialSessions']}
        clients={(clients ?? []) as Pick<Client, 'id' | 'name' | 'posting_days' | 'assigned_to'>[]}
        teamMembers={(teamMembers ?? []) as Pick<Profile, 'id' | 'full_name'>[]}
        clientIdeasMap={clientIdeasMap}
      />
    </section>
  )
}
