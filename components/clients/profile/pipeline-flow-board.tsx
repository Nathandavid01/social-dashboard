import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn, formatDate } from '@/lib/utils'
import type { ContentIdea } from '@/lib/supabase/types'

const STAGES = [
  { key: 'idea', label: 'Idea' },
  { key: 'grabado', label: 'Grabado' },
  { key: 'editado', label: 'Editado' },
  { key: 'caption', label: 'Caption' },
  { key: 'publicado', label: 'Publicado' },
] as const
type StageKey = (typeof STAGES)[number]['key']

const TYPE_LABEL: Record<string, string> = { R: 'Reel', P: 'Post', C: 'Carrusel', S: 'Story' }

/** Days without activity (updated_at) after which a non-published video is flagged stale. */
export const STALE_DAYS = 7

/** Whether a given pipeline stage is complete for an idea. */
export function stageDone(idea: ContentIdea, key: StageKey): boolean {
  switch (key) {
    case 'idea':
      return true
    case 'grabado':
      return ['grabada', 'producida', 'publicada'].includes(idea.status)
    case 'editado':
      return ['producida', 'publicada'].includes(idea.status)
    case 'caption':
      return !!idea.generated_caption
    case 'publicado':
      return idea.status === 'publicada'
  }
}

/** The column a video belongs in: its furthest-reached stage. */
export function currentStage(idea: ContentIdea): StageKey {
  if (idea.status === 'publicada') return 'publicado'
  if (idea.status === 'producida') return idea.generated_caption ? 'caption' : 'editado'
  if (idea.status === 'grabada') return 'grabado'
  return 'idea'
}

/**
 * A non-published video is overdue when EITHER its publish_date is in the past,
 * OR it has gone STALE_DAYS without activity (updated_at). updated_at is an
 * approximation of "no progress" — there is no per-stage history to query.
 */
export function isOverdue(idea: ContentIdea, now: Date = new Date()): boolean {
  if (idea.status === 'publicada') return false
  if (idea.publish_date) {
    const pd = new Date(`${idea.publish_date}T23:59:59`)
    if (!Number.isNaN(pd.getTime()) && pd.getTime() < now.getTime()) return true
  }
  if (idea.updated_at) {
    const u = new Date(idea.updated_at)
    if (!Number.isNaN(u.getTime()) && now.getTime() - u.getTime() > STALE_DAYS * 86_400_000) return true
  }
  return false
}

/** Per-client production flow as a Kanban board — one column per stage, one card per video. */
export function PipelineFlowBoard({ ideas }: { ideas: ContentIdea[] }) {
  const visible = ideas.filter((i) => i.status !== 'descartada')

  if (visible.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Sin videos en el pipeline todavía.
        </CardContent>
      </Card>
    )
  }

  const now = new Date()
  const byStage: Record<StageKey, ContentIdea[]> = { idea: [], grabado: [], editado: [], caption: [], publicado: [] }
  for (const idea of visible) byStage[currentStage(idea)].push(idea)

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-[760px] gap-3">
        {STAGES.map((s) => {
          const cards = byStage[s.key]
          const overdueCount = cards.filter((i) => isOverdue(i, now)).length
          return (
            <div key={s.key} className="min-w-[148px] flex-1">
              <div className="mb-2 flex items-center justify-between gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span className="truncate">{s.label}</span>
                <span className="inline-flex shrink-0 items-center gap-1 tabular-nums">
                  {overdueCount > 0 && <AlertTriangle className="h-3 w-3 text-amber-500" aria-label={`${overdueCount} atrasado`} />}
                  {cards.length}
                </span>
              </div>
              <div className="min-h-[56px] space-y-2 rounded-lg bg-muted/30 p-2">
                {cards.length === 0 ? (
                  <p className="py-2 text-center text-[11px] text-muted-foreground/50">·</p>
                ) : (
                  cards.map((idea) => <FlowCard key={idea.id} idea={idea} overdue={isOverdue(idea, now)} />)
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FlowCard({ idea, overdue }: { idea: ContentIdea; overdue: boolean }) {
  const dateStr = idea.publish_date ?? idea.created_at
  return (
    <Link
      href={`/produccion/idea/${idea.id}`}
      className={cn(
        'block rounded-md border bg-background p-2 transition-colors hover:border-primary hover:bg-accent',
        overdue && 'border-amber-500/50 bg-amber-500/5',
      )}
    >
      <div className="flex items-start justify-between gap-1.5">
        <span className="line-clamp-2 text-xs font-medium">{idea.title}</span>
        {overdue && <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" aria-label="atrasado" />}
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <span className="rounded bg-muted px-1 py-0.5">{TYPE_LABEL[idea.content_type] ?? idea.content_type}</span>
        {dateStr && <span className="tabular-nums">{formatDate(dateStr)}</span>}
      </div>
      <div className="mt-1.5 flex items-center gap-1" aria-label="progreso por etapa">
        {STAGES.map((s) => (
          <span
            key={s.key}
            className={cn('h-1.5 w-1.5 rounded-full', stageDone(idea, s.key) ? 'bg-green-500' : 'bg-muted-foreground/25')}
          />
        ))}
      </div>
    </Link>
  )
}
