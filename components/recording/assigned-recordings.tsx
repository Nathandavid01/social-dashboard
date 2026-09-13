import Link from 'next/link'
import { AlertTriangle, CalendarDays } from 'lucide-react'
import { getAssignedRecordings } from '@/lib/actions/assigned-recordings'
import { Badge } from '@/components/ui/badge'
import {
  confirmationChip,
  confirmationStatusLabel,
  effectiveConfirmationStatus,
  type RecordingConfirmationChip,
} from '@/lib/utils/recording-confirmation'
import { cn } from '@/lib/utils'
import type { RecordingSession } from '@/lib/supabase/types'

const confirmationChipClass: Record<RecordingConfirmationChip, string> = {
  confirmed: 'text-emerald-600 border-emerald-500/30 bg-emerald-500/10',
  missing_videographer: 'text-amber-700 border-amber-500/40 bg-amber-500/10',
  missing_client: 'text-amber-700 border-amber-500/40 bg-amber-500/10',
  unconfirmed: 'text-amber-700 border-amber-500/40 bg-amber-500/10',
}

function sortSessionsForPriority(sessions: RecordingSession[]): RecordingSession[] {
  // Sin confirmar / missing side(s) first; Confirmada last. Stable by date/time otherwise.
  return [...sessions].sort((a, b) => {
    const aOk = effectiveConfirmationStatus(a) === 'confirmed' ? 1 : 0
    const bOk = effectiveConfirmationStatus(b) === 'confirmed' ? 1 : 0
    return aOk - bOk
  })
}

export async function AssignedRecordings({ memberId }: { memberId?: string }) {
  const result = await getAssignedRecordings(memberId)
  if (!result) return null
  const { overview } = result
  const calendarHref = overview
    ? '/recording-calendar'
    : `/recording-calendar?videographer=${result.memberId}`

  const sessions = sortSessionsForPriority(result.sessions)
  const confirmedCount = sessions.filter(
    (s) => effectiveConfirmationStatus(s) === 'confirmed',
  ).length
  const zeroConfirmedUrgent = sessions.length > 0 && confirmedCount === 0

  return (
    <section
      className={cn(
        'mb-6 rounded-xl border p-4 sm:p-5',
        zeroConfirmedUrgent
          ? 'border-amber-600/50 bg-amber-500/10 ring-1 ring-amber-500/30'
          : 'border-sky-500/30 bg-sky-500/5',
      )}
    >
      {zeroConfirmedUrgent && (
        <div
          role="alert"
          className="mb-4 flex flex-col gap-2 rounded-lg border border-amber-600/60 bg-amber-500/20 px-3 py-3 text-amber-950 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 items-start gap-2">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
            <div className="min-w-0">
              <p className="font-semibold leading-snug">
                Ninguna grabación confirmada — prioriza confirmar cliente + videógrafo + hora
              </p>
              <p className="mt-1 text-xs opacity-90">
                Confirmada solo cuando cliente y videógrafo confirman ambos. Hay {sessions.length}{' '}
                próxima{sessions.length === 1 ? '' : 's'} sin Confirmada.
              </p>
            </div>
          </div>
          <Link
            className="shrink-0 rounded-md bg-amber-700 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-amber-800"
            href={calendarHref}
          >
            Ir al calendario
          </Link>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <CalendarDays
            className={cn('h-5 w-5', zeroConfirmedUrgent ? 'text-amber-600' : 'text-sky-500')}
          />
          {overview ? 'Grabaciones (overview)' : 'Grabaciones Asignadas'}
        </h2>
        <Link
          className={cn(
            'text-sm underline',
            zeroConfirmedUrgent
              ? 'text-amber-800 dark:text-amber-300'
              : 'text-sky-600 dark:text-sky-400',
          )}
          href={calendarHref}
        >
          {overview ? 'Ver calendario' : 'Ver Mi Calendario'}
        </Link>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        {overview
          ? 'Todas las próximas · Hora de Puerto Rico · Confirmada solo si cliente y videógrafo confirmaron.'
          : 'Próximas 30 sesiones · Hora de Puerto Rico · Confirmada = cliente + videógrafo confirmaron.'}
      </p>
      {result.error ? (
        <p role="alert">{result.error}</p>
      ) : !sessions.length ? (
        <p className="text-sm text-muted-foreground">
          {overview ? 'No hay grabaciones próximas.' : 'No hay grabaciones próximas asignadas.'}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {sessions.map((s) => {
            const chip = confirmationChip(s)
            const label = confirmationStatusLabel(chip)
            const videographerName = s.videographer?.full_name
            return (
              <li
                key={s.id}
                className={cn(
                  'min-w-0 rounded-lg border bg-background p-3',
                  chip === 'confirmed' ? 'border-sky-500/20' : 'border-amber-500/25',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <Link
                    className="block min-w-0 flex-1 break-words font-semibold hover:underline"
                    href={`/onsite?s=${s.id}`}
                  >
                    {s.title}
                  </Link>
                  <Badge
                    variant="outline"
                    className={cn('shrink-0 text-[10px]', confirmationChipClass[chip])}
                    aria-label={`Grabación ${label}`}
                  >
                    {label}
                  </Badge>
                </div>
                <p className="mt-1 text-sm">
                  {new Date(s.session_date + 'T12:00:00Z').toLocaleDateString('es-PR', {
                    day: 'numeric',
                    month: 'short',
                    weekday: 'short',
                  })}{' '}
                  · {s.start_time?.slice(0, 5) || 'Hora Por Confirmar'}
                </p>
                {overview && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Videógrafo: {videographerName || 'Sin asignar'}
                  </p>
                )}
                <p className="mt-1 break-words text-xs text-muted-foreground">
                  {s.location || s.location_address || 'Lugar Por Confirmar'}
                </p>
                <Link
                  className="mt-3 inline-block text-xs font-medium text-sky-600 dark:text-sky-400"
                  href={`/onsite?s=${s.id}`}
                >
                  Ver Ideas Y Preparar Grabación →
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
