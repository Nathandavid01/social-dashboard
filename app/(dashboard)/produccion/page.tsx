import { createClient } from '@/lib/supabase/server'
import { getProductionSchedules, getProductionTasks, getMyProductionTasks, getReviewQueueTasks } from '@/lib/actions/production'
import { ProduccionClient } from '@/components/produccion/produccion-client'
import type { Profile, Client } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

function getMonday(d: Date) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

export default async function ProduccionPage() {
  const supabase = await createClient()

  const monday = getMonday(new Date())
  const currentWeekStart = monday.toISOString().slice(0, 10)

  // Extend window ±4 weeks to support calendar navigation without reload
  const windowStart = new Date(monday)
  windowStart.setDate(monday.getDate() - 28)
  const windowEnd = new Date(monday)
  windowEnd.setDate(monday.getDate() + 34)

  const [schedules, tasks, reviewTasks, myTasks, profilesRes, clientsRes] = await Promise.all([
    getProductionSchedules(),
    getProductionTasks({
      weekStart: windowStart.toISOString().slice(0, 10),
    }),
    getReviewQueueTasks(),
    getMyProductionTasks(),
    supabase
      .from('profiles')
      .select('id, full_name')
      .order('full_name'),
    supabase
      .from('clients')
      .select('id, name')
      .eq('status', 'active')
      .order('name'),
  ])

  const profiles = (profilesRes.data ?? []) as Pick<Profile, 'id' | 'full_name'>[]
  const clients = (clientsRes.data ?? []) as Pick<Client, 'id' | 'name'>[]

  return (
    <ProduccionClient
      schedules={schedules}
      tasks={tasks}
      reviewTasks={reviewTasks}
      myTasks={myTasks}
      profiles={profiles}
      clients={clients}
      currentWeekStart={currentWeekStart}
    />
  )
}
