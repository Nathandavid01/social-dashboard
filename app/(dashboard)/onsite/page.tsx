import Link from 'next/link'
import { requirePermission, currentUserHas, getEffectiveUserId } from '@/lib/auth/server'
import { getOnsiteSessions, getOnsiteShots, getAddableIdeas } from '@/lib/actions/onsite'
import { pickOnsiteSession } from '@/lib/onsite/slot-count'
import { OnsiteStudio } from '@/components/onsite/onsite-studio'
import { SupervisorProcessSteps } from '@/components/onsite/supervisor-process-steps'
import { Camera, CalendarClock } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * On Site — call sheet del día. El videógrafo ve qué grabar y sube;
 * producción (admin) arma y edita el brief.
 */
export default async function OnsitePage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>
}) {
  await requirePermission('recording.read')

  const { s: sessionId } = await searchParams
  const [{ sessions, error }, canBrief, canRecord, canUpload, currentUserId] = await Promise.all([
    getOnsiteSessions(),
    currentUserHas('recording.brief'),
    currentUserHas('recording.complete'),
    currentUserHas('video.upload'),
    getEffectiveUserId(),
  ])

  if (error) {
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {error}
      </p>
    )
  }

  const lista = sessions ?? []
  const today = new Date().toISOString().slice(0, 10)
  const activa = pickOnsiteSession(lista, sessionId, today)

  const [{ shots }, { ideas }] = activa
    ? await Promise.all([getOnsiteShots(activa.id), getAddableIdeas(activa.id)])
    : [{ shots: [] }, { ideas: [] }]

  return (
    <div className="space-y-4">
      {canBrief && <SupervisorProcessSteps pathname="/onsite" />}
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-amber-600 text-[15px] font-bold tabular-nums text-black">
            {canBrief ? '1' : <Camera className="h-4 w-4" aria-hidden="true" />}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold tracking-tight">
              {canBrief ? 'Paso 1 · On Site' : 'On Site'}
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              {canBrief
                ? 'Llegada, call sheet y subida. Después, los editores.'
                : 'Llegas, ves qué grabar, subes con el nombre de la idea.'}
            </p>
          </div>
        </div>
        <Link
          href="/recording-calendar"
          className="shrink-0 whitespace-nowrap rounded-lg border px-3 py-1.5 text-[12px] transition hover:bg-muted"
        >
          Calendario de grabación
        </Link>
      </header>

      {lista.length === 0 || !activa ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border bg-card px-4 py-12 text-center">
          <CalendarClock className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium">No hay sesiones agendadas</p>
          <p className="text-xs text-muted-foreground">
            On Site trabaja sobre el calendario: agenda una sesión y aparecerá aquí.
          </p>
        </div>
      ) : (
        <OnsiteStudio
          sessions={lista}
          active={activa}
          shots={shots ?? []}
          addable={ideas ?? []}
          canBrief={canBrief}
          canRecord={canRecord}
          canUpload={canUpload}
          today={today}
          currentUserId={currentUserId}
        />
      )}
    </div>
  )
}
