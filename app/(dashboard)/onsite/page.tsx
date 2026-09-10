import Link from 'next/link'
import { ClientProposalPanel } from '@/components/ideas/client-proposal-panel'
import { todayISOInTimeZone } from '@/lib/utils/deadlines'
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
  const [{ sessions, error }, canBrief, canAddIdeas, canRecord, canUpload, currentUserId, canShare] = await Promise.all([
    getOnsiteSessions(),
    currentUserHas('recording.brief'),
    currentUserHas('recording.create'),
    currentUserHas('recording.complete'),
    currentUserHas('video.upload'),
    getEffectiveUserId(),
    currentUserHas('ideas.share'),
  ])

  if (error) {
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {error}
      </p>
    )
  }

  const lista = sessions ?? []
  const today = todayISOInTimeZone('America/Puerto_Rico')
  const activa = pickOnsiteSession(lista, sessionId, today)

  const [shotResult, ideaResult] = activa
    ? await Promise.all([getOnsiteShots(activa.id), getAddableIdeas(activa.id)])
    : [{ shots: [], error: undefined }, { ideas: [], error: undefined }]
  const loadError = shotResult.error || ideaResult.error
  const shots = shotResult.shots
  const ideas = ideaResult.ideas

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
      ) : loadError ? (
        <section role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <h2 className="font-semibold">No Se Pudo Cargar La Sesión Completa</h2>
          <p className="mt-2 text-sm">No se pudieron consultar las tomas o las ideas. Esto no significa que la sesión esté vacía.</p>
          <a href={`/onsite?s=${encodeURIComponent(activa.id)}`} className="mt-4 inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium">Volver A Cargar La Sesión</a>
        </section>
      ) : (
        <>
        <OnsiteStudio
          sessions={lista}
          active={activa}
          shots={shots ?? []}
          addable={(ideas ?? []).filter(idea => !(shots ?? []).some(shot => shot.id === idea.id))}
          canBrief={canBrief}
          canAddIdeas={canAddIdeas}
          canRecord={canRecord}
          canUpload={canUpload}
          today={today}
          currentUserId={currentUserId}
        />
        {canShare && <ClientProposalPanel key={activa.id} sessionId={activa.id} />}
        </>
      )}
    </div>
  )
}
