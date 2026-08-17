'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import {
  formatDuration,
  jornadaProgress,
  JORNADA_TARGET_SECONDS,
} from '@/lib/utils/presence-core'
import type { RankedMember } from '@/lib/utils/presence-core'
import type { TeamTimeBoard } from '@/lib/actions/presence'

function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

/** Arco de 270° tipo reloj de estudio — no es un anillo de fitness. */
function JornadaDial({ seconds, label }: { seconds: number; label: string }) {
  const progress = jornadaProgress(seconds)
  const r = 54
  const c = 2 * Math.PI * r
  const arc = c * 0.75
  const dash = arc * progress
  return (
    <div className="relative grid h-[168px] w-[168px] place-items-center">
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-[225deg]" aria-hidden>
        <circle
          cx="70" cy="70" r={r} fill="none" stroke="currentColor"
          className="text-white/10" strokeWidth="8"
          strokeDasharray={`${arc} ${c}`} strokeLinecap="round"
        />
        <circle
          cx="70" cy="70" r={r} fill="none" stroke="currentColor"
          className="text-primary transition-[stroke-dasharray] duration-700"
          strokeWidth="8"
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
        <p className="font-mono text-3xl font-semibold tabular-nums tracking-tight text-foreground">
          {formatDuration(seconds)}
        </p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
      </div>
    </div>
  )
}

function MemberRow({ m, mine }: { m: RankedMember; mine: boolean }) {
  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-2.5 transition',
        mine && 'bg-primary/10 ring-1 ring-primary/30',
        m.rank === 1 && !mine && 'bg-white/[0.03]',
      )}
    >
      <span
        className={cn(
          'w-6 shrink-0 text-center font-mono text-xs tabular-nums',
          m.rank === 1 ? 'font-semibold text-primary' : 'text-muted-foreground',
        )}
      >
        {m.rank}
      </span>
      <Avatar className="h-8 w-8 shrink-0">
        {m.avatar_url ? <AvatarImage src={m.avatar_url} alt={m.full_name ?? ''} /> : null}
        <AvatarFallback className="text-[10px] font-semibold">{initials(m.full_name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {m.full_name ?? 'Sin nombre'}
          {mine ? <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">tú</span> : null}
        </p>
        <p className="text-[11px] text-muted-foreground">
          hoy {formatDuration(m.today_seconds)}
          {m.streak_days > 1 ? ` · racha ${m.streak_days}d` : ''}
        </p>
      </div>
      {m.live ? (
        <span className="shrink-0 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-primary">
          <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-primary motion-safe:animate-pulse" aria-hidden />
          En estudio
        </span>
      ) : (
        <span className="shrink-0 font-mono text-sm tabular-nums text-foreground">
          {formatDuration(m.week_seconds)}
        </span>
      )}
    </li>
  )
}

/**
 * Tablero de jornada del estudio. Oro de Nate Media, tipografía mono para
 * el tiempo, ranking de la semana. El dial es el de HOY de quien mira.
 */
export function JornadaBoard({
  board,
  currentUserId,
}: {
  board: TeamTimeBoard
  currentUserId: string | null
}) {
  const me = board.members.find((m) => m.user_id === currentUserId) ?? board.members[0] ?? null
  const longest = board.members.reduce<RankedMember | null>(
    (best, m) => (!best || m.streak_days > best.streak_days ? m : best),
    null,
  )

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">Jornada</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-foreground md:text-2xl">
            El estudio esta semana
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tiempo real en el dashboard. Si dejas la pestaña, deja de contar.
          </p>
        </div>
        <p className="shrink-0 font-mono text-3xl font-semibold tabular-nums tracking-tight text-foreground md:text-4xl">
          {formatDuration(board.team_week_seconds)}
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <section className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card px-4 py-5">
          {me ? (
            <>
              <JornadaDial seconds={me.today_seconds} label="hoy" />
              <p className="mt-1 text-center text-sm font-medium text-foreground">
                {me.user_id === currentUserId ? 'Tu jornada' : (me.full_name ?? 'Líder')}
              </p>
              <p className="text-[11px] text-muted-foreground">
                meta {formatDuration(JORNADA_TARGET_SECONDS)} · semana {formatDuration(me.week_seconds)}
              </p>
            </>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">Aún no hay jornada.</p>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-2 sm:p-3">
          <div className="mb-2 flex items-center justify-between px-2 pt-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Ranking de la semana
            </p>
            <p className="text-[11px] text-muted-foreground">
              {board.live_count === 1 ? '1 en estudio' : `${board.live_count} en estudio`}
              {longest && longest.streak_days > 1
                ? ` · racha ${longest.full_name?.split(' ')[0] ?? ''} ${longest.streak_days}d`
                : ''}
            </p>
          </div>
          {board.members.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-muted-foreground">
              Cuando el equipo entre, aquí se ve quién estuvo en el dashboard.
            </p>
          ) : (
            <ol className="flex flex-col gap-0.5">
              {board.members.map((m) => (
                <MemberRow key={m.user_id} m={m} mine={m.user_id === currentUserId} />
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}
