'use client'

import { useMemo, useState, useTransition } from 'react'
import { CalendarDays, GripVertical, Layers } from 'lucide-react'
import { ClientLogo } from '@/components/clients/client-logo'
import { VideoCover } from '@/components/recording/video-cover'
import { Button } from '@/components/ui/button'
import { useToast } from '@/lib/hooks/use-toast'
import { schedulePoolIdea } from '@/lib/actions/client-pool'
import { DIAS, diaDeFecha } from '@/lib/entregas/dias'
import { cn } from '@/lib/utils'
import type { ClientPoolPanel, PoolVideo } from '@/lib/utils/client-pool-state'

const STATE_LABEL: Record<PoolVideo['state'], string> = {
  listo: 'Listo',
  agendado: 'Agendado',
  publicado: 'Publicado',
}

const STATE_CHIP: Record<PoolVideo['state'], string> = {
  listo: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  agendado: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  publicado: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
}

function Caratula({ video, className }: { video: PoolVideo; className?: string }) {
  if (video.coverVideoId) {
    return (
      <div className={cn('relative overflow-hidden rounded-lg bg-black', className)}>
        <VideoCover videoId={video.coverVideoId} title={video.title} />
      </div>
    )
  }
  if (video.coverUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={video.coverUrl}
        alt={`Carátula de ${video.title}`}
        className={cn('rounded-lg object-cover', className)}
      />
    )
  }
  return (
    <div
      className={cn('flex items-center justify-center rounded-lg bg-muted/40 text-[10px] text-muted-foreground', className)}
      aria-label={`Sin carátula de ${video.title}`}
    >
      Sin carátula
    </div>
  )
}

function weekDays(week: { desde: string; hasta: string }): string[] {
  const out: string[] = []
  const [y, m, d] = week.desde.split('-').map(Number)
  const cursor = new Date(y, m - 1, d, 12)
  for (let i = 0; i < 7; i++) {
    const yy = cursor.getFullYear()
    const mm = String(cursor.getMonth() + 1).padStart(2, '0')
    const dd = String(cursor.getDate()).padStart(2, '0')
    out.push(`${yy}-${mm}-${dd}`)
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

function diaShort(date: string): string {
  const key = diaDeFecha(date)
  return DIAS.find((d) => d.key === key)?.short ?? date
}

export function ClientPoolPanelView({
  data,
  canSchedule,
}: {
  data: ClientPoolPanel
  canSchedule: boolean
}) {
  const { toast } = useToast()
  const [panel, setPanel] = useState(data)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [, start] = useTransition()
  const days = useMemo(() => weekDays(panel.week), [panel.week])
  const selectedVideo = useMemo(
    () => panel.clients.flatMap((c) => c.pool).find((v) => v.id === selectedIdeaId) ?? null,
    [panel.clients, selectedIdeaId],
  )
  const canTapSchedule = Boolean(canSchedule && selectedIdeaId && selectedDate && !pendingId)

  function onDropDate(date: string, ideaId: string) {
    if (!canSchedule || !ideaId) return
    const prev = panel
    setPendingId(ideaId)
    setSelectedIdeaId(null)
    setSelectedDate(null)
    setPanel((cur) => optimisticSchedule(cur, ideaId, date))
    start(async () => {
      const res = await schedulePoolIdea({ ideaId, date })
      if (res.error) {
        setPanel(prev)
        toast({ title: 'No se pudo agendar', description: res.error, variant: 'destructive' })
      } else {
        toast({ title: 'Agendado en Metricool', description: 'agendado desde aquí' })
      }
      setPendingId(null)
    })
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6" data-testid="client-pool-panel">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight sm:text-xl">
            <Layers className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            Panel
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Qué publicar esta semana, con carátula. El pool Listo sale de Recibo
            AI al aprobar, o de un Recibo humano si el staff pulsa{' '}
            <strong>Enviar al pool · Listo</strong>.{' '}
            <span className="md:hidden">
              Toca un video Listo, un día y Agendar para publicarlo en Metricool.
            </span>
            <span className="hidden md:inline">
              Arrastra un video al calendario para agendarlo en Metricool.
            </span>
          </p>
        </div>
        <p className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">
          {panel.week.desde} → {panel.week.hasta}
        </p>
      </header>

      <section data-testid="pool-calendar" className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          Calendario · agendado y publicado
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-7">
          {days.map((date) => {
            const items = panel.calendar.filter((v) => v.publishDate === date)
            return (
              <DayCell
                key={date}
                date={date}
                items={items}
                canSchedule={canSchedule}
                selected={selectedDate === date}
                onSelectDate={(next) =>
                  setSelectedDate((cur) => (cur === next ? null : next))
                }
                onDrop={onDropDate}
              />
            )
          })}
        </div>
      </section>

      <section className="space-y-3">
        {panel.clients.map((row) => (
          <article
            key={row.client.id}
            className="rounded-xl border border-border bg-card p-4 animate-in fade-in slide-in-from-bottom-1 duration-300"
          >
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <div className="flex min-w-0 items-center gap-3">
                <ClientLogo name={row.client.name} logoUrl={row.client.logo_url} className="h-10 w-10" />
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{row.client.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {row.weekDates.length
                      ? `Cadencia esta semana: ${row.weekDates.map(diaShort).join(', ')}`
                      : 'Sin cadencia esta semana'}
                  </p>
                </div>
              </div>
            </div>

            {row.weekPosts.length > 0 && (
              <ul className="mt-3 flex gap-2 overflow-x-auto">
                {row.weekPosts.map((v) => (
                  <li key={v.id} className="w-28 shrink-0 space-y-1">
                    <Caratula video={v} className="aspect-[9/16] w-full" />
                    <p className="truncate text-xs font-medium">{v.title}</p>
                    <StateBadge state={v.state} fromHere={v.scheduledFromHere} />
                  </li>
                ))}
              </ul>
            )}

            {!row.hidePool && (
              <div className="mt-4 space-y-2" data-testid={`pool-${row.client.id}`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Pool · Listo
                </p>
                <ul className="flex flex-wrap gap-2">
                  {row.pool.map((v) => (
                    <li key={v.id}>
                      <PoolCard
                        video={v}
                        disabled={!canSchedule || pendingId === v.id}
                        canDrag={canSchedule}
                        selected={selectedIdeaId === v.id}
                        onSelect={() =>
                          setSelectedIdeaId((cur) => (cur === v.id ? null : v.id))
                        }
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        ))}
        {panel.clients.length === 0 && (
          <p className="text-sm text-muted-foreground">Nada que publicar esta semana y ningún pool Listo.</p>
        )}
      </section>

      {canSchedule && (
        <div
          className="md:hidden sticky bottom-0 z-10 -mx-1 rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur"
          data-testid="pool-mobile-schedule"
        >
          <p className="text-xs text-muted-foreground">
            {selectedVideo && selectedDate
              ? `${selectedVideo.title} · ${diaShort(selectedDate)} ${selectedDate.slice(8)}`
              : 'Toca un video Listo y un día'}
          </p>
          <Button
            type="button"
            className="mt-2 min-h-11 w-full touch-manipulation"
            disabled={!canTapSchedule}
            onClick={() => {
              if (!selectedIdeaId || !selectedDate) return
              onDropDate(selectedDate, selectedIdeaId)
            }}
          >
            Agendar
          </Button>
        </div>
      )}
    </div>
  )
}

function StateBadge({ state, fromHere }: { state: PoolVideo['state']; fromHere?: boolean }) {
  return (
    <div className="space-y-0.5">
      <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold', STATE_CHIP[state])}>
        {STATE_LABEL[state]}
      </span>
      {state === 'agendado' && fromHere && (
        <p className="text-[10px] text-sky-300/90">agendado desde aquí</p>
      )}
    </div>
  )
}

function PoolCard({
  video,
  disabled,
  canDrag,
  selected,
  onSelect,
}: {
  video: PoolVideo
  disabled: boolean
  canDrag: boolean
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      draggable={canDrag && !disabled}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', video.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={() => {
        if (!canDrag || disabled) return
        onSelect()
      }}
      aria-pressed={selected}
      disabled={disabled}
      className={cn(
        'flex w-36 flex-col gap-1 rounded-lg border border-border bg-background p-2 text-left touch-manipulation',
        canDrag && 'cursor-grab active:cursor-grabbing',
        selected && 'border-primary bg-primary/5 ring-1 ring-primary',
        disabled && 'opacity-60',
      )}
    >
      {canDrag && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <GripVertical className="h-3 w-3" aria-hidden="true" />
          <span className="hidden md:inline">Arrastra al día</span>
          <span className="md:hidden">{selected ? 'Elegido' : 'Toca para elegir'}</span>
        </div>
      )}
      <Caratula video={video} className="aspect-[9/16] w-full" />
      <p className="truncate text-xs font-medium">{video.title}</p>
      <StateBadge state={video.state} />
    </button>
  )
}

function DayCell({
  date,
  items,
  canSchedule,
  selected,
  onSelectDate,
  onDrop,
}: {
  date: string
  items: PoolVideo[]
  canSchedule: boolean
  selected: boolean
  onSelectDate: (date: string) => void
  onDrop: (date: string, ideaId: string) => void
}) {
  const [over, setOver] = useState(false)
  return (
    <div
      data-testid={`pool-day-${date}`}
      aria-pressed={canSchedule ? selected : undefined}
      onClick={() => {
        if (!canSchedule) return
        onSelectDate(date)
      }}
      onDragOver={(e) => {
        if (!canSchedule) return
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const id = e.dataTransfer.getData('text/plain')
        if (id) onDrop(date, id)
      }}
      className={cn(
        'min-h-32 rounded-lg border border-border bg-card p-2',
        canSchedule && 'cursor-pointer touch-manipulation',
        (over || selected) && 'border-primary bg-primary/5',
      )}
    >
      <p className="text-[11px] font-semibold text-muted-foreground">
        {diaShort(date)} <span className="tabular-nums">{date.slice(8)}</span>
      </p>
      <ul className="mt-2 space-y-2">
        {items.map((v) => (
          <li key={v.id} className="space-y-1">
            <Caratula video={v} className="aspect-[9/16] w-full" />
            <p className="truncate text-[11px] font-medium">{v.title}</p>
            <StateBadge state={v.state} fromHere={v.scheduledFromHere} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function optimisticSchedule(cur: ClientPoolPanel, ideaId: string, date: string): ClientPoolPanel {
  const fromPool = cur.clients.flatMap((c) => c.pool).find((v) => v.id === ideaId)
  const fromCal = cur.calendar.find((v) => v.id === ideaId)
  const video = fromPool ?? fromCal
  if (!video) return cur
  const moved: PoolVideo = {
    ...video,
    state: 'agendado',
    publishDate: date,
    scheduledFromHere: true,
  }
  return {
    ...cur,
    calendar: [...cur.calendar.filter((v) => v.id !== ideaId), moved],
    clients: cur.clients.map((row) => {
      const pool = row.pool.filter((v) => v.id !== ideaId)
      const weekPosts = [
        ...row.weekPosts.filter((v) => v.id !== ideaId),
        ...(row.client.id === moved.clientId ? [moved] : []),
      ]
      return { ...row, pool, weekPosts, hidePool: pool.length === 0 }
    }),
  }
}
