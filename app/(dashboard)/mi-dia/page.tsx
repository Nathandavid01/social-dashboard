import { redirect } from 'next/navigation'
import { getMyDay } from '@/lib/actions/my-day'
import { MyDayView } from '@/components/my-day/my-day-view'

/**
 * "Mi día" — the landing page. Every role has one: what do I have to do today?
 *
 * No permission gate on purpose: this is each person's own work, so there is
 * nothing to authorize. `getMyDay` does the real gating (active + approved
 * account) and refuses to show the unowned team pool to anyone who isn't allowed
 * to see the pipeline.
 */
export const dynamic = 'force-dynamic'

export default async function MiDiaPage() {
  const result = await getMyDay()
  if (!result) redirect('/login')

  return <MyDayView day={result.day} firstName={result.firstName} />
}
