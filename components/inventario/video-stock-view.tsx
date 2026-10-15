'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Clapperboard, Film, Info, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ClientStock, VideoStock } from '@/lib/inventario/video-stock-core'
import { OK_DAYS } from '@/lib/inventario/video-stock-core'
import { VideoStockSceneLazy } from './video-stock-scene-lazy'
import { ClientLogo } from './client-logo'
import { ClientProfilePanel } from './client-profile-panel'
import { getClientStockDetail } from '@/lib/actions/video-stock-detail'
import type { ClientStockDetail } from '@/lib/inventario/client-detail-types'
import {
  GOLD_HEX,
  HEALTH_META,
  RAW_HEX,
  daysLeftLabel,
  lastRawLabel,
  runOutLabel,
} from './stock-labels'

type Filter = 'todos' | 'grabar' | 'crudo' | 'sin_cadencia'

const FILTERS: { key: Filter; label: string; match: (c: ClientStock) => boolean }[] = [
  { key: 'todos', label: 'Todos', match: () => true },
  { key: 'grabar', label: 'Hay que grabar', match: (c) => c.necesitaGrabar },
  { key: 'crudo', label: 'Con grabaciones', match: (c) => c.crudo > 0 },
  { key: 'sin_cadencia', label: 'Sin cadencia', match: (c) => c.health === 'sin_cadencia' },
]

function Kpi({
  testId,
  label,
  value,
  hint,
  icon: Icon,
  accent,
  delay,
}: {
  testId: string
  label: string
  value: number
  hint: string
  icon: typeof Film
  accent: string
  delay: number
}) {
  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-1 rounded-xl border bg-card p-4 duration-500 fill-mode-both"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 text-xs font-medium uppercase leading-tight tracking-wide text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 shrink-0" style={{ color: accent }} />
      </div>
      <div data-testid={testId} className="mt-2 text-3xl font-bold tabular-nums tracking-tight">
        {value}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

function RunwayBar({ client }: { client: ClientStock }) {
  if (client.daysLeft === null) return <div className="h-1.5 w-full rounded-full bg-muted" />
  // Full bar = four weeks of edited content.
  const pct = Math.min(client.daysLeft / (OK_DAYS * 2), 1) * 100
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full transition-[width] duration-700"
        style={{ width: `${Math.max(pct, client.listos > 0 ? 4 : 0)}%`, backgroundColor: HEALTH_META[client.health].hex }}
      />
    </div>
  )
}

function StockRow({
  client,
  today,
  selected,
  onClick,
  index,
}: {
  client: ClientStock
  today: string
  selected: boolean
  onClick: () => void
  index: number
}) {
  const meta = HEALTH_META[client.health]
  const lastRaw = lastRawLabel(client.lastRawAt, today)
  return (
    <button
      type="button"
      data-testid="stock-row"
      data-client={client.clientId}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'animate-in fade-in slide-in-from-bottom-1 grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 rounded-xl border bg-card p-3 text-left transition-colors duration-300 fill-mode-both hover:border-primary/50 sm:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,0.6fr))_minmax(0,1.2fr)]',
        selected && 'border-primary ring-1 ring-primary',
      )}
      style={{ animationDelay: `${Math.min(index, 20) * 25}ms` }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <ClientLogo key={client.logoUrl ?? 'none'} name={client.clientName} src={client.logoUrl} ringHex={meta.hex} />
        <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 truncate font-medium">{client.clientName}</span>
          {client.necesitaGrabar && (
            <span className="shrink-0 whitespace-nowrap rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-500 dark:text-red-400">
              Hay que grabar
            </span>
          )}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {client.perWeek > 0 ? `${client.perWeek} por semana` : 'Sin cadencia'}
          {client.agendados > 0 && <> · {client.agendados} agendados</>}
          {lastRaw && <> · {lastRaw}</>}
          {client.sinArchivo > 0 && <> · {client.sinArchivo} grabados sin archivo</>}
        </div>
        </div>
      </div>

      <div className="text-right sm:text-center">
        <div data-testid="row-listos" className="text-lg font-bold tabular-nums" style={{ color: GOLD_HEX }}>
          {client.listos}
        </div>
        <div data-testid="row-split" className="whitespace-nowrap text-[11px] text-muted-foreground">
          {client.reels} {client.reels === 1 ? 'reel' : 'reels'} · {client.posts} {client.posts === 1 ? 'post' : 'posts'}
        </div>
      </div>
      <div className="hidden text-center sm:block">
        <div data-testid="row-crudo" className="text-lg font-bold tabular-nums" style={{ color: RAW_HEX }}>
          {client.crudo}
        </div>
        <div className="text-[11px] text-muted-foreground">en crudo</div>
      </div>
      <div className="hidden text-center sm:block">
        <div className={cn('text-lg font-bold tabular-nums', meta.text)}>{daysLeftLabel(client)}</div>
        <div className="text-[11px] text-muted-foreground">alcanza</div>
      </div>

      <div className="col-span-2 min-w-0 space-y-1.5 sm:col-span-1">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className={cn('min-w-0 truncate font-medium', meta.text)}>
            {runOutLabel(client.runOutDate, today)}
            {client.runOutFormat && ` · falta ${client.runOutFormat}`}
          </span>
          {/* Phones hide the crudo column — keep the number reachable here. */}
          <span className="shrink-0 whitespace-nowrap text-muted-foreground sm:hidden">
            <span style={{ color: RAW_HEX }}>{client.crudo}</span> en crudo · {daysLeftLabel(client)}
          </span>
        </div>
        <RunwayBar client={client} />
      </div>
    </button>
  )
}

type DetailLoader = (clientId: string) => Promise<{ detail: ClientStockDetail } | { error: string }>

export function VideoStockView({
  stock,
  loadDetail = getClientStockDetail,
}: {
  stock: VideoStock
  /** Injected for previews; the page uses the server action. */
  loadDetail?: DetailLoader
}) {
  const [filter, setFilter] = useState<Filter>('todos')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  // Profiles already fetched this visit, so going back and forth is instant.
  const [details, setDetails] = useState<Record<string, ClientStockDetail>>({})
  const [detailError, setDetailError] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedId || details[selectedId]) return
    let cancelled = false
    setLoadingId(selectedId)
    setDetailError(null)
    loadDetail(selectedId)
      .then((res) => {
        if (cancelled) return
        if ('detail' in res) setDetails((cur) => ({ ...cur, [selectedId]: res.detail }))
        else setDetailError(res.error)
      })
      .catch(() => !cancelled && setDetailError('error de red'))
      .finally(() => !cancelled && setLoadingId(null))
    return () => {
      cancelled = true
    }
  }, [selectedId, details, loadDetail])

  const selected = selectedId ? stock.clients.find((c) => c.clientId === selectedId) ?? null : null
  const selectedDetail = selectedId ? details[selectedId] ?? null : null
  const { totals, today } = stock

  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter) ?? FILTERS[0]
    return stock.clients.filter(f.match)
  }, [stock.clients, filter])

  const selectFromList = (id: string) => {
    setSelectedId((cur) => (cur === id ? null : id))
    stageRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi testId="kpi-listos" label="Videos listos" value={totals.listos} hint={totals.agendados > 0 ? `Editados sin agendar · ${totals.agendados} más agendados` : 'Editados, sin publicar ni agendar'} icon={Film} accent={GOLD_HEX} delay={0} />
        <Kpi testId="kpi-crudo" label="En crudo" value={totals.crudo} hint="Grabaciones esperando edición" icon={Clapperboard} accent={RAW_HEX} delay={60} />
        <Kpi testId="kpi-con-crudo" label="Clientes con grabaciones" value={totals.clientesConCrudo} hint="Tienen crudo subido sin editar" icon={Users} accent={RAW_HEX} delay={120} />
        <Kpi testId="kpi-grabar" label="Hay que grabar" value={totals.necesitanGrabar} hint="Listos + crudo < 2 semanas" icon={Camera} accent={HEALTH_META.agotado.hex} delay={180} />
      </div>

      <div role="group" aria-label="Filtros" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count = stock.clients.filter(f.match).length
          const active = filter === f.key
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(f.key)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                active ? 'border-primary bg-primary text-primary-foreground' : 'hover:border-primary/50',
              )}
            >
              {f.label} <span className="tabular-nums opacity-70">{count}</span>
            </button>
          )
        })}
      </div>

      <div className="relative">
      <div
        ref={stageRef}
        className="relative h-[460px] overflow-hidden rounded-2xl border border-white/10 bg-[#070707] shadow-[0_0_80px_-30px_rgba(230,175,35,0.35)] sm:h-[640px]"
      >
        <VideoStockSceneLazy
          clients={visible}
          today={today}
          selectedId={selectedId}
          onSelect={setSelectedId}
          calendar={selectedDetail?.calendar ?? null}
        />

        <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-black/60 px-2.5 py-1.5 text-[11px] text-white/70 backdrop-blur">
          Rueda o pellizco para acercarte · arrastra para girar · clic derecho o dos dedos para moverte · toca un logo
        </div>

        <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg bg-black/65 px-3 py-2 text-[11px] text-white/85 backdrop-blur sm:right-auto">
          <span className="flex items-center gap-1.5">
            <span
              className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-extrabold text-black"
              style={{ backgroundColor: GOLD_HEX }}
            >
              8
            </span>
            Videos listos
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-extrabold text-[#0b1a2e]"
              style={{ backgroundColor: RAW_HEX }}
            >
              +3
            </span>
            Clips en crudo
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border-2" style={{ borderColor: RAW_HEX }} /> Tiene grabaciones
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border-2" style={{ borderColor: HEALTH_META.agotado.hex }} /> Aro = cuánto le alcanza
          </span>
        </div>
      </div>

      {selected && (
        <div className="mt-3 flex h-[600px] flex-col md:absolute md:bottom-3 md:right-3 md:top-3 md:mt-0 md:h-auto md:w-[360px]">
          <ClientProfilePanel
            client={selected}
            today={today}
            detail={selectedDetail}
            loading={loadingId === selected.clientId && !selectedDetail}
            error={selectedDetail ? null : detailError}
            onClose={() => setSelectedId(null)}
          />
        </div>
      )}
      </div>

      <p className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <span>
          Solo cuenta lo que está subido al sistema (Pipeline y Entregas). Lo que está únicamente en Drive todavía no aparece.
          {totals.sinArchivo > 0 && (
            <>
              {' '}
              Hay <strong className="text-foreground">{totals.sinArchivo}</strong> videos marcados como grabados que no tienen archivo aquí.
            </>
          )}
        </span>
      </p>

      <div className="space-y-3">

        {visible.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nadie en este filtro.{' '}
            <button type="button" className="font-medium text-primary underline-offset-2 hover:underline" onClick={() => setFilter('todos')}>
              Ver todos
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map((c, i) => (
              <StockRow
                key={c.clientId}
                client={c}
                today={today}
                index={i}
                selected={c.clientId === selectedId}
                onClick={() => selectFromList(c.clientId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
