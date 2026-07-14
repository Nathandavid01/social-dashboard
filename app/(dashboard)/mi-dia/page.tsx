import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMyDay } from '@/lib/actions/my-day'
import { MyDayView } from '@/components/my-day/my-day-view'

/**
 * "Mi día" — the landing page. Every role has one: what do I have to do today?
 *
 * No permission gate on purpose: this is each person's own work, so there is
 * nothing to authorize. The rows only ever contain videos they own (or, when
 * they own none, the team's unclaimed work).
 */
export const dynamic = 'force-dynamic'

export default async function MiDiaPage() {
  const day = await getMyDay()
  if (!day) redirect('/login')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user!.id)
    .maybeSingle()

  const firstName = profile?.full_name?.trim().split(/\s+/)[0] ?? null

  return <MyDayView day={day} firstName={firstName} />
}
