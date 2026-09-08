import Link from 'next/link'
import { CalendarDays } from 'lucide-react'
import { getAssignedRecordings } from '@/lib/actions/assigned-recordings'

export async function AssignedRecordings({ memberId }: { memberId?: string }) {
  const result = await getAssignedRecordings(memberId)
  if (!result) return null
  return <section className="mb-6 rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 sm:p-5">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 font-semibold"><CalendarDays className="h-5 w-5 text-sky-500"/>Grabaciones Asignadas</h2>
      <Link className="text-sm text-sky-600 dark:text-sky-400 underline" href={`/recording-calendar?videographer=${result.memberId}`}>Ver Mi Calendario</Link>
    </div>
    <p className="mb-3 text-xs text-muted-foreground">Próximas 30 sesiones · Hora de Puerto Rico · Consulta aquí tu próxima grabación.</p>
    {result.error ? <p role="alert">{result.error}</p> : !result.sessions.length ? <p className="text-sm text-muted-foreground">No hay grabaciones próximas asignadas.</p> :
      <ul className="grid gap-3 sm:grid-cols-2">{result.sessions.map(s => <li key={s.id} className="min-w-0 rounded-lg border border-sky-500/20 bg-background p-3">
        <Link className="block break-words font-semibold hover:underline" href={`/onsite?s=${s.id}`}>{s.title}</Link>
        <p className="mt-1 text-sm">{new Date(s.session_date+'T12:00:00Z').toLocaleDateString('es-PR',{day:'numeric',month:'short',weekday:'short'})} · {s.start_time?.slice(0,5) || 'Hora Por Confirmar'}</p>
        <p className="mt-1 break-words text-xs text-muted-foreground">{s.location || s.location_address || 'Lugar Por Confirmar'}</p>
        <Link className="mt-3 inline-block text-xs font-medium text-sky-600 dark:text-sky-400" href={`/onsite?s=${s.id}`}>Ver Ideas Y Preparar Grabación →</Link>
      </li>)}</ul>}
  </section>
}
