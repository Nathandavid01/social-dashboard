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
import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Clapperboard, Film, RotateCcw, UserRound } from 'lucide-react'
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
import type { BankClientRail, BankVideoTile, VideoBank } from '@/lib/pipeline/video-bank'
import type { ProjectedCalendar } from '@/lib/pipeline/projected-calendar'
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

export interface BancoViewProps {
  bank: VideoBank
  calendar: ProjectedCalendar
  devueltos: BancoDevuelto[]
  editors: BancoEditorStat[]
  teamEditors: Array<{ id: string; name: string }>
  clientLogos: Record<string, string | null>
}

export function BancoView({ bank, calendar, devueltos, editors, teamEditors, clientLogos }: BancoViewProps) {
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
        <TabsList className="shrink-0">
          <TabsTrigger value="banco">
            <Film className="mr-1.5 h-3.5 w-3.5" /> Banco
          </TabsTrigger>
          <TabsTrigger value="calendario">
            <CalendarDays className="mr-1.5 h-3.5 w-3.5" /> Calendario
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="banco" className="space-y-4">
        {editors.length > 0 && <EditorStrip editors={editors} />}
        {devueltos.length > 0 && <Devueltos items={devueltos} />}
        {bank.rails.length === 0 ? (
          <div className="flex items-center justify-center rounded-xl border border-border bg-card px-5 py-16 text-center">
            <p className="max-w-sm text-sm text-muted-foreground">
              No hay crudos pendientes en el banco. Lo aprobado ya salió hacia el calendario de posteo.
            </p>
          </div>
        ) : (
          bank.rails.map((rail) => (
            <ClientRail
              key={rail.clientId}
              rail={rail}
              logoUrl={clientLogos[rail.clientId] ?? rail.logoUrl}
              teamEditors={teamEditors}
            />
          ))
        )}
      </TabsContent>

      <TabsContent value="calendario" className="space-y-4">
        <ProjectedCalendarView calendar={calendar} />
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
            <p className="mt-2 text-[11px] text-muted-foreground">
              {rate === null ? 'Sin historial todavía' : (
                <>Aprobación <strong className="text-foreground">{rate}%</strong> · {ed.approved} aprobados · {ed.returned} devueltos</>
              )}
              {' · '}cola: {ed.queueCount}
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
}: {
  rail: BankClientRail
  logoUrl: string | null
  teamEditors: Array<{ id: string; name: string }>
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
      <CoverGrid videos={rail.videos} teamEditors={teamEditors} />
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
