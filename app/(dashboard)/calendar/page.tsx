import { createClient } from '@/lib/supabase/server'
import { getEventsForWeek } from '@/lib/actions/calendar'
import { WeeklyCalendar } from '@/components/calendar/weekly-calendar'
import { PageHeader } from '@/components/shared/page-header'
import { startOfWeek, endOfWeek } from 'date-fns'

export default async function CalendarPage() {
  const supabase = await createClient()

  const now = new Date()
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 })

  const [events, { data: clients }] = await Promise.all([
    getEventsForWeek(weekStart.toISOString(), weekEnd.toISOString()),
    supabase.from('clients').select('id, name').order('name'),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Calendar"
        description="Schedule and track content across all clients"
      />
      <WeeklyCalendar initialEvents={events} clients={clients ?? []} />
    </div>
  )
}
