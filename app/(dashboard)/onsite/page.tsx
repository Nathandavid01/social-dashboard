import Link from 'next/link'
import { ClientProposalPanel } from '@/components/ideas/client-proposal-panel'
import { todayISOInTimeZone } from '@/lib/utils/deadlines'
import { requirePermission, currentUserHas, getEffectiveUserId } from '@/lib/auth/server'
import { getOnsiteSessions, getOnsiteShots, getAddableIdeas } from '@/lib/actions/onsite'
import { listOnsiteRawVideos } from '@/lib/actions/onsite-upload-context'
import { buildOnsiteUploadContext, withRawCount } from '@/lib/onsite/upload-context'
import { getClients } from '@/lib/actions/clients'
import { listClientBankAssets } from '@/lib/actions/client-asset-bank'
import { pickOnsiteSession } from '@/lib/onsite/slot-count'
import { OnsiteStudio } from '@/components/onsite/onsite-studio'
import { SubirCrudoPanel } from '@/components/onsite/subir-crudo-panel'
import { SupervisorProcessSteps } from '@/components/onsite/supervisor-process-steps'
import { Camera } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * On Site — puerta de subida del crudo. El videógrafo sube primero;
 * el call sheet, la llegada y el brief quedan abajo.
 */
export default async function OnsitePage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>
}) {
  await requirePermission('recording.read')

  const { s: sessionId } = await searchParams
  const [{ sessions, error }, canBrief, canAddIdeas, canRecord, canUpload, canUploadBank, currentUserId, canExportIdeas, clientsRaw] = await Promise.all([
    getOnsiteSessions(),
    currentUserHas('recording.brief'),
    currentUserHas('recording.create'),
    currentUserHas('recording.complete'),
    currentUserHas('video.upload'),
    currentUserHas('clients.assets.upload'),
    getEffectiveUserId(),
    // Export / propuesta PDF: ideas.read (supervisor, editor, video, copy…).
    // ideas.share era owner/supervisor-only y bloqueaba a quien sí puede leer ideas.
    currentUserHas('ideas.read'),
    getClients({ status: 'active' }).catch(() => []),
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

  const [shotResult, ideaResult, bankResult] = activa
    ? await Promise.all([
        getOnsiteShots(activa.id),
        getAddableIdeas(activa.id),
        activa.clientId ? listClientBankAssets(activa.clientId) : Promise.resolve({ assets: [] }),
      ])
    : [{ shots: [], error: undefined }, { ideas: [], error: undefined }, { assets: [] }]
  // Solo las tomas bloquean la sesión. Fallar al listar ideas añadibles no
  // debe dejar a la crew en «Volver A Cargar» con el call sheet vacío.
  const loadError = shotResult.error
  const rawResult = activa && !shotResult.error && (shotResult.shots?.length ?? 0) > 0
    ? await listOnsiteRawVideos(shotResult.shots!.map((s) => s.id))
    : { videos: [] as Awaited<ReturnType<typeof listOnsiteRawVideos>>['videos'] }
  const uploadContext = activa && !shotResult.error
    ? buildOnsiteUploadContext({
      sessionId: activa.id,
      clientName: activa.clientName ?? 'Sin cliente',
      sessionTitle: activa.title ?? '',
      sessionDate: activa.date ?? '',
      shots: shotResult.shots ?? [],
      videos: rawResult.videos ?? [],
    })
    : null
  const shots = uploadContext && shotResult.shots
    ? withRawCount(shotResult.shots, uploadContext.ideas)
    : shotResult.shots
  const ideas = ideaResult.error ? [] : ideaResult.ideas
  const clients = (Array.isArray(clientsRaw) ? clientsRaw : [])
    .map((c) => ({ id: String((c as { id?: string }).id ?? ''), name: String((c as { name?: string }).name ?? '') }))
    .filter((c) => c.id && c.name)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const todaySession = activa?.date === today ? activa : undefined

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
                ? 'Sube el crudo primero. Call sheet y llegada quedan abajo.'
                : 'Sube el crudo. El call sheet queda abajo.'}
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

      <SubirCrudoPanel
        clients={clients}
        sessions={lista}
        today={today}
        canUpload={canUpload}
        canCreateSession={canAddIdeas}
        defaultClientId={activa?.clientId ?? null}
        defaultSessionId={todaySession?.id ?? null}
        existingIdeaId={todaySession ? (shots?.[0]?.id ?? null) : null}
        uploadContext={uploadContext}
      />

      {loadError && activa ? (
        <section role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <h2 className="font-semibold">No Se Pudo Cargar La Sesión Completa</h2>
          <p className="mt-2 text-sm">No se pudieron consultar las tomas de esta sesión. Esto no significa que la sesión esté vacía.</p>
          <a href={`/onsite?s=${encodeURIComponent(activa.id)}`} className="mt-4 inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium">Volver A Cargar La Sesión</a>
        </section>
      ) : activa ? (
        <details className="rounded-2xl border bg-card">
          <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-medium">
            Call sheet y preparación
          </summary>
          <div className="space-y-4 border-t p-3 sm:p-4">
            <OnsiteStudio
              sessions={lista}
              active={activa}
              shots={shots ?? []}
              addable={(ideas ?? []).filter(idea => !(shots ?? []).some(shot => shot.id === idea.id))}
              canBrief={canBrief}
              canAddIdeas={canAddIdeas}
              canRecord={canRecord}
              canUpload={canUpload}
              canUploadBank={canUploadBank}
              bankAssets={bankResult.assets ?? []}
              today={today}
              currentUserId={currentUserId}
            />
            {canExportIdeas && <ClientProposalPanel key={activa.id} sessionId={activa.id} />}
          </div>
        </details>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          No hay sesiones agendadas. Al subir se crea la de hoy, o ábrela en el calendario.
        </p>
      )}
    </div>
  )
}
