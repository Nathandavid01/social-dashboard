import Link from 'next/link'
import { AlertTriangle, CalendarClock, Clapperboard, UserX } from 'lucide-react'
import { clientDisplayName } from '@/lib/utils/client-display-name'
import { formatDateShortES } from '@/lib/utils/deadlines'
import type { HoyGapItem, HoyGapMissing, RecordingHoyGapsResult } from '@/lib/onsite/recording-hoy-gaps'

const MISSING_ES: Record<HoyGapMissing, string> = {
  cliente: 'Cliente',
  videografo: 'Videógrafo',
  hora: 'Hora',
}

function GapCard({
  title,
  note,
  items,
  empty,
  hrefFor,
  icon: Icon,
}: {
  title: string
  note: string
  items: HoyGapItem[]
  empty: string
  hrefFor: (item: HoyGapItem) => string
  icon: typeof AlertTriangle
}) {
  return (
    <section className="min-w-0 rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <Icon className="mb-3 h-5 w-5 text-primary" aria-hidden="true" />
          <p className="text-3xl font-semibold tabular-nums">{items.length}</p>
          <h2 className="mt-1 truncate text-sm font-semibold">{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{note}</p>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.slice(0, 4).map((item) => (
            <li key={item.id}>
              <Link
                href={hrefFor(item)}
                className="block rounded-lg border px-3 py-2 transition hover:bg-muted/50"
              >
                <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="min-w-0 truncate text-sm font-medium">{clientDisplayName(item.title)}</span>
                  <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                    {formatDateShortES(item.date)}
                  </span>
                </span>
                {item.missing && item.missing.length > 0 && (
                  <span className="mt-1 block text-[11px] text-amber-700 dark:text-amber-400">
                    Falta {item.missing.map((m) => MISSING_ES[m]).join(', ')}
                  </span>
                )}
                {item.slotTarget != null && (
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {item.ideaCount ?? 0} / {item.slotTarget} ideas
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {items.length > 4 && (
        <p className="mt-2 text-xs text-muted-foreground">+{items.length - 4} más en el calendario</p>
      )}
    </section>
  )
}

export function RecordingGapCardsView({ gaps }: { gaps: RecordingHoyGapsResult }) {
  if (!gaps.visible) return null
  return (
    <div className="space-y-3">
      {gaps.error && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {gaps.error}
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <GapCard
          title="Sin confirmar"
          note="Falta cliente, videógrafo u hora"
          items={gaps.unconfirmed}
          empty="Todas las próximas tienen ficha completa"
          hrefFor={() => '/recording-calendar'}
          icon={AlertTriangle}
        />
        <GapCard
          title="SIN VIDEO"
          note="Sin videógrafo en los próximos 7 días"
          items={gaps.sinVideo}
          empty="Nadie falta en los próximos 7 días"
          hrefFor={() => '/recording-calendar'}
          icon={UserX}
        />
        <GapCard
          title="Faltan ideas"
          note="Menos ideas que la meta de posting"
          items={gaps.ideasShortfall}
          empty="Sin hueco de ideas en las próximas sesiones"
          hrefFor={(item) => `/onsite?s=${encodeURIComponent(item.id)}`}
          icon={Clapperboard}
        />
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Huecos de grabación · hora de Puerto Rico
      </p>
    </div>
  )
}

