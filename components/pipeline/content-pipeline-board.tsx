'use client'

import { memo, useCallback, useMemo, useState, useTransition } from 'react'
import { Search, Filter, LayoutGrid, Plus, Calendar, Film, ChevronDown, Play, Check, CheckCircle2, Clock, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { PlatformBadges } from '@/components/clients/platform-badges'
import { PIPELINE_STAGES, computeStage, adjacentStage, type PipelineStageKey } from '@/lib/utils/pipeline-stages'
import { moveIdeaStage } from '@/lib/actions/content-ideas'
import { useToast } from '@/lib/hooks/use-toast'
import { clientAccent } from '@/lib/utils/client-accent'
import { IdeaDetailSheet } from '@/components/clients/profile/idea-detail-sheet'
import { NewVideoDialog } from './new-video-dialog'
import type { IdeaWithPipeline } from '@/lib/supabase/types'

const TYPE_LABEL: Record<string, string> = { R: 'Reel', P: 'Post', C: 'Carrusel', S: 'Story' }

type Card = IdeaWithPipeline

/** Global, multi-client content pipeline board (reference: Content Pipeline Board). */
export function ContentPipelineBoard({ ideas }: { ideas: Card[] }) {
  const [clientFilter, setClientFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [overrides, setOverrides] = useState<Record<string, PipelineStageKey>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [, startMove] = useTransition()
  const { toast } = useToast()

  const stageOf = useCallback(
    (i: Card): PipelineStageKey => overrides[i.id] ?? computeStage(i),
    [overrides],
  )

  const moveCard = useCallback(
    (card: Card, dir: 1 | -1) => {
      const cur = stageOf(card)
      const target = adjacentStage(cur, dir)
      if (!target) return
      setOverrides((o) => ({ ...o, [card.id]: target }))
      startMove(async () => {
        const res = await moveIdeaStage(card.id, target)
        if (res?.error) {
          setOverrides((o) => ({ ...o, [card.id]: cur }))
          toast({ title: 'No se pudo mover', description: res.error, variant: 'destructive' })
        }
      })
    },
    [stageOf, toast],
  )

  const clients = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>()
    for (const i of ideas) {
      const c = i.client
      if (!c) continue
      const e = map.get(c.id) ?? { id: c.id, name: c.name, count: 0 }
      e.count++
      map.set(c.id, e)
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [ideas])

  const team = useMemo(() => {
    const m = new Map<string, { id: string; name: string }>()
    for (const i of ideas) {
      if (i.assignee) m.set(i.assignee.id, { id: i.assignee.id, name: i.assignee.full_name ?? '?' })
    }
    return Array.from(m.values())
  }, [ideas])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return ideas.filter((i) => {
      if (i.status === 'descartada') return false
      if (clientFilter && i.client?.id !== clientFilter) return false
      if (q && !(`${i.title} ${i.hook ?? ''} ${i.client?.name ?? ''}`.toLowerCase().includes(q))) return false
      return true
    })
  }, [ideas, clientFilter, search])

  const byStage = useMemo(() => {
    const out = { title: [], idea: [], caption: [], video: [], edited: [], approval: [], publication: [] } as Record<PipelineStageKey, Card[]>
    for (const i of visible) out[stageOf(i)].push(i)
    return out
  }, [visible, stageOf])
  const published = visible.filter((i) => i.published_at || i.status === 'publicada').length
  const overdue = visible.filter(
    (i) => !i.published_at && i.status !== 'publicada' && i.publish_date && new Date(`${i.publish_date}T23:59:59`) < new Date(),
  ).length

  return (
    <div className="dark flex h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-[#0a0a0b] text-foreground">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-amber-600 text-[13px] font-bold text-black shadow-lg shadow-primary/20">
            N
          </div>
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold leading-tight tracking-tight">Content Pipeline</h1>
            <p className="text-[11px] text-muted-foreground">Nate Media · todos los clientes</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative hidden sm:block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar videos, clientes…"
              className="h-8 w-52 rounded-md border border-white/[0.08] bg-white/[0.03] pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/70 focus:border-primary/50 focus:outline-none"
            />
          </div>
          <HeaderButton icon={Filter} label="Filtros" />
          <HeaderButton icon={LayoutGrid} label="Agrupar" trailing={ChevronDown} />
          <NewVideoDialog clients={clients} />
          {team.length > 0 && (
            <div className="ml-1 hidden items-center -space-x-1.5 lg:flex" aria-label="Equipo">
              {team.slice(0, 4).map((t) => (
                <span
                  key={t.id}
                  title={t.name}
                  className="grid h-7 w-7 place-items-center rounded-full border-2 border-[#0a0a0b] bg-white/[0.1] text-[10px] font-bold text-foreground"
                >
                  {t.name.slice(0, 1).toUpperCase()}
                </span>
              ))}
              {team.length > 4 && (
                <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-[#0a0a0b] bg-white/[0.06] text-[9px] font-semibold text-muted-foreground">
                  +{team.length - 4}
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Client chips + stats */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-5 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip active={clientFilter === null} onClick={() => setClientFilter(null)} dot="#3b82f6" label="Todos" count={visible.length} />
          {clients.map((c) => {
            const a = clientAccent(c.id)
            return (
              <Chip
                key={c.id}
                active={clientFilter === c.id}
                onClick={() => setClientFilter(clientFilter === c.id ? null : c.id)}
                dot={a.dot}
                label={c.name}
                count={c.count}
              />
            )
          })}
        </div>
        <p className="text-[11px] tabular-nums text-muted-foreground">
          <span className="text-foreground">{visible.length}</span> videos ·{' '}
          <span className="text-emerald-400">{published}</span> publicados
          {overdue > 0 && (
            <>
              {' '}· <span className="text-amber-400">{overdue}</span> atrasados
            </>
          )}
        </p>
      </div>

      {/* Columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full min-w-max gap-3 p-4">
          {PIPELINE_STAGES.map((stage) => (
            <StageColumn key={stage.key} stageKey={stage.key} label={stage.label} cards={byStage[stage.key]} onMove={moveCard} onOpen={setSelectedId} />
          ))}
        </div>
      </div>

      <IdeaDetailSheet
        ideaId={selectedId}
        open={selectedId != null}
        onOpenChange={(o) => { if (!o) setSelectedId(null) }}
      />
    </div>
  )
}

const STAGE_DOT: Record<PipelineStageKey, string> = {
  title: '#64748b', idea: '#3b82f6', caption: '#a855f7', video: '#06b6d4',
  edited: '#8b5cf6', approval: '#f59e0b', publication: '#10b981',
}

function StageColumn({ stageKey, label, cards, onMove, onOpen }: { stageKey: PipelineStageKey; label: string; cards: Card[]; onMove: (card: Card, dir: 1 | -1) => void; onOpen: (id: string) => void }) {
  return (
    <section className="flex h-full w-[268px] flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STAGE_DOT[stageKey] }} />
          <h2 className="text-[12px] font-semibold tracking-tight">{label}</h2>
          <span className="rounded-full bg-white/[0.06] px-1.5 text-[10px] font-medium tabular-nums text-muted-foreground">
            {cards.length}
          </span>
        </div>
        <button className="grid h-5 w-5 place-items-center rounded text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto rounded-lg bg-white/[0.015] p-2">
        {cards.length === 0 ? (
          <p className="select-none py-6 text-center text-[11px] text-muted-foreground/40">—</p>
        ) : (
          cards.map((card) => <PipelineCard key={card.id} card={card} stage={stageKey} onMove={onMove} onOpen={onOpen} />)
        )}
      </div>
    </section>
  )
}

const SHOW_THUMB: Record<PipelineStageKey, boolean> = {
  title: false, idea: false, caption: false, video: true, edited: true, approval: true, publication: true,
}

const PipelineCard = memo(function PipelineCard({ card, stage, onMove, onOpen }: { card: Card; stage: PipelineStageKey; onMove: (card: Card, dir: 1 | -1) => void; onOpen: (id: string) => void }) {
  const a = clientAccent(card.client?.id)
  const videoCount = card.videos?.length ?? 0
  const platforms = card.client?.platforms ?? []
  const dateStr = card.publish_date ?? card.created_at
  const thumb = card.videos?.find((v) => v.drive_thumb_url)?.drive_thumb_url ?? null
  const canBack = adjacentStage(stage, -1) !== null
  const canFwd = adjacentStage(stage, 1) !== null

  return (
    <article
      onClick={() => onOpen(card.id)}
      className="group relative cursor-pointer overflow-hidden rounded-lg border border-white/[0.06] bg-[#141416] transition-all hover:border-white/[0.14] hover:bg-[#17171a]"
      style={{ boxShadow: 'inset 3px 0 0 0 ' + a.dot }}
    >
      {/* move controls (appear on hover) */}
      <div className="absolute right-1.5 top-1.5 z-10 flex gap-1 opacity-0 transition group-hover:opacity-100">
        <MoveBtn dir={-1} disabled={!canBack} onClick={(e) => { e.stopPropagation(); onMove(card, -1) }} />
        <MoveBtn dir={1} disabled={!canFwd} onClick={(e) => { e.stopPropagation(); onMove(card, 1) }} />
      </div>
      {SHOW_THUMB[stage] && <CardThumb thumb={thumb} accent={a.dot} />}

      <div className="space-y-2 p-2.5 pl-3">
        {/* client chip */}
        <div className="flex items-center justify-between gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: a.soft, color: a.text }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: a.dot }} />
            {card.client?.name ?? 'Sin cliente'}
          </span>
          <span className="rounded bg-white/[0.06] px-1 py-0.5 text-[9px] font-medium text-muted-foreground">
            {TYPE_LABEL[card.content_type] ?? card.content_type}
          </span>
        </div>

        {/* title + hook */}
        <div>
          <h3 className="text-[13px] font-semibold leading-snug tracking-tight text-foreground">{card.title}</h3>
          {card.hook && <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{card.hook}</p>}
        </div>

        {/* tags */}
        {(() => {
          const tags = (card.hashtags_suggestion ?? '')
            .split(/[\s,]+/)
            .map((t) => t.replace(/^#/, '').trim())
            .filter(Boolean)
            .slice(0, 3)
          return tags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {tags.map((t) => (
                <span key={t} className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                  #{t}
                </span>
              ))}
            </div>
          ) : null
        })()}

        {stage === 'edited' && <QcChecklist card={card} />}
        {stage === 'approval' && <ApprovalRow card={card} accent={a.dot} />}
        {stage === 'publication' && <PublicationRow card={card} />}

        {/* footer */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex items-center gap-1.5 [&_svg]:h-3.5 [&_svg]:w-3.5">
            {platforms.length > 0 && <PlatformBadges platforms={platforms.slice(0, 4)} />}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            {videoCount > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <Film className="h-3 w-3" /> {videoCount}
              </span>
            )}
            {dateStr && (
              <span className="inline-flex items-center gap-0.5 tabular-nums">
                <Calendar className="h-3 w-3" /> {formatDate(dateStr)}
              </span>
            )}
            {card.assignee && (
              <span
                className="grid h-4 w-4 place-items-center rounded-full text-[8px] font-bold text-black"
                style={{ backgroundColor: a.dot }}
                title={card.assignee.full_name ?? ''}
              >
                {(card.assignee.full_name ?? '?').slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  )
})

function MoveBtn({ dir, disabled, onClick }: { dir: 1 | -1; disabled: boolean; onClick: (e: React.MouseEvent) => void }) {
  const Icon = dir === 1 ? ChevronRight : ChevronLeft
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 1 ? 'Mover adelante' : 'Mover atrás'}
      className="grid h-5 w-5 place-items-center rounded border border-white/10 bg-black/50 text-muted-foreground backdrop-blur-sm transition hover:bg-black/70 hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  )
}

function CardThumb({ thumb, accent }: { thumb: string | null; accent: string }) {
  return (
    <div
      className="relative aspect-[16/10] w-full overflow-hidden"
      style={!thumb ? { background: `linear-gradient(135deg, ${accent}cc, ${accent}33 60%, #0a0a0b)` } : undefined}
    >
      {thumb && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt="" className="h-full w-full object-cover" />
      )}
      <div className="absolute inset-0 grid place-items-center">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-black/40 backdrop-blur-sm ring-1 ring-white/20 transition group-hover:scale-110">
          <Play className="h-4 w-4 translate-x-px fill-white text-white" />
        </span>
      </div>
    </div>
  )
}

function QcChecklist({ card }: { card: Card }) {
  const items = [
    { label: 'Caption', done: !!card.generated_caption },
    { label: 'Editado', done: (card.videos ?? []).some((v) => v.kind === 'edited') },
    { label: 'Aprobado', done: card.approval_status === 'approved' },
  ]
  const done = items.filter((i) => i.done).length
  return (
    <div className="space-y-1.5 rounded-md bg-white/[0.03] p-2">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="font-medium">Checklist QC</span>
        <span className="tabular-nums">{done}/{items.length}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {items.map((it) => (
          <span
            key={it.label}
            className={cn(
              'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]',
              it.done ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/[0.04] text-muted-foreground',
            )}
          >
            <Check className={cn('h-2.5 w-2.5', !it.done && 'opacity-30')} /> {it.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function ApprovalRow({ card, accent }: { card: Card; accent: string }) {
  const map = {
    approved: { label: 'Aprobado', tone: 'bg-emerald-500/15 text-emerald-400', icon: CheckCircle2 },
    submitted: { label: 'En revisión', tone: 'bg-sky-500/15 text-sky-400', icon: Clock },
    revision_needed: { label: 'Necesita cambios', tone: 'bg-amber-500/15 text-amber-400', icon: Clock },
    pending: { label: 'Sin enviar', tone: 'bg-white/[0.06] text-muted-foreground', icon: Clock },
  } as const
  const s = map[card.approval_status as keyof typeof map] ?? map.pending
  const Icon = s.icon
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', s.tone)}>
        <Icon className="h-3 w-3" /> {s.label}
      </span>
      {card.assignee && (
        <span className="grid h-5 w-5 place-items-center rounded-full text-[9px] font-bold text-black" style={{ backgroundColor: accent }} title={card.assignee.full_name ?? ''}>
          {(card.assignee.full_name ?? '?').slice(0, 1).toUpperCase()}
        </span>
      )}
    </div>
  )
}

function PublicationRow({ card }: { card: Card }) {
  const published = !!card.published_at || card.status === 'publicada'
  const scheduled = !published && !!card.publish_date
  const badge = published
    ? { label: 'Publicado', tone: 'bg-emerald-500/15 text-emerald-400', icon: CheckCircle2 }
    : scheduled
      ? { label: 'Programado', tone: 'bg-sky-500/15 text-sky-400', icon: Calendar }
      : { label: 'Listo', tone: 'bg-violet-500/15 text-violet-400', icon: Sparkles }
  const Icon = badge.icon
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', badge.tone)}>
        <Icon className="h-3 w-3" /> {badge.label}
      </span>
      {/* métricas reales (Metricool) llegan en la Fase 4 */}
      <span className="text-[10px] text-muted-foreground/50">— vistas</span>
    </div>
  )
}

function Chip({ active, onClick, dot, label, count }: { active: boolean; onClick: () => void; dot: string; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition',
        active ? 'border-white/20 bg-white/[0.08] text-foreground' : 'border-white/[0.06] text-muted-foreground hover:bg-white/[0.04] hover:text-foreground',
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dot }} />
      {label}
      <span className="tabular-nums opacity-60">{count}</span>
    </button>
  )
}

function HeaderButton({ icon: Icon, label, trailing: Trailing }: { icon: typeof Filter; label: string; trailing?: typeof ChevronDown }) {
  return (
    <button className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 text-xs text-muted-foreground transition hover:bg-white/[0.05] hover:text-foreground">
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden md:inline">{label}</span>
      {Trailing && <Trailing className="h-3 w-3 opacity-60" />}
    </button>
  )
}
