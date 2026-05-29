'use client'

import Link from 'next/link'
import { Calendar, CalendarCheck, Film } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { ClientLogo } from '@/components/clients/client-logo'
import { IdeaStatusBar } from './idea-status-bar'
import { computeIdeaPipeline } from '@/lib/utils/idea-pipeline-stages'
import type { IdeaWithPipeline, ContentIdeaType } from '@/lib/supabase/types'

const TYPE_LABEL: Record<ContentIdeaType, string> = { R: 'Reel', P: 'Post', C: 'Carrusel', S: 'Story' }
const TYPE_TONE: Record<ContentIdeaType, string> = {
  R: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
  P: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  C: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  S: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
}

function fmtDate(value: string | null): string {
  if (!value) return '—'
  // Date-only columns parse as UTC midnight; render the calendar day in local time.
  const d = new Date(value.length <= 10 ? value + 'T00:00:00' : value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-PR', { day: 'numeric', month: 'short' })
}

interface ClientGroup {
  id: string
  name: string
  logoUrl: string | null
  ideas: IdeaWithPipeline[]
}

function groupByClient(ideas: IdeaWithPipeline[]): ClientGroup[] {
  const map = new Map<string, ClientGroup>()
  for (const idea of ideas) {
    const id = idea.client_id
    if (!map.has(id)) {
      map.set(id, { id, name: idea.client?.name ?? 'Sin cliente', logoUrl: idea.client?.logo_url ?? null, ideas: [] })
    }
    map.get(id)!.ideas.push(idea)
  }
  return Array.from(map.values())
}

export function ClientIdeasRows({ ideas }: { ideas: IdeaWithPipeline[] }) {
  const groups = groupByClient(ideas)

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section key={g.id} className="rounded-xl border bg-card animate-in fade-in duration-300">
          <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b p-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <ClientLogo name={g.name} logoUrl={g.logoUrl} className="h-8 w-8 text-[10px]" />
              <Link href={`/clients/${g.id}`} className="truncate text-sm font-bold tracking-tight hover:text-primary">
                {g.name}
              </Link>
            </div>
            <Badge variant="secondary" className="shrink-0 whitespace-nowrap tabular-nums">
              {g.ideas.length} {g.ideas.length === 1 ? 'video' : 'videos'}
            </Badge>
          </header>

          {g.ideas.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              <Film className="mx-auto mb-1 h-5 w-5 text-muted-foreground/50" /> Sin videos
            </div>
          ) : (
            <div className="divide-y">
              {g.ideas.map((idea) => (
                <IdeaRow key={idea.id} idea={idea} />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  )
}

function IdeaRow({ idea }: { idea: IdeaWithPipeline }) {
  const pipeline = computeIdeaPipeline({
    idea,
    videos: idea.videos,
    recordingScheduled: idea.recordingScheduled,
  })
  const typeCfg = TYPE_LABEL[idea.content_type] ?? idea.content_type

  return (
    <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Badge variant="outline" className={cn('shrink-0 whitespace-nowrap text-[10px]', TYPE_TONE[idea.content_type])}>
          {typeCfg}
        </Badge>
        <Link
          href={`/produccion/idea/${idea.id}`}
          className="truncate text-sm font-medium hover:text-primary"
        >
          {idea.title || 'Sin título'}
        </Link>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground sm:w-40">
        <span className="inline-flex items-center gap-1" title="Grabación">
          <Calendar className="h-3 w-3" /> {fmtDate(idea.recording_date)}
        </span>
        <span className="inline-flex items-center gap-1" title="Publicación">
          <CalendarCheck className="h-3 w-3" /> {fmtDate(idea.publish_date)}
        </span>
      </div>

      <div className="w-full shrink-0 sm:w-64">
        <IdeaStatusBar pipeline={pipeline} />
      </div>
    </div>
  )
}
