'use client'

import { useMemo, useState } from 'react'
import { MousePointerClick, Navigation, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { UI_EVENT_TZ } from '@/lib/utils/ui-events-core'
import type { UiEventLogEntry } from '@/lib/actions/ui-events'

interface Props {
  events: UiEventLogEntry[]
  members: { id: string; full_name: string | null }[]
  defaultUserId: string | null
  day: string
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('es-PR', {
    timeZone: UI_EVENT_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

/** Clicks and route changes for one day. Owner-only. Defaults to one person. */
export function SessionFeed({ events, members, defaultUserId, day }: Props) {
  const [userFilter, setUserFilter] = useState<string | null>(defaultUserId)

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of events) m.set(a.user_id, (m.get(a.user_id) ?? 0) + 1)
    return m
  }, [events])

  const people = useMemo(() => {
    const known = new Map(members.map((p) => [p.id, p]))
    const ids = new Set<string>(members.map((p) => p.id))
    counts.forEach((_n, id) => ids.add(id))
    if (defaultUserId) ids.add(defaultUserId)
    return Array.from(ids)
      .map((id) => known.get(id) ?? { id, full_name: 'Sin nombre' })
      .filter((p) => counts.has(p.id) || p.id === defaultUserId)
      .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))
  }, [members, counts, defaultUserId])

  const shown = useMemo(
    () => (userFilter ? events.filter((a) => a.user_id === userFilter) : events),
    [events, userFilter],
  )

  return (
    <div className="flex flex-col gap-5" data-ui-events-ignore>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold text-foreground md:text-2xl">Sesión</h2>
          <p className="text-sm text-muted-foreground">
            Clicks y páginas de hoy ({day}). Solo owner.
          </p>
        </div>
        <span className="shrink-0 whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
          {shown.length}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setUserFilter(null)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition',
            userFilter === null
              ? 'border-border bg-muted text-foreground'
              : 'border-transparent text-muted-foreground hover:bg-muted/60',
          )}
        >
          <Users className="h-3.5 w-3.5" aria-hidden />
          Todos
          <span className="tabular-nums text-muted-foreground/70">{events.length}</span>
        </button>
        {people.map((p) => (
          <button
            type="button"
            key={p.id}
            onClick={() => setUserFilter(p.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition',
              userFilter === p.id
                ? 'border-border bg-muted text-foreground'
                : 'border-transparent text-muted-foreground hover:bg-muted/60',
            )}
          >
            <span className="grid h-4 w-4 place-items-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
              {(p.full_name ?? '?').slice(0, 1).toUpperCase()}
            </span>
            {p.full_name ?? 'Sin nombre'}
            <span className="tabular-nums text-muted-foreground/70">{counts.get(p.id) ?? 0}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card py-16 text-center text-sm text-muted-foreground">
          Aún no hay clicks ni páginas registradas para este día.
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {shown.map((a) => {
            const person = a.user?.full_name ?? 'Alguien'
            const isNav = a.kind === 'navigate'
            const Icon = isNav ? Navigation : MousePointerClick
            return (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                  {person.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">{person}</span>{' '}
                    {isNav ? 'abrió' : 'hizo click en'}{' '}
                    <span className="font-medium">{a.label}</span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{a.path}</p>
                </div>
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <time className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground/70">
                  {formatTime(a.created_at)}
                </time>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
