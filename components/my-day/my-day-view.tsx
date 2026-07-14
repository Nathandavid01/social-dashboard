import Link from 'next/link'
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, Hourglass, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { formatDateShortES } from '@/lib/utils/deadlines'
import {
  myDayHeadline,
  myDayCapacityNote,
  KIND_LABEL_ES,
  type MyDay,
  type MyDayItem,
  type MyDayKind,
} from '@/lib/utils/my-day-core'
import type { NextStepTone } from '@/lib/utils/batch-view'

const TONE: Record<NextStepTone, string> = {
  done: 'text-green-600 dark:text-green-400',
  action: 'text-primary',
  waiting: 'text-muted-foreground',
  warn: 'text-amber-600 dark:text-amber-400',
}

/** The kind of work, so a shoot never reads like an edit. */
const KIND_STYLE: Record<MyDayKind, string> = {
  grabar: 'border-cyan-500/50 text-cyan-700 dark:text-cyan-400',
  editar: 'border-violet-500/50 text-violet-700 dark:text-violet-400',
  aprobar: 'border-amber-500/50 text-amber-700 dark:text-amber-400',
  publicar: 'border-green-500/50 text-green-700 dark:text-green-400',
  esperar: 'border-muted text-muted-foreground',
}

/** One video, one line: what it is, for whom, when it's due, and what to do. */
function VideoRow({ item, showDate = true }: { item: MyDayItem; showDate?: boolean }) {
  const v = item.video
  const client = (v as { client?: { name?: string | null } | null }).client?.name
  return (
    <li>
      <Link
        href={`/produccion/idea/${v.id}`}
        className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border px-3 py-2.5 transition hover:bg-muted/50"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{v.title || 'Sin título'}</p>
          <p className={`truncate text-xs ${TONE[item.nextStep.tone]}`}>{item.nextStep.label}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
          {client && <span className="text-xs text-muted-foreground">{client}</span>}
          <Badge variant="outline" className={`text-xs font-normal ${KIND_STYLE[item.kind]}`}>
            {KIND_LABEL_ES[item.kind]}
          </Badge>
          {showDate && item.dueDate && (
            <Badge variant="outline" className="text-xs font-normal">
              {formatDateShortES(item.dueDate)}
            </Badge>
          )}
        </div>
      </Link>
    </li>
  )
}

function Section({
  icon: Icon,
  title,
  items,
  tone = '',
  showDate = true,
}: {
  icon: typeof Clock
  title: string
  items: MyDayItem[]
  tone?: string
  showDate?: boolean
}) {
  if (items.length === 0) return null
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold">
        <Icon className={`h-4 w-4 shrink-0 ${tone}`} />
        <span>{title}</span>
        <span className="text-muted-foreground font-normal">({items.length})</span>
      </h2>
      <ul className="space-y-1.5">
        {items.map((i) => (
          <VideoRow key={i.video.id} item={i} showDate={showDate} />
        ))}
      </ul>
    </section>
  )
}

/**
 * "Mi día" — the screen a teammate opens to know what they have to do today.
 *
 * The load number is the headline because it's the question the team was going
 * to ClickUp to answer. Everything below it is ordered by urgency, and each row
 * says the ONE next action (from `videoNextStep`) so nobody has to open a video
 * to find out what's missing.
 */
export function MyDayView({ day, firstName }: { day: MyDay; firstName?: string | null }) {
  const { load, scope } = day
  const capacityNote = myDayCapacityNote(load)
  const isTeam = scope === 'equipo'

  const nothingAtAll =
    load.count === 0 && day.proximos.length === 0 && day.esperando.length === 0

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <p className="text-sm text-muted-foreground">
          {firstName ? `Hola, ${firstName}` : 'Hola'}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-balance">
            {myDayHeadline(load, day.restricted ? 'mio' : scope)}
          </h1>
          {load.over && (
            <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="mr-1 h-3 w-3" /> Sobre tu tope
            </Badge>
          )}
        </div>
        {capacityNote && (
          <p className={`text-sm ${load.over ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
            {capacityNote}
          </p>
        )}
        {/* Never let unassigned work read as "yours". */}
        {isTeam && !day.restricted && !nothingAtAll && (
          <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <Users className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              No tienes videos asignados, así que estás viendo el{' '}
              <strong className="font-medium text-foreground">trabajo libre del equipo</strong> —
              videos que nadie ha tomado todavía.
            </span>
          </p>
        )}
      </header>

      {nothingAtAll ? (
        <EmptyState
          icon={CheckCircle2}
          title={
            day.restricted
              ? 'No tienes videos asignados'
              : isTeam
                ? 'No hay trabajo libre'
                : 'Estás al día'
          }
          description={
            day.restricted
              ? 'Cuando alguien te asigne un cliente o un video, aparecerá aquí. No tienes acceso al trabajo del equipo.'
              : isTeam
                ? 'Todos los videos activos ya tienen dueño. Mira el tablero si quieres ver el panorama.'
                : 'No tienes videos pendientes. Buen trabajo.'
          }
          action={
            <Link
              href="/pipeline"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Ver el tablero
            </Link>
          }
        />
      ) : (
        <div className="space-y-6">
          <Section
            icon={AlertTriangle}
            title="Atrasados"
            items={day.atrasados}
            tone="text-red-600 dark:text-red-400"
          />
          <Section icon={Clock} title="Para hoy" items={day.hoy} tone="text-primary" />
          <Section
            icon={CalendarClock}
            title="Próximos"
            items={day.proximos}
            tone="text-muted-foreground"
          />
          {/* Not my load: it's with the client or in review. Shown so nothing is
              invisible, but visibly separate from what I have to do. */}
          <Section
            icon={Hourglass}
            title="Esperando a otros"
            items={day.esperando}
            tone="text-muted-foreground"
            showDate={false}
          />
        </div>
      )}
    </div>
  )
}
