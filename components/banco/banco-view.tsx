'use client'

/**
 * Banco de Video (/banco) — vista SOLO admins (owner + supervisor).
 *
 * Biblioteca global de crudos: un carril oscuro por cliente (acento de marca,
 * nada de fondos lavados), tiles de solo carátula (jamás <video>), conteos,
 * reasignación de editor por tile y asignación cliente→editor por carril.
 * Pestaña Calendario: proyección del orden de auto-post a Metricool.
 * Semántica: el banco enseña crudos PENDIENTES; lo aprobado vive en el
 * calendario. Poblaciones disjuntas a propósito.
 */
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, CalendarPlus, Clapperboard, Film, MessageSquareText, RotateCcw, UserRound, Users } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ClientLogo } from '@/components/clients/client-logo'
import { useToast } from '@/lib/hooks/use-toast'
import { getBankCoverUrls } from '@/lib/actions/video-bank-covers'
import { reassignVideo } from '@/lib/actions/content-ideas'
import { setClientAssignment } from '@/lib/actions/client-assignments'
import { RoleGate } from '@/components/auth/role-gate'
import { BancoUploadDialog, type BancoUploadClient } from '@/components/banco/banco-upload-dialog'
import type { AttachableBankIdea } from '@/lib/pipeline/banco-direct-upload'
import type { BankClientRail, BankVideoTile, VideoBank } from '@/lib/pipeline/video-bank'
import { railsWithEveryClient } from '@/lib/pipeline/video-bank'
import type { ProjectedCalendar } from '@/lib/pipeline/projected-calendar'
import type { ClientCalendarDay } from '@/lib/pipeline/client-calendar'
import { approvalTone } from '@/lib/pipeline/approval-tone'
import { cn } from '@/lib/utils'

export interface BancoDevuelto {
  ideaId: string
  title: string
  clientName: string
  editorName: string | null
}

export interface BancoEditorStat {
  id: string
  name: string
  wipLimit: number
  approved: number
  returned: number
  queueCount: number
}

export interface BancoClientPanel {
  clientId: string
  clientName: string
  /** Próximo día favorable para agendar (slot de posteo vacío más cercano). */
  nextSlotLabel: string | null
  calendar: ClientCalendarDay[]
  /** Mini-CRM: lo último que se dijo/hizo con este cliente. */
  latest: Array<{ when: string; who: string | null; text: string }>
}

export interface BancoViewProps {
  bank: VideoBank
  calendar: ProjectedCalendar
  devueltos: BancoDevuelto[]
  editors: BancoEditorStat[]
  teamEditors: Array<{ id: string; name: string }>
  clientLogos: Record<string, string | null>
  clientsPanel?: BancoClientPanel[]
  clients?: BancoUploadClient[]
  ideas?: AttachableBankIdea[]
}

export function BancoView({ bank, calendar, devueltos, editors, teamEditors, clientLogos, clientsPanel = [], clients = [], ideas = [] }: BancoViewProps) {
  const library = useMemo(() => railsWithEveryClient(bank.rails, clients), [bank.rails, clients])
  return (
    <Tabs defaultValue="banco" className="flex-1 space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="tabular-nums">
            <strong className="text-foreground">{bank.totals.videos}</strong> crudos ·{' '}
            <strong className="text-foreground">{bank.totals.clients}</strong> clientes ·{' '}
            <strong className="text-foreground">{bank.totals.unassigned}</strong> sin editor
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RoleGate perm="video.upload">
            <BancoUploadDialog clients={clients} ideas={ideas} />
          </RoleGate>
        <TabsList className="shrink-0">
          <TabsTrigger value="banco">
            <Film className="mr-1.5 h-3.5 w-3.5" /> Banco
          </TabsTrigger>
          <TabsTrigger value="calendario">
            <CalendarDays className="mr-1.5 h-3.5 w-3.5" /> Calendario
          </TabsTrigger>
          <TabsTrigger value="clientes">
            <Users className="mr-1.5 h-3.5 w-3.5" /> Clientes
          </TabsTrigger>
        </TabsList>
        </div>
      </div>

      <TabsContent value="banco" className="space-y-4">
        {editors.length > 0 && <EditorStrip editors={editors} />}
        {devueltos.length > 0 && <Devueltos items={devueltos} />}
        {library.length === 0 ? (
          <div className="flex items-center justify-center rounded-xl border border-border bg-card px-5 py-16 text-center">
            <p className="max-w-sm text-sm text-muted-foreground">
              Sube videos aunque no haya grabación agendada. El B-roll del cliente se queda aquí.
            </p>
          </div>
        ) : (
          library.map((rail) => (
            <ClientRail
              key={rail.clientId}
              rail={rail}
              logoUrl={clientLogos[rail.clientId] ?? rail.logoUrl}
              teamEditors={teamEditors}
              clients={clients}
              ideas={ideas}
            />
          ))
        )}
      </TabsContent>

      <TabsContent value="calendario" className="space-y-4">
        <ProjectedCalendarView calendar={calendar} />
      </TabsContent>

      <TabsContent value="clientes" className="space-y-4">
        <ClientsPanel clients={clientsPanel} clientLogos={clientLogos} />
      </TabsContent>
    </Tabs>
  )
}

/** Tira de editores: WIP dinámico (sube con su % de aprobación) y cola. */
function EditorStrip({ editors }: { editors: BancoEditorStat[] }) {
  return (
    <section data-testid="editor-strip" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {editors.map((ed) => {
        const total = ed.approved + ed.returned
        const rate = total === 0 ? null : Math.round((ed.approved / total) * 100)
        return (
          <article key={ed.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <div className="flex min-w-0 items-center gap-2">
                <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="truncate text-sm font-semibold">{ed.name}</p>
              </div>
              <span className="shrink-0 whitespace-nowrap rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                {ed.wipLimit} a la vez
              </span>
            </div>
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <span
                data-testid={`approval-badge-${ed.id}`}
                className={cn('rounded-md border px-1.5 py-0.5 font-semibold', approvalTone(rate).badge)}
              >
                {rate === null ? 'Sin historial' : `${rate}%`}
              </span>
              {rate !== null && <span>{ed.approved} aprobados · {ed.returned} devueltos</span>}
              <span>· cola: {ed.queueCount}</span>
            </p>
          </article>
        )
      })}
    </section>
  )
}

/** Lo que el QC IA o un admin viró: cola aparte para que no se pierda. */
function Devueltos({ items }: { items: BancoDevuelto[] }) {
  return (
    <section data-testid="devueltos" className="rounded-xl border border-amber-500/30 bg-card">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <RotateCcw className="h-4 w-4 text-amber-400" />
        <h2 className="text-sm font-semibold">Devueltos</h2>
        <p className="text-[11px] text-muted-foreground">virados por el QC IA o por un admin</p>
      </header>
      <ul className="divide-y divide-border">
        {items.map((d) => (
          <li key={d.ideaId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5">
            <p className="min-w-0 truncate text-sm">{d.title}</p>
            <p className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground">
              {d.clientName}{d.editorName ? ` · ${d.editorName}` : ''}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ClientRail({
  rail,
  logoUrl,
  teamEditors,
  clients,
  ideas,
}: {
  rail: BankClientRail
  logoUrl: string | null
  teamEditors: Array<{ id: string; name: string }>
  clients: BancoUploadClient[]
  ideas: AttachableBankIdea[]
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function assignClient(userId: string | null) {
    startTransition(async () => {
      const res = await setClientAssignment({ clientId: rail.clientId, campo: 'editor', userId })
      if (res.error) toast({ title: 'No se pudo asignar', description: res.error, variant: 'destructive' })
      else router.refresh()
    })
  }

  return (
    <section
      data-testid={`bank-rail-${rail.clientId}`}
      className="min-w-0 overflow-hidden rounded-xl border bg-card"
      style={{
        borderColor: `${rail.cardColor}55`,
        boxShadow: `inset 3px 0 0 0 ${rail.cardColor}`,
        background: `linear-gradient(90deg, ${rail.cardColor}10, transparent 38%)`,
      }}
    >
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <ClientLogo name={rail.clientName} logoUrl={logoUrl} className="h-7 w-7 text-[10px]" />
          <h2 className="truncate text-sm font-semibold">{rail.clientName}</h2>
          <span
            data-testid={`rail-count-${rail.clientId}`}
            className="shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground"
          >
            {rail.videoCount}
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={pending}
            className="shrink-0 whitespace-nowrap rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {rail.editorName ? `Editor: ${rail.editorName}` : 'Asignar editor'}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Editor del cliente</DropdownMenuLabel>
            {teamEditors.map((ed) => (
              <DropdownMenuItem key={ed.id} onSelect={() => assignClient(ed.id)}>
                {ed.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => assignClient(null)}>Sin editor</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      {rail.videos.length > 0 && <CoverGrid videos={rail.videos} teamEditors={teamEditors} />}
      <section data-testid={`client-broll-${rail.clientId}`} className="border-t border-border px-3 pb-3 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">B-roll del cliente</h3>
            <p className="text-[11px] text-muted-foreground">Siempre aquí. No se va cuando publicas un video.</p>
          </div>
          <RoleGate perm="video.upload">
            <BancoUploadDialog
              clients={clients.length > 0 ? clients : [{ id: rail.clientId, name: rail.clientName }]}
              ideas={ideas}
              defaultClientId={rail.clientId}
              defaultKind="broll"
              triggerLabel="Subir B-roll"
              triggerClassName="border border-border bg-background text-foreground"
            />
          </RoleGate>
        </div>
        {(rail.brolls ?? []).length > 0
          ? <CoverGrid videos={rail.brolls ?? []} teamEditors={teamEditors} />
          : <p className="px-1 pb-2 text-xs text-muted-foreground">Todavía no hay B-roll de {rail.clientName}.</p>}
      </section>
    </section>
  )
}

/** Presign en LOTE al entrar el carril en pantalla; un solo action por carril. */
function CoverGrid({
  videos,
  teamEditors,
}: {
  videos: BankVideoTile[]
  teamEditors: Array<{ id: string; name: string }>
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [covers, setCovers] = useState<Record<string, string>>({})
  const requested = useRef(false)

  useEffect(() => {
    const load = () => {
      if (requested.current) return
      requested.current = true
      const ids = videos.filter((v) => v.hasCover).map((v) => v.videoId)
      if (ids.length === 0) return
      getBankCoverUrls(ids)
        .then((res) => setCovers(res.urls ?? {}))
        .catch(() => { /* placeholder se queda; el banco nunca rompe */ })
    }
    const node = ref.current
    if (!node || typeof IntersectionObserver === 'undefined') {
      load()
      return
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        load()
        io.disconnect()
      }
    }, { rootMargin: '200px' })
    io.observe(node)
    return () => io.disconnect()
  }, [videos])

  return (
    <div ref={ref} className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
      {videos.map((tile) => (
        <CoverTile key={tile.videoId} tile={tile} coverUrl={covers[tile.videoId] ?? null} teamEditors={teamEditors} />
      ))}
    </div>
  )
}

function CoverTile({
  tile,
  coverUrl,
  teamEditors,
}: {
  tile: BankVideoTile
  coverUrl: string | null
  teamEditors: Array<{ id: string; name: string }>
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function reassign(editorId: string | null) {
    if (!tile.productionTaskId) return
    startTransition(async () => {
      const res = await reassignVideo(tile.productionTaskId!, editorId)
      if (res.error) toast({ title: 'No se pudo reasignar', description: res.error, variant: 'destructive' })
      else router.refresh()
    })
  }

  return (
    <figure className="group min-w-0 overflow-hidden rounded-lg border border-border bg-background/60">
      <div className="relative aspect-[9/16] w-full overflow-hidden bg-secondary/60">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL presignada de R2, dominio dinámico
          <img src={coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Clapperboard className="h-6 w-6 text-muted-foreground/50" />
          </div>
        )}
        {tile.durationSec != null && (
          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 py-0.5 text-[10px] tabular-nums text-white">
            {formatDuration(tile.durationSec)}
          </span>
        )}
        {tile.kind === 'broll' && (
          <span className="absolute left-1 top-1 rounded bg-black/70 px-1 py-0.5 text-[9px] uppercase tracking-wide text-white">
            b-roll
          </span>
        )}
      </div>
      <figcaption className="space-y-1 p-2">
        <p className="truncate text-[12px] font-medium" title={tile.title}>{tile.title}</p>
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={pending || !tile.productionTaskId}
            className={cn(
              'w-full truncate rounded border border-border px-1.5 py-0.5 text-left text-[10px] text-muted-foreground transition-colors',
              tile.productionTaskId ? 'hover:bg-secondary hover:text-foreground' : 'opacity-50',
            )}
          >
            {tile.editorName ?? 'Sin editor'}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Reasignar idea completa</DropdownMenuLabel>
            {teamEditors.map((ed) => (
              <DropdownMenuItem key={ed.id} onSelect={() => reassign(ed.id)}>
                {ed.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => reassign(null)}>Sin editor</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </figcaption>
    </figure>
  )
}

function ProjectedCalendarView({ calendar }: { calendar: ProjectedCalendar }) {
  const byDate = new Map<string, typeof calendar.posts>()
  for (const post of calendar.posts) {
    const list = byDate.get(post.date) ?? []
    list.push(post)
    byDate.set(post.date, list)
  }
  const dates = Array.from(byDate.keys()).sort()

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-muted-foreground">
        Si todo sigue aprobado, este es el orden en que se auto-postearía a Metricool según el posting schedule de cada cliente.
      </p>
      {dates.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-5 py-12 text-center text-sm text-muted-foreground">
          No hay videos aprobados en cola. Cuando se apruebe uno, aquí aparece su fecha teórica.
        </div>
      ) : (
        <ol className="space-y-3">
          {dates.map((date) => (
            <li key={date} className="rounded-xl border border-border bg-card">
              <p className="border-b border-border px-4 py-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                {formatDateES(date)}
              </p>
              <ul className="divide-y divide-border">
                {(byDate.get(date) ?? []).map((post) => (
                  <li key={post.ideaId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5">
                    <p className="min-w-0 truncate text-sm">{post.title}</p>
                    <p className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground">
                      {post.clientName}{post.time ? ` · ${post.time}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
      {calendar.overflow.length > 0 && (
        <section data-testid="calendar-overflow" className="rounded-xl border border-border bg-card">
          <p className="border-b border-border px-4 py-2 text-[12px] font-semibold text-muted-foreground">
            Sin espacio en la ventana — se postearían después
          </p>
          <ul className="divide-y divide-border">
            {calendar.overflow.map((o) => (
              <li key={o.ideaId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2">
                <p className="min-w-0 truncate text-sm">{o.title}</p>
                <p className="shrink-0 text-[11px] text-muted-foreground">{o.clientName}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/** Sección Clientes: escoge un cliente → calendario de crudos/editados,
 * cuándo agendar, y el mini-CRM de lo último que se dijo. */
function ClientsPanel({
  clients,
  clientLogos,
}: {
  clients: BancoClientPanel[]
  clientLogos: Record<string, string | null>
}) {
  const [selected, setSelected] = useState<string | null>(clients[0]?.clientId ?? null)
  const active = clients.find((c) => c.clientId === selected) ?? null

  if (clients.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-5 py-12 text-center text-sm text-muted-foreground">
        No hay clientes activos que enseñar.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {clients.map((c) => (
          <button
            key={c.clientId}
            type="button"
            onClick={() => setSelected(c.clientId)}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12px] transition-colors',
              selected === c.clientId
                ? 'border-primary/60 bg-primary/10 text-foreground'
                : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground',
            )}
          >
            <ClientLogo name={c.clientName} logoUrl={clientLogos[c.clientId] ?? null} className="h-5 w-5 text-[8px]" />
            {c.clientName}
          </button>
        ))}
      </div>

      {active && (
        <section data-testid={`client-panel-${active.clientId}`} className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
            <CalendarPlus className="h-4 w-4 shrink-0 text-primary" />
            <p className="text-sm">
              {active.nextSlotLabel ? (
                <>Favorable agendar para el <strong>{active.nextSlotLabel}</strong> — su próximo slot de posteo sin video.</>
              ) : (
                'Este cliente no tiene días de posteo configurados.'
              )}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
            {active.calendar.map((day) => (
              <div
                key={day.date}
                className={cn(
                  'min-h-24 rounded-lg border p-2',
                  day.isPostingDay ? 'border-primary/40 bg-primary/[0.04]' : 'border-border bg-card',
                )}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {formatDayES(day.date)}
                  {day.isPostingDay && <span className="ml-1 text-primary">·post</span>}
                </p>
                <ul className="mt-1 space-y-1">
                  {day.videos.map((v) => (
                    <li key={v.videoId} className="rounded border border-border bg-background/60 px-1.5 py-1">
                      <p className="truncate text-[10px] font-medium" title={v.ideaTitle}>{v.ideaTitle}</p>
                      <span
                        className={cn(
                          'text-[8px] font-semibold uppercase tracking-wide',
                          v.kind === 'edited' ? 'text-emerald-400' : 'text-amber-400',
                        )}
                      >
                        {v.kind === 'edited' ? 'Editado' : 'Crudo'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <section data-testid={`client-crm-${active.clientId}`} className="rounded-xl border border-border bg-card">
            <header className="flex items-center gap-2 border-b border-border px-4 py-3">
              <MessageSquareText className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Lo último</h2>
            </header>
            {active.latest.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12px] text-muted-foreground">Sin actividad reciente.</p>
            ) : (
              <ul className="divide-y divide-border">
                {active.latest.map((entry, i) => (
                  <li key={i} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5">
                    <p className="min-w-0 flex-1 truncate text-[12px]">{entry.text}</p>
                    <p className="shrink-0 whitespace-nowrap text-[10px] text-muted-foreground">
                      {entry.who ? `${entry.who} · ` : ''}{formatDayES(entry.when.slice(0, 10))}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </section>
      )}
    </div>
  )
}

function formatDayES(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-PR', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatDateES(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-PR', {
    weekday: 'long', day: 'numeric', month: 'short',
  })
}
