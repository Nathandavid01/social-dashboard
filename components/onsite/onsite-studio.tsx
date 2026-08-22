'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Camera, Check, ChevronDown, ChevronRight, ExternalLink, Loader2, MapPin, Plus, Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/lib/hooks/use-toast'
import { SHOT_TYPES, shotTypeLabel, type OnsiteShot } from '@/lib/onsite/shot-types'
import { viralityBand } from '@/lib/onsite/virality'
import { emptyOnsiteSlots, groupOnsiteSessions, progressAgainstTarget } from '@/lib/onsite/slot-count'
import { alreadyCheckedIn, formatArrivalStamp } from '@/lib/onsite/arrival'
import {
  addIdeaToSession,
  checkInOnsite,
  generateOnsiteIdeas,
  toggleShotRecorded,
  updateOnsiteIdea,
  updateShotDetails,
  type AddableIdea,
  type OnsiteSession,
} from '@/lib/actions/onsite'
import { IdeaVideoLoader } from '@/components/recording/idea-video-loader'

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function fechaCorta(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  if (!m || !d) return iso
  return `${d} ${MES[m - 1]}`
}

export function OnsiteStudio({
  sessions,
  active,
  shots: initialShots,
  addable,
  canBrief,
  canRecord,
  canUpload,
  today,
  currentUserId,
}: {
  sessions: OnsiteSession[]
  active: OnsiteSession
  shots: OnsiteShot[]
  addable: AddableIdea[]
  canBrief: boolean
  canRecord: boolean
  canUpload: boolean
  today: string
  currentUserId: string | null
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [q, setQ] = useState('')
  const [shots, setShots] = useState(initialShots)
  const [ocupado, setOcupado] = useState<Set<string>>(new Set())
  const [abierta, setAbierta] = useState<string | null>(null)
  const [añadiendo, setAñadiendo] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [sellando, setSellando] = useState(false)
  const [verSinCliente, setVerSinCliente] = useState(() => !active.clientId)

  useEffect(() => {
    setShots(initialShots)
  }, [initialShots])

  const filtradas = useMemo(() => {
    const n = q.trim().toLowerCase()
    if (!n) return sessions
    return sessions.filter((s) =>
      `${s.clientName} ${s.title} ${s.date}`.toLowerCase().includes(n),
    )
  }, [q, sessions])

  const grupos = useMemo(() => groupOnsiteSessions(filtradas, today), [filtradas, today])
  const huecos = emptyOnsiteSlots(shots.length, active.slotTarget)
  const prog = useMemo(() => progressAgainstTarget(shots, active.slotTarget), [shots, active.slotTarget])

  function busy(id: string, on: boolean) {
    setOcupado((s) => {
      const n = new Set(s)
      on ? n.add(id) : n.delete(id)
      return n
    })
  }

  async function toggle(shot: OnsiteShot) {
    if (!canRecord) return
    const siguiente = !shot.recorded
    setShots((ss) => ss.map((s) => (s.id === shot.id ? { ...s, recorded: siguiente } : s)))
    busy(shot.id, true)
    const res = await toggleShotRecorded({ ideaId: shot.id, recorded: siguiente })
    busy(shot.id, false)
    if (res.error) {
      setShots((ss) => ss.map((s) => (s.id === shot.id ? { ...s, recorded: shot.recorded } : s)))
      toast({ title: 'No se pudo marcar', description: res.error, variant: 'destructive' })
    }
  }

  async function generar() {
    setGenerando(true)
    const res = await generateOnsiteIdeas({ sessionId: active.id, count: huecos })
    setGenerando(false)
    if (res.error) {
      toast({ title: 'No se pudo generar', description: res.error, variant: 'destructive' })
      return
    }
    router.refresh()
  }

  async function sellarLlegada() {
    setSellando(true)
    const res = await checkInOnsite(active.id)
    setSellando(false)
    if (res.error) {
      toast({ title: 'No se pudo sellar la llegada', description: res.error, variant: 'destructive' })
      return
    }
    router.refresh()
  }

  async function añadir(idea: AddableIdea) {
    busy(idea.id, true)
    const res = await addIdeaToSession({ sessionId: active.id, ideaId: idea.id, source: idea.source })
    busy(idea.id, false)
    if (res.error) {
      toast({ title: 'No se pudo añadir', description: res.error, variant: 'destructive' })
      return
    }
    router.refresh()
  }

  return (
    <div className="flex min-h-[calc(100dvh-7rem)] flex-col gap-4 lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col rounded-2xl border bg-card lg:w-[280px]">
        <div className="border-b p-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar cliente…"
              className="h-10 w-full rounded-lg border bg-background pl-8 pr-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            />
          </label>
        </div>
        <nav className="min-h-0 flex-1 space-y-3 overflow-y-auto p-2">
          {grupos.map((g) => {
            const colapsar = g.lane === 'sin_cliente' && !q.trim() && !verSinCliente
            return (
            <section key={g.lane}>
              {g.lane === 'sin_cliente' ? (
                <button
                  type="button"
                  onClick={() => setVerSinCliente((v) => !v)}
                  className="flex w-full items-center justify-between px-2 pb-1 text-left"
                >
                  <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {g.label}
                  </h2>
                  <span className="text-[10px] tabular-nums text-muted-foreground">{g.items.length}</span>
                </button>
              ) : (
                <h2 className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {g.label}
                </h2>
              )}
              {!colapsar && (
              <ul className="space-y-1">
                {g.items.map((s) => {
                  const sel = s.id === active.id
                  return (
                    <li key={s.id}>
                      <Link
                        href={`/onsite?s=${s.id}`}
                        aria-current={sel ? 'page' : undefined}
                        className={cn(
                          'relative block overflow-hidden rounded-xl px-3 py-2.5 transition',
                          sel
                            ? 'bg-primary text-primary-foreground shadow-[0_0_0_1px_hsl(var(--primary))]'
                            : 'border border-transparent text-foreground hover:bg-muted/60',
                        )}
                      >
                        {sel && (
                          <span className="absolute inset-y-0 left-0 w-1 bg-black/30" aria-hidden />
                        )}
                        <span className="flex items-center justify-between gap-2">
                          <span className="block min-w-0 truncate text-[13px] font-semibold">{s.clientName}</span>
                          {sel && (
                            <span className="shrink-0 rounded-full bg-black/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">
                              Abierto
                            </span>
                          )}
                        </span>
                        <span className={cn(
                          'mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px]',
                          sel ? 'text-primary-foreground/80' : 'text-muted-foreground',
                        )}>
                          <span>{fechaCorta(s.date)}</span>
                          {s.slotTarget > 0 && (
                            <span className="tabular-nums">{s.slotTarget} vid.</span>
                          )}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
              )}
            </section>
            )
          })}
        </nav>
      </aside>

      <section className="min-w-0 flex-1 space-y-3">
        <header className="rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 to-card px-4 py-3 ring-1 ring-primary/30">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Jornada de grabación</p>
              <h1 className="truncate text-xl font-semibold tracking-tight">{active.clientName}</h1>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                <span className={cn('rounded-full px-2 py-0.5', active.arrivedAt ? 'bg-emerald-500/15 text-emerald-500' : 'bg-muted')}>1 Llegada</span>
                <span aria-hidden>→</span>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">2 Call sheet</span>
                <span aria-hidden>→</span>
                <span className="rounded-full bg-muted px-2 py-0.5">3 Subida</span>
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
                <span>{fechaCorta(active.date)} · {active.title}</span>
                {active.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {active.location}
                  </span>
                )}
                {active.slotTarget > 0 && (
                  <span className="tabular-nums text-foreground">
                    {active.perMonth}/mes · {active.slotTarget} videos
                  </span>
                )}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {canRecord && !alreadyCheckedIn(currentUserId, active.arrivedById ? [{ userId: active.arrivedById }] : []) && !active.arrivedAt && (
                <button
                  type="button"
                  onClick={() => void sellarLlegada()}
                  disabled={sellando}
                  className="h-10 rounded-lg border border-primary/40 bg-primary/10 px-3 text-[12px] font-semibold text-primary disabled:opacity-50"
                >
                  {sellando ? 'Sellando…' : 'Llegué'}
                </button>
              )}
              {active.arrivedAt && active.arrivedByName && (
                <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-500">
                  {formatArrivalStamp({ name: active.arrivedByName, at: active.arrivedAt })}
                </span>
              )}
              {canBrief && huecos > 0 && active.clientId && (
                <button
                  type="button"
                  onClick={() => void generar()}
                  disabled={generando}
                  className="h-10 rounded-lg bg-primary px-3 text-[12px] font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {generando ? 'Generando con IA…' : `Generar ${huecos} ideas con IA`}
                </button>
              )}
              {canBrief && (
                <button
                  type="button"
                  onClick={() => setAñadiendo((v) => !v)}
                  className="h-10 rounded-lg border px-3 text-[12px] font-medium"
                >
                  <span className="inline-flex items-center gap-1">
                    <Plus className="h-3.5 w-3.5" /> Añadir ({addable.length})
                  </span>
                </button>
              )}
            </div>
          </div>
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[11px] tabular-nums">
              <span>{prog.recorded} de {prog.total} grabadas</span>
              <span className={prog.total === 0 ? 'text-muted-foreground' : prog.pending > 0 ? 'text-amber-500' : 'text-emerald-500'}>
                {prog.total === 0 ? 'Sin brief' : prog.pending > 0 ? `Faltan ${prog.pending}` : 'Todo grabado'}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${prog.pct}%` }} />
            </div>
          </div>
        </header>

        {añadiendo && canBrief && (
          <ul className="max-h-48 space-y-1 overflow-y-auto rounded-2xl border bg-card p-2">
            {addable.length === 0 ? (
              <li className="px-2 py-3 text-center text-[12px] text-muted-foreground">
                No hay ideas sueltas de este cliente ni aprobadas en el Lab.
              </li>
            ) : addable.map((i) => (
              <li key={`${i.source}:${i.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                <span className="min-w-0 flex-1 truncate text-[12px]">{i.title}</span>
                <button
                  type="button"
                  onClick={() => void añadir(i)}
                  disabled={ocupado.has(i.id)}
                  className="shrink-0 rounded-md border px-2 py-1 text-[11px]"
                >
                  Añadir
                </button>
              </li>
            ))}
          </ul>
        )}

        {shots.length === 0 && huecos === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border bg-card px-4 py-12 text-center">
            <Camera className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">Este cliente no tiene /mes</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Pon Días de posting en el perfil, o añade ideas una a una.
            </p>
          </div>
        ) : (
          <ol className="space-y-2">
            {shots.map((s, i) => (
              <IdeaCard
                key={s.id}
                n={i + 1}
                shot={s}
                canBrief={canBrief}
                canRecord={canRecord}
                canUpload={canUpload}
                ocupado={ocupado.has(s.id)}
                abierta={abierta === s.id}
                onToggle={() => void toggle(s)}
                onOpen={() => setAbierta((id) => (id === s.id ? null : s.id))}
                onPatch={(patch) => setShots((ss) => ss.map((x) => (x.id === s.id ? { ...x, ...patch } : x)))}
              />
            ))}
            {Array.from({ length: huecos }, (_, i) => (
              <EmptyIdeaSlot
                key={`hueco-${i}`}
                n={shots.length + i + 1}
                canBrief={canBrief}
                onFill={() => setAñadiendo(true)}
              />
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

function EmptyIdeaSlot({
  n, canBrief, onFill,
}: {
  n: number
  canBrief: boolean
  onFill: () => void
}) {
  return (
    <li>
      <button
        type="button"
        aria-label={`Idea ${String(n).padStart(2, '0')} por llenar`}
        onClick={canBrief ? onFill : undefined}
        disabled={!canBrief}
        className={cn(
          'flex w-full items-start gap-3 rounded-2xl border border-dashed bg-transparent p-3 text-left',
          canBrief && 'hover:border-primary/50 hover:bg-muted/30',
        )}
      >
        <span className="mt-1 w-7 shrink-0 text-center font-mono text-[11px] text-muted-foreground/50">
          {String(n).padStart(2, '0')}
        </span>
        <span className="min-w-0 flex-1 space-y-2 py-0.5">
          <span className="block h-10 rounded-md border border-dashed bg-transparent" />
          <span className="block h-10 rounded-md border border-dashed bg-transparent" />
          <span className="block min-h-[4.5rem] rounded-md border border-dashed bg-transparent" />
          <span className="text-[11px] text-muted-foreground">Por llenar</span>
        </span>
      </button>
    </li>
  )
}

function IdeaCard({
  n, shot, canBrief, canRecord, canUpload, ocupado, abierta, onToggle, onOpen, onPatch,
}: {
  n: number
  shot: OnsiteShot
  canBrief: boolean
  canRecord: boolean
  canUpload: boolean
  ocupado: boolean
  abierta: boolean
  onToggle: () => void
  onOpen: () => void
  onPatch: (p: Partial<OnsiteShot>) => void
}) {
  const { toast } = useToast()
  const [titulo, setTitulo] = useState(shot.title)
  const [hook, setHook] = useState(shot.hook ?? '')
  const [brief, setBrief] = useState(shot.visualBrief ?? '')
  const [refUrl, setRefUrl] = useState(shot.referenceUrl ?? '')

  async function guardar(patch: { title?: string; hook?: string | null; visualBrief?: string | null; referenceUrl?: string | null; shotType?: string | null }) {
    const res = await updateOnsiteIdea({ ideaId: shot.id, ...patch })
    if (res.error) toast({ title: 'No se guardó', description: res.error, variant: 'destructive' })
  }

  return (
    <li className={cn('rounded-2xl border bg-card', shot.recorded && 'opacity-80')}>
      <div className="flex items-start gap-3 p-3">
        <span className="mt-1 w-7 shrink-0 text-center font-mono text-[11px] text-muted-foreground">
          {String(n).padStart(2, '0')}
        </span>
        {canRecord && (
          <button
            type="button"
            onClick={onToggle}
            disabled={ocupado}
            aria-pressed={shot.recorded}
            aria-label={`${shot.recorded ? 'Desmarcar' : 'Marcar'} ${shot.title} como grabada`}
            className={cn(
              'mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 transition',
              shot.recorded ? 'border-emerald-500 bg-emerald-500 text-black' : 'border-border hover:border-primary',
            )}
          >
            {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : shot.recorded && <Check className="h-4 w-4" />}
          </button>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <input
            value={titulo}
            readOnly={!canBrief}
            onChange={canBrief ? (e) => setTitulo(e.target.value) : undefined}
            onBlur={canBrief ? () => {
              onPatch({ title: titulo })
              void guardar({ title: titulo, hook })
            } : undefined}
            aria-label={`Título de la idea ${n}`}
            className={cn(
              'h-10 w-full rounded-md border px-2 text-[14px] font-medium outline-none',
              canBrief ? 'bg-background focus-visible:ring-2 focus-visible:ring-primary/40' : 'cursor-default bg-muted/30 text-foreground',
            )}
          />
          <textarea
            value={hook}
            readOnly={!canBrief}
            onChange={canBrief ? (e) => setHook(e.target.value) : undefined}
            onBlur={canBrief ? () => {
              onPatch({ hook: hook || null })
              void guardar({ hook })
            } : undefined}
            placeholder="Qué dice en los primeros 2 segundos"
            aria-label={`Hook de la idea ${n}`}
            rows={3}
            className={cn(
              'min-h-[4.5rem] w-full resize-y whitespace-pre-wrap break-words rounded-md border px-2 py-2 text-[12px] leading-relaxed outline-none',
              canBrief ? 'bg-background focus-visible:ring-2 focus-visible:ring-primary/40' : 'cursor-default bg-muted/30 text-foreground',
            )}
          />
          <textarea
            value={brief}
            readOnly={!canBrief}
            onChange={canBrief ? (e) => setBrief(e.target.value) : undefined}
            onBlur={canBrief ? () => {
              onPatch({ visualBrief: brief || null })
              void guardar({ visualBrief: brief })
            } : undefined}
            placeholder="Qué grabar: cámara, sitio, quién habla, cada toma, B-roll, duración"
            aria-label={`Qué grabar en la idea ${n}`}
            rows={5}
            className={cn(
              'min-h-[7.5rem] w-full resize-y rounded-md border px-2 py-2 text-[12px] leading-relaxed outline-none',
              canBrief ? 'bg-background focus-visible:ring-2 focus-visible:ring-primary/40' : 'cursor-default bg-muted/30 text-foreground',
            )}
          />
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {shot.viralityScore != null && (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums',
                  viralityBand(shot.viralityScore) === 'alto' && 'bg-primary text-primary-foreground',
                  viralityBand(shot.viralityScore) === 'medio' && 'bg-amber-500/20 text-amber-400',
                  viralityBand(shot.viralityScore) === 'bajo' && 'bg-muted text-muted-foreground',
                )}
              >
                Viral {shot.viralityScore}/10
              </span>
            )}
            {shot.viralityWhy && (
              <span className="text-[11px] text-muted-foreground">{shot.viralityWhy}</span>
            )}
            <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium">{shotTypeLabel(shot.shotType)}</span>
            {shot.referenceUrl && (
              <a
                href={shot.referenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-primary"
              >
                <ExternalLink className="h-3 w-3" /> Referencia
              </a>
            )}
          </div>
          {canUpload && (
            <div className="pt-2">
              <IdeaVideoLoader ideaId={shot.id} ideaTitle={titulo} kinds={['raw']} compact />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onOpen}
          aria-expanded={abierta}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border"
          aria-label={abierta ? 'Cerrar detalle' : 'Abrir detalle'}
        >
          {abierta ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
      {abierta && (
        <div className="space-y-3 border-t px-3 py-3">
          {canBrief && (
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-[11px] text-muted-foreground">
                Tipo de cámara
                <select
                  value={shot.shotType ?? ''}
                  onChange={(e) => {
                    const shotType = e.target.value || null
                    onPatch({ shotType })
                    void updateShotDetails({ ideaId: shot.id, shotType })
                    void guardar({ shotType })
                  }}
                  className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-[13px]"
                >
                  <option value="">Sin tipo</option>
                  {SHOT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </label>
              <label className="text-[11px] text-muted-foreground">
                Link de referencia
                <input
                  value={refUrl}
                  onChange={(e) => setRefUrl(e.target.value)}
                  onBlur={() => {
                    onPatch({ referenceUrl: refUrl.trim() || null })
                    void guardar({ referenceUrl: refUrl })
                  }}
                  placeholder="https://…"
                  className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-[13px]"
                />
              </label>
            </div>
          )}
          {!canUpload && (
            <p className="text-[12px] text-muted-foreground">El material crudo se sube en la tarjeta si tienes permiso.</p>
          )}
        </div>
      )}
    </li>
  )
}
