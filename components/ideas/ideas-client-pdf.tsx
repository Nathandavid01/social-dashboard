'use client'

import { useMemo, useState } from 'react'
import type { ApprovedIdea } from '@/lib/actions/idea-feedback-types'
import type { ContentIdeaType } from '@/lib/supabase/types'
import { DownloadPdfButton } from '@/components/reportes/download-pdf-button'

const TYPE_LABEL: Record<ContentIdeaType, string> = {
  R: 'Reel',
  P: 'Post',
  C: 'Carrusel',
  S: 'Story',
}

function todayStamp(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function slugify(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'cliente'
  )
}

function formatDisplayDate(): string {
  return new Date().toLocaleDateString('es-PR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Client-facing PDF export for approved ideas.
 * Reuses DownloadPdfButton (html2canvas + jspdf); only client-safe fields.
 */
export function IdeasClientPdf({ ideas }: { ideas: ApprovedIdea[] }) {
  const [clientFilter, setClientFilter] = useState<string>('todos')

  const clients = useMemo(() => {
    const map = new Map<string, string>()
    for (const idea of ideas) {
      if (idea.client_id && idea.client?.name) {
        map.set(idea.client_id, idea.client.name)
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [ideas])

  const filtered = useMemo(() => {
    if (clientFilter === 'todos') return ideas
    return ideas.filter((i) => i.client_id === clientFilter)
  }, [ideas, clientFilter])

  const selectedClientName =
    clientFilter === 'todos' ? null : (clients.find((c) => c.id === clientFilter)?.name ?? null)

  const fileName =
    clientFilter === 'todos'
      ? `ideas-todas-${todayStamp()}.pdf`
      : `ideas-${slugify(selectedClientName ?? 'cliente')}-${todayStamp()}.pdf`

  const grouped = useMemo(() => {
    if (clientFilter !== 'todos') {
      return [{ clientName: selectedClientName, ideas: filtered }]
    }
    const byClient = new Map<string, { clientName: string | null; ideas: ApprovedIdea[] }>()
    for (const idea of filtered) {
      const key = idea.client_id ?? '__none__'
      const existing = byClient.get(key)
      if (existing) {
        existing.ideas.push(idea)
      } else {
        byClient.set(key, { clientName: idea.client?.name ?? null, ideas: [idea] })
      }
    }
    return Array.from(byClient.values()).sort((a, b) =>
      (a.clientName ?? '').localeCompare(b.clientName ?? '', 'es'),
    )
  }, [filtered, clientFilter, selectedClientName])

  if (ideas.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          Cliente
          <select
            className="h-9 max-w-[220px] rounded-lg border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
          >
            <option value="todos">Todos</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <DownloadPdfButton targetId="ideas-pdf-document" fileName={fileName} />
      </div>

      <div
        id="ideas-pdf-document"
        className="mx-auto max-w-4xl rounded-2xl border bg-white p-8 text-zinc-900 shadow-sm print:border-0 print:shadow-none sm:p-10"
      >
        <header className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">
              Ideas de contenido
            </p>
            <h1 className="text-2xl font-bold tracking-tight">
              {selectedClientName ?? 'Todas las ideas aprobadas'}
            </h1>
            <p className="text-sm text-zinc-500">{formatDisplayDate()}</p>
          </div>
          <div className="hidden text-right sm:block">
            <p className="text-lg font-extrabold tracking-tight">
              Nate <span className="text-amber-500">Media</span>
            </p>
            <p className="text-xs text-zinc-400">Operaciones de contenido</p>
          </div>
        </header>

        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-zinc-500">
            No hay ideas para el filtro seleccionado.
          </p>
        ) : (
          <div className="space-y-8 pt-6">
            {grouped.map((group) => (
              <section key={group.clientName ?? '__none__'}>
                {clientFilter === 'todos' && group.clientName && (
                  <h2 className="mb-4 border-b border-zinc-100 pb-2 text-sm font-bold uppercase tracking-wide text-zinc-500">
                    {group.clientName}
                  </h2>
                )}
                <div className="space-y-4">
                  {group.ideas.map((idea) => (
                    <IdeaPdfBlock key={idea.id} idea={idea} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <footer className="mt-8 border-t border-zinc-200 pt-4 text-center text-[11px] text-zinc-400">
          Generado por Nate Media · Ideas aprobadas · {formatDisplayDate()}
        </footer>
      </div>
    </div>
  )
}

function IdeaPdfBlock({ idea }: { idea: ApprovedIdea }) {
  const typeLabel = TYPE_LABEL[idea.content_type] ?? idea.content_type
  const meta =
    idea.objective && idea.funnel_stage
      ? `${idea.objective} · ${idea.funnel_stage}`
      : (idea.objective ?? idea.funnel_stage ?? null)

  return (
    <article className="rounded-xl border border-zinc-200 bg-zinc-50 p-5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="inline-flex rounded-md bg-zinc-900 px-2 py-0.5 text-[11px] font-semibold text-white">
          {typeLabel}
        </span>
        {meta && <span className="text-[11px] font-medium text-zinc-500">{meta}</span>}
      </div>
      <h3 className="text-base font-bold tracking-tight text-zinc-900">{idea.title}</h3>
      {idea.objective && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          <p className="font-semibold">Objetivo · Qué queremos lograr</p>
          <p className="mt-0.5 leading-relaxed">{idea.objective}</p>
        </div>
      )}
      {idea.hook && <p className="mt-2 text-sm font-medium text-zinc-800">{idea.hook}</p>}
      <dl className="mt-3 space-y-2 text-xs text-zinc-600">
        {idea.visual_brief && (
          <div>
            <dt className="font-semibold text-zinc-900">Brief visual</dt>
            <dd className="mt-0.5 leading-relaxed">{idea.visual_brief}</dd>
          </div>
        )}
        {idea.caption_angle && (
          <div>
            <dt className="font-semibold text-zinc-900">Ángulo del caption</dt>
            <dd className="mt-0.5 leading-relaxed">{idea.caption_angle}</dd>
          </div>
        )}
      </dl>
      {idea.hashtags_suggestion && (
        <p className="mt-3 text-[11px] font-medium text-amber-700">{idea.hashtags_suggestion}</p>
      )}
    </article>
  )
}
