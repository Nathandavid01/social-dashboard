import { createClient } from '@/lib/supabase/server'
import { getCalendarItems } from '@/lib/actions/calendar'
import { WeeklyCalendar } from '@/components/calendar/weekly-calendar'
import { PageHeader } from '@/components/shared/page-header'
import { startOfWeek, addDays, subDays } from 'date-fns'
import type { Profile } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export default async function CalendarPage() {
  const supabase = await createClient()

  const now = new Date()
  // Fetch a broad window so week navigation works without refetching.
  const rangeStart = subDays(startOfWeek(now, { weekStartsOn: 1 }), 7)
  const rangeEnd = addDays(now, 56)

  const [items, { data: clients }, { data: profiles }] = await Promise.all([
    getCalendarItems(rangeStart.toISOString(), rangeEnd.toISOString()),
    supabase.from('clients').select('id, name').eq('status', 'active').order('name'),
    supabase.from('profiles').select('id, full_name').order('full_name'),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendario de contenido"
        description="Grabaciones, publicaciones y posts de todos los clientes en un solo lugar"
      />
      <WeeklyCalendar
        initialItems={items}
        clients={clients ?? []}
        profiles={(profiles ?? []) as Pick<Profile, 'id' | 'full_name'>[]}
      />
    </div>
  )
}
