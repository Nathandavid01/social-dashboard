'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Target, Radio, Clock, AlertTriangle, ChevronDown, CalendarOff, CheckCircle2, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  percent,
  type CadenciaData,
  type CadenciaStatus,
  type CadenciaClientRow,
  type RingStats,
} from '@/lib/utils/cadencia'
import type { SocialPlatform } from '@/lib/supabase/types'

const PLATFORM_ABBR: Record<SocialPlatform, string> = {
  instagram: 'IG',
  facebook: 'FB',
  tiktok: 'TT',
  linkedin: 'LI',
}

// Deterministic avatar tint per client (no semantic meaning, just identity).
const AVATAR_TINTS = [
  'bg-emerald-500/20 text-emerald-400',
  'bg-sky-500/20 text-sky-400',
  'bg-amber-500/20 text-amber-400',
  'bg-violet-500/20 text-violet-400',
  'bg-rose-500/20 text-rose-400',
  'bg-cyan-500/20 text-cyan-400',
]
function tintFor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_TINTS[h % AVATAR_TINTS.length]
}

const plural = (n: number, sing: string, plu: string) => `${n} ${n === 1 ? sing : plu}`

/** SVG donut ring. Arc = published / planned, drawn in gold. */
function Ring({ label, stats }: { label: string; stats: RingStats }) {
  const r = 42
  const c = 2 * Math.PI * r
  const pct = stats.planned > 0 ? stats.published / stats.planned : 0
  const offset = c * (1 - pct)
  return (
    <div className="flex flex-1 flex-col items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">{label}</span>
      <div className="relative h-[108px] w-[108px]">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" strokeWidth="10" className="stroke-muted" />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            stroke="hsl(var(--primary))"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold tabular-nums text-foreground">
            {stats.published}/{stats.planned}
          </span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground">publicados</span>
    </div>
  )
}

function TodaySub({ stats }: { stats: RingStats }) {
  if (stats.planned === 0) return <span className="text-xs text-muted-foreground">Sin posts hoy</span>
  if (stats.pending === 0 && stats.overdue === 0)
    return <span className="text-xs font-medium text-green-500">Todo publicado ✓</span>
  return (
    <span className="text-xs">
      {stats.pending > 0 && <span className="text-amber-500">{plural(stats.pending, 'pendiente', 'pendientes')}</span>}
      {stats.pending > 0 && stats.overdue > 0 && <span className="text-muted-foreground"> · </span>}
      {stats.overdue > 0 && <span className="text-red-500">{plural(stats.overdue, 'atrasado', 'atrasados')}</span>}
    </span>
  )
}

/** Small status dot for a single planned post. */
function Dot({ status }: { status: CadenciaStatus }) {
  return (
    <span
      aria-hidden
      className={cn(
        'h-2 w-2 rounded-full',
        status === 'publicado' && 'bg-green-500',
        status === 'atrasado' && 'bg-red-500',
        status === 'pendiente' && 'border border-muted-foreground/50',
      )}
    />
  )
}

function ClientRow({ row }: { row: CadenciaClientRow }) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/40">
      <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold', tintFor(row.clientId))}>
        {row.clientName.slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{row.clientName}</span>
      <span className="flex shrink-0 items-center gap-1">
        {row.dots.map((s, i) => (
          <Dot key={i} status={s} />
        ))}
      </span>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {row.published}/{row.planned}
      </span>
      <span className="flex w-[92px] shrink-0 justify-end">
        {row.failedCount > 0 ? (
          <span title="Metricool reportó un fallo al publicar" className="flex items-center gap-1 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-500">
            <AlertTriangle className="h-3 w-3" /> falló
          </span>
        ) : row.liveUrls.length > 0 ? (
          <a
            href={row.liveUrls[0]}
            target="_blank"
            rel="noopener noreferrer"
            title="Confirmado en vivo — ver publicación"
            className="flex items-center gap-1 rounded-full bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium text-green-600 hover:bg-green-500/20"
          >
            <CheckCircle2 className="h-3 w-3" /> en vivo <ExternalLink className="h-2.5 w-2.5" />
          </a>
        ) : row.hasOverdue ? (
          <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-500">
            <AlertTriangle className="h-3 w-3" /> atrasado
          </span>
        ) : row.published === row.planned ? (
          <span className="text-xs text-green-500">✓</span>
        ) : row.postingTime ? (
          <span className="flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
            <Clock className="h-3 w-3" /> {row.postingTime}
          </span>
        ) : null}
      </span>
      <span className="hidden w-[52px] shrink-0 justify-end gap-1 sm:flex">
        {row.platforms.map((p) => (
          <span key={p} className="text-[10px] font-medium tracking-wide text-muted-foreground">
            {PLATFORM_ABBR[p]}
          </span>
        ))}
      </span>
    </div>
  )
}

export function CadenciaCard({ data }: { data: CadenciaData }) {
  const router = useRouter()
  const [live, setLive] = useState(false)
  const [selectedDay, setSelectedDay] = useState(data.todayDate)

  // Cadence reality lives in Metricool, not the local DB — there's no postgres
  // change to subscribe to. Poll the server action so the rings catch up as
  // Metricool publishes/confirms posts. The "en vivo" pill reflects this poll.
  useEffect(() => {
    setLive(true)
    const poll = setInterval(() => router.refresh(), 5 * 60 * 1000)
    return () => {
      setLive(false)
      clearInterval(poll)
    }
  }, [router])

  const selected = useMemo(() => data.days.find((d) => d.date === selectedDay) ?? null, [data.days, selectedDay])
  const rows = data.byDay[selectedDay] ?? []
  const weekPct = percent(data.week.published, data.week.planned)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <CardTitle className="flex min-w-0 items-center gap-2 text-base">
            <Target className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">Cadencia</span>
          </CardTitle>
          <span
            className={cn(
              'flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-medium',
              live ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground',
            )}
          >
            <Radio className={cn('h-3 w-3', live && 'animate-pulse')} /> en vivo
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Overview — two rings */}
        <div className="flex items-start justify-center gap-8">
          <div className="flex flex-col items-center gap-1">
            <Ring label="HOY" stats={data.today} />
            <TodaySub stats={data.today} />
          </div>
          <div className="flex flex-col items-center gap-1">
            <Ring label="ESTA SEMANA" stats={data.week} />
            <span className="text-xs text-muted-foreground">{weekPct}% completado</span>
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Day selector */}
        <div className="space-y-1.5">
          <div className="flex items-stretch gap-1.5 overflow-x-auto pb-1">
            {data.days.map((day) => {
              const isSel = day.date === selectedDay
              const dotClass = day.planned === 0
                ? 'bg-transparent'
                : day.hasOverdue
                  ? 'bg-red-500'
                  : day.published === day.planned
                    ? 'bg-green-500'
                    : 'bg-amber-500'
              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDay(day.date)}
                  className={cn(
                    'flex flex-1 min-w-[44px] flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium transition-colors',
                    isSel
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted/50',
                    !isSel && day.isToday && 'ring-1 ring-primary/60',
                  )}
                >
                  <span>{day.shortLabel}</span>
                  <span className={cn('h-1.5 w-1.5 rounded-full', isSel ? 'bg-primary-foreground/70' : dotClass)} />
                </button>
              )
            })}
          </div>
          <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
            elige un día <ChevronDown className="h-3 w-3" />
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Drill-down */}
        <div data-testid="cadencia-drilldown" className="space-y-1">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {selected ? `${selected.fullLabel} · por cliente` : 'por cliente'}
          </p>
          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <CalendarOff className="h-6 w-6 text-muted-foreground/60" />
              <span className="text-sm text-muted-foreground">Sin publicaciones programadas</span>
            </div>
          ) : (
            <div className="space-y-0.5">
              {rows.map((row) => (
                <ClientRow key={row.clientId} row={row} />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
