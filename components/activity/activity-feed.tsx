'use client'

import { useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ACTION_META, FALLBACK_ACTION_ICON, activityVerb } from '@/lib/utils/activity-labels'
import type { ActivityLogEntry } from '@/lib/actions/activity'

interface Props {
  activity: ActivityLogEntry[]
  members: { id: string; full_name: string | null }[]
}

/** Per-person activity log: who did what, when. Filterable by person. */
export function ActivityFeed({ activity, members }: Props) {
  const [userFilter, setUserFilter] = useState<string | null>(null)

  // Counts per person (only people who actually have activity).
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of activity) if (a.user_id) m.set(a.user_id, (m.get(a.user_id) ?? 0) + 1)
    return m
  }, [activity])

  const people = useMemo(
    () =>
      members
        .filter((p) => counts.has(p.id))
        .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0)),
    [members, counts],
  )

  const shown = useMemo(
    () => (userFilter ? activity.filter((a) => a.user_id === userFilter) : activity),
    [activity, userFilter],
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold text-foreground md:text-2xl">Actividad</h1>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
          {shown.length}
        </span>
      </div>
      <p className="-mt-3 text-sm text-muted-foreground">
        Qué hizo cada persona: captions, grabaciones, subidas, publicaciones y cambios de estado.
      </p>

      {/* person filter */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
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
          <span className="tabular-nums text-muted-foreground/70">{activity.length}</span>
        </button>
        {people.map((p) => (
          <button
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
            <span className="tabular-nums text-muted-foreground/70">{counts.get(p.id)}</span>
          </button>
        ))}
      </div>

      {/* feed */}
      {shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card py-16 text-center text-sm text-muted-foreground">
          Aún no hay actividad registrada.
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {shown.map((a) => {
            const meta = ACTION_META[a.action]
            const Icon = meta?.icon ?? FALLBACK_ACTION_ICON
            const person = a.user?.full_name ?? 'Alguien'
            const verb = activityVerb(a.action, a.metadata ?? {})
            const where = [a.idea?.title, a.client?.name].filter(Boolean).join(' · ')
            return (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                  {person.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">{person}</span> {verb}
                  </p>
                  {where && <p className="truncate text-xs text-muted-foreground">{where}</p>}
                </div>
                <Icon className={cn('h-4 w-4 shrink-0', meta?.tone ?? 'text-muted-foreground')} aria-hidden />
                <time className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground/70">
                  {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: es })}
                </time>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
