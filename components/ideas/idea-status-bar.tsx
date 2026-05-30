'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import type { IdeaPipeline, PipelineStageKey } from '@/lib/utils/idea-pipeline-stages'

/** What each pipeline stage means — shown in the per-stage info dialog. */
const STAGE_INFO: Record<PipelineStageKey, string> = {
  idea: 'La idea está definida con su hook y brief visual.',
  caption: 'El caption del video ya fue generado o escrito.',
  scheduled: 'La grabación está agendada en una sesión.',
  recorded: 'El material fue grabado y está en el buffer.',
  edited: 'El video fue editado / está en producción.',
  approval: 'El video fue aprobado para publicar.',
  published: 'El video fue publicado en redes.',
}

/** Anchor on the idea workspace page where you act on each stage. */
const STAGE_ANCHOR: Record<PipelineStageKey, string> = {
  idea: '#stage-idea',
  caption: '#stage-caption',
  scheduled: '#stage-material',
  recorded: '#stage-material',
  edited: '#stage-material',
  approval: '#stage-assets',
  published: '#stage-assets',
}

function stageState(pipeline: IdeaPipeline, index: number): 'done' | 'current' | 'pending' {
  if (pipeline.stages[index].done) return 'done'
  if (index === pipeline.currentIndex) return 'current'
  return 'pending'
}

const STATE_LABEL = { done: 'Completado', current: 'En curso', pending: 'Pendiente' } as const
const STATE_TONE = {
  done: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/30',
  current: 'text-primary bg-primary/10 border-primary/30',
  pending: 'text-muted-foreground bg-muted border-border',
} as const

/** Segmented status bar: one segment per pipeline stage. Clicking a segment
 * opens a dialog with details for that stage and the full pipeline. */
export function IdeaStatusBar({ pipeline, title, ideaId }: { pipeline: IdeaPipeline; title?: string; ideaId?: string }) {
  const { stages, currentIndex, completed } = pipeline
  const current = currentIndex < stages.length ? stages[currentIndex] : null
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1">
        {stages.map((s, i) => (
          <button
            key={s.key}
            type="button"
            data-testid="stage-segment"
            title={`${s.label} — ${STATE_LABEL[stageState(pipeline, i)]}`}
            aria-label={`${s.label}: ${STATE_LABEL[stageState(pipeline, i)]}`}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenIndex(i) }}
            className={cn(
              'h-1.5 flex-1 cursor-pointer rounded-full transition-colors hover:opacity-80',
              s.done ? 'bg-emerald-500' : i === currentIndex ? 'bg-primary animate-pulse' : 'bg-muted',
            )}
          />
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {current ? (
          <>En <span className="font-medium text-foreground">{current.label}</span></>
        ) : (
          <span className="font-medium text-emerald-600">Completado</span>
        )}
        <span className="tabular-nums"> · {completed}/{stages.length}</span>
      </p>

      <Dialog open={openIndex !== null} onOpenChange={(v) => !v && setOpenIndex(null)}>
        <DialogContent className="sm:max-w-sm">
          {openIndex !== null && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
                  {stages[openIndex].label}
                  <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', STATE_TONE[stageState(pipeline, openIndex)])}>
                    {STATE_LABEL[stageState(pipeline, openIndex)]}
                  </span>
                </DialogTitle>
              </DialogHeader>
              {title && <p className="-mt-1 text-xs text-muted-foreground">{title}</p>}
              <DialogDescription className="text-sm text-muted-foreground">
                {STAGE_INFO[stages[openIndex].key]}
              </DialogDescription>

              {/* Full pipeline checklist for context */}
              <ol className="mt-1 space-y-1.5">
                {stages.map((st, i) => {
                  const state = stageState(pipeline, i)
                  return (
                    <li
                      key={st.key}
                      className={cn(
                        'flex items-center gap-2 rounded-md px-2 py-1 text-xs',
                        i === openIndex && 'bg-muted',
                      )}
                    >
                      <span className={cn(
                        'grid h-4 w-4 shrink-0 place-items-center rounded-full',
                        state === 'done' ? 'bg-emerald-500 text-white' : state === 'current' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                      )}>
                        {state === 'done' ? <Check className="h-2.5 w-2.5" /> : <span className="text-[9px] tabular-nums">{i + 1}</span>}
                      </span>
                      <span className={cn(state === 'pending' && 'text-muted-foreground')}>{st.label}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground">{STATE_LABEL[state]}</span>
                    </li>
                  )
                })}
              </ol>

              {ideaId && (
                <Link
                  href={`/produccion/idea/${ideaId}${STAGE_ANCHOR[stages[openIndex].key]}`}
                  className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-transform hover:scale-[1.02]"
                >
                  Trabajar en este paso <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
