import { PersonalTasks } from '@/components/team/personal-tasks'
import { AssignedRecordings } from '@/components/recording/assigned-recordings'
import { getOperationsOverview } from '@/lib/actions/operations-overview'
import { OperationsOverviewView } from '@/components/my-day/operations-overview'
import { RoleGate } from '@/components/auth/role-gate'
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
  const overview = await getOperationsOverview()
  if (overview?.error) return <div role="alert" className="rounded-xl border p-6"><h1 className="text-xl font-semibold">Mi Día · Resumen Sin Verificar</h1><p className="mt-3 text-muted-foreground">{overview.error}</p><a href="/mi-dia" className="mt-4 inline-block text-primary underline">Volver A Intentar</a></div>
  if (overview?.data) return <RoleGate perm="operations.overview"><PersonalTasks /><AssignedRecordings /><OperationsOverviewView data={overview.data} /></RoleGate>
  const result = await getMyDay()
  if (!result) redirect('/login')

  return <><PersonalTasks /><AssignedRecordings /><MyDayView day={result.day} firstName={result.firstName} /></>
}
