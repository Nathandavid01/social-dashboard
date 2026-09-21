import { PersonalTasks } from '@/components/team/personal-tasks'
import { AssignedRecordings } from '@/components/recording/assigned-recordings'
import { getOperationsOverview } from '@/lib/actions/operations-overview'
import { OperationsOverviewView } from '@/components/my-day/operations-overview'
import { RecordingGapCardsView } from '@/components/my-day/recording-gap-cards'
import { getRecordingHoyGaps } from '@/lib/actions/recording-hoy-gaps'
import { RoleGate } from '@/components/auth/role-gate'
import { redirect } from 'next/navigation'
import { getMyDay } from '@/lib/actions/my-day'
import { MyDayView } from '@/components/my-day/my-day-view'
import { getAssignedRecordings } from '@/lib/actions/assigned-recordings'
import { effectiveConfirmationStatus } from '@/lib/utils/recording-confirmation'

/**
 * "Mi día" — the landing page. Every role has one: what do I have to do today?
 *
 * No permission gate on purpose: this is each person's own work, so there is
 * nothing to authorize. `getMyDay` does the real gating (active + approved
 * account) and refuses to show the unowned team pool to anyone who isn't allowed
 * to see the pipeline.
 *
 * When upcoming grabaciones exist but NONE are Confirmada (both parties),
 * Grabaciones render above PersonalTasks so the urgency callout wins.
 */
export const dynamic = 'force-dynamic'

async function zeroConfirmedUpcoming(): Promise<boolean> {
  const result = await getAssignedRecordings()
  if (!result?.sessions.length) return false
  return result.sessions.every((s) => effectiveConfirmationStatus(s) !== 'confirmed')
}

export default async function MiDiaPage() {
  const overview = await getOperationsOverview()
  if (overview?.error) return <div role="alert" className="rounded-xl border p-6"><h1 className="text-xl font-semibold">Mi Día · Resumen Sin Verificar</h1><p className="mt-3 text-muted-foreground">{overview.error}</p><a href="/mi-dia" className="mt-4 inline-block text-primary underline">Volver A Intentar</a></div>

  const prioritizeRecordings = await zeroConfirmedUpcoming()
  const gapCards = <RecordingGapCardsView gaps={await getRecordingHoyGaps()} />

  if (overview?.data) {
    const body = prioritizeRecordings
      ? <><AssignedRecordings /><PersonalTasks /><OperationsOverviewView data={overview.data} /></>
      : <><PersonalTasks /><AssignedRecordings /><OperationsOverviewView data={overview.data} /></>
    return (
      <div className="space-y-6">
        {gapCards}
        <RoleGate perm="operations.overview">{body}</RoleGate>
      </div>
    )
  }

  const result = await getMyDay()
  if (!result) redirect('/login')

  const day = prioritizeRecordings
    ? <><AssignedRecordings /><PersonalTasks /><MyDayView day={result.day} firstName={result.firstName} /></>
    : <><PersonalTasks /><AssignedRecordings /><MyDayView day={result.day} firstName={result.firstName} /></>
  return (
    <div className="space-y-6">
      {gapCards}
      {day}
    </div>
  )
}
