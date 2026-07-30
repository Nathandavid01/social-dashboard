import Link from 'next/link'
import { requirePermission } from '@/lib/auth/server'
import { getOnsiteSessions, getOnsiteShots, getAddableIdeas } from '@/lib/actions/onsite'
import { OnsiteChecklist } from '@/components/onsite/onsite-checklist'
import { Camera, MapPin, CalendarClock } from 'lucide-react'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * On Site — la lista de grabación de una sesión, para marcar sobre la marcha.
 *
 * Trabaja sobre lo agendado en el calendario de grabación: una sesión sin
 * agendar no es un día de rodaje. Las tomas son content_ideas, así que marcar
 * aquí es lo mismo que grabar en cualquier otra parte de la app.
 */
export default async function OnsitePage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>
}) {
  await requirePermission('recording.read')

  const { s: sessionId } = await searchParams
  const { sessions, error } = await getOnsiteSessions()

  if (error) {
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {error}
      </p>
    )
  }

  const lista = sessions ?? []
  const activa = lista.find((x) => x.id === sessionId) ?? lista[0]

  const [{ shots }, { ideas }] = activa
    ? await Promise.all([getOnsiteShots(activa.id), getAddableIdeas(activa.id)])
    : [{ shots: [] }, { ideas: [] }]

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-amber-600 text-black">
            <Camera className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold tracking-tight">On Site</h1>
            <p className="truncate text-xs text-muted-foreground">
              Marca cada toma mientras grabas. El conteo se actualiza solo.
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

      {lista.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border bg-card px-4 py-12 text-center">
          <CalendarClock className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium">No hay sesiones agendadas</p>
          <p className="text-xs text-muted-foreground">
            On Site trabaja sobre el calendario: agenda una sesión y aparecerá aquí.
          </p>
        </div>
      ) : (
        <>
          {/* Selector de sesión: una fila por sesión agendada. */}
          <nav className="flex gap-2 overflow-x-auto pb-1">
            {lista.map((s) => (
              <Link
                key={s.id}
                href={`/onsite?s=${s.id}`}
                className={cn(
                  'shrink-0 rounded-lg border px-3 py-2 transition',
                  s.id === activa?.id ? 'border-primary bg-primary/10' : 'hover:bg-muted',
                )}
              >
                <span className="block max-w-[220px] truncate text-[12px] font-medium">{s.clientName}</span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  {s.date} · {s.title}
                </span>
              </Link>
            ))}
          </nav>

          {activa && (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border bg-card px-4 py-2.5 text-[12px]">
                <strong className="min-w-0 truncate">{activa.clientName}</strong>
                <span className="text-muted-foreground">{activa.date}</span>
                {activa.location && (
                  <span className="flex min-w-0 items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">{activa.location}</span>
                  </span>
                )}
              </div>

              <OnsiteChecklist
                sessionId={activa.id}
                initialShots={shots ?? []}
                addable={ideas ?? []}
              />
            </>
          )}
        </>
      )}
    </div>
  )
}
