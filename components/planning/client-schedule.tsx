'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Sparkles, Loader2, Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { generateIdeaCaption } from '@/lib/actions/idea-captions'
import { useToast } from '@/lib/hooks/use-toast'

export interface ScheduleTask {
  publishDate: string // YYYY-MM-DD
  ideaId: string | null
  ideaTitle: string | null
  contentType: string | null
  hasCaption: boolean
}

function cadenceDates(postingDays: number[], days = 14): string[] {
  const out: string[] = []
  const today = new Date()
  for (let i = 0; i < days; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i)
    if (postingDays.includes(d.getDay())) out.push(d.toISOString().slice(0, 10))
  }
  return out
}

function fmt(date: string): string {
  const d = new Date(date + 'T12:00:00')
  return d.toLocaleDateString('es-PR', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function ClientSchedule({ postingDays, tasks }: { postingDays: number[]; tasks: ScheduleTask[] }) {
  const { toast } = useToast()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [captions, setCaptions] = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()

  // Slots = the client's cadence days + any dates with a scheduled video, over the next 2 weeks.
  const slots = Array.from(new Set([...cadenceDates(postingDays), ...tasks.map((t) => t.publishDate)])).sort()
  const byDate = new Map(tasks.map((t) => [t.publishDate, t]))

  if (slots.length === 0) {
    return <p className="px-4 py-3 text-xs text-muted-foreground">Sin cadencia ni videos programados para las próximas 2 semanas.</p>
  }

  function genCaption(ideaId: string) {
    setPendingId(ideaId)
    startTransition(async () => {
      const res = await generateIdeaCaption(ideaId)
      setPendingId(null)
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' })
      else if (res.caption) {
        setCaptions((c) => ({ ...c, [ideaId]: res.caption! }))
        toast({ title: 'Caption generado' })
      }
    })
  }

  return (
    <div className="overflow-x-auto px-4 pb-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pr-3 text-left font-medium">Día</th>
            <th className="py-2 pr-3 text-left font-medium">Tipo</th>
            <th className="py-2 pr-3 text-left font-medium">Idea del video</th>
            <th className="py-2 text-right font-medium">Caption</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {slots.map((s) => {
            const t = byDate.get(s)
            const idea = t?.ideaTitle
            const ideaId = t?.ideaId ?? null
            const generated = ideaId ? captions[ideaId] : undefined
            return (
              <tr key={s} className="align-top">
                <td className="whitespace-nowrap py-2.5 pr-3 font-medium capitalize">{fmt(s)}</td>
                <td className="py-2.5 pr-3 text-xs text-muted-foreground">{t?.contentType === 'R' ? 'Reel' : t?.contentType === 'P' ? 'Post' : '—'}</td>
                <td className="py-2.5 pr-3">
                  {idea ? (
                    <div className="space-y-1">
                      {ideaId ? (
                        <Link
                          href={`/produccion/idea/${ideaId}`}
                          className="line-clamp-2 font-medium text-primary hover:underline"
                        >
                          {idea}
                        </Link>
                      ) : (
                        <span className="line-clamp-2">{idea}</span>
                      )}
                      {generated && (
                        <div className="rounded-md border bg-muted/40 p-2 text-xs">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="font-medium text-muted-foreground">Caption</span>
                            <button
                              onClick={() => { navigator.clipboard?.writeText(generated); toast({ title: 'Copiado' }) }}
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              <Copy className="h-3 w-3" /> Copiar
                            </button>
                          </div>
                          <p className="whitespace-pre-wrap">{generated}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-amber-600">Falta video</span>
                  )}
                </td>
                <td className="py-2.5 text-right">
                  {ideaId ? (
                    <button
                      onClick={() => genCaption(ideaId)}
                      disabled={isPending && pendingId === ideaId}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-60"
                    >
                      {isPending && pendingId === ideaId ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : generated ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      {generated ? 'Regenerar' : 'Caption'}
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
