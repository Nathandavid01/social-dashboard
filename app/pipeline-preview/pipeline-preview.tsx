'use client'

import { useState } from 'react'
import { ContentPipelineBoard } from '@/components/pipeline/content-pipeline-board'
import { ReviewQueue, type QueueVideo } from '@/components/review/review-queue'
import { SubmitVideoCard, type SubmitVideoPayload } from '@/components/pipeline/submit-video-card'
import { STAGE_LABEL_ES, BATCH_STAGES } from '@/lib/utils/content-batches'
import { clientsForUser, type AssignableClient } from '@/lib/utils/client-visibility'
import { Button } from '@/components/ui/button'
import type { IdeaWithPipeline, SocialPlatform, UserRole } from '@/lib/supabase/types'

/** Sample card. Only the fields the board reads are meaningful. */
function idea(over: Partial<IdeaWithPipeline> = {}): IdeaWithPipeline {
  return {
    id: 'i', client_id: 'c1', content_type: 'R', title: 'Video',
    hook: null, visual_brief: null, caption_angle: null, hashtags_suggestion: null, rationale: null,
    status: 'idea', production_task_id: null, recording_session_id: null, theme: null,
    generation_prompt: null, model: null, generated_caption: null, caption_platform: null, caption_generated_at: null,
    published_at: null, approval_status: 'pending', approved_by: null, approved_at: null, submitted_at: null,
    recording_date: null, publish_date: null, created_by: null,
    created_at: '2026-07-01', updated_at: '2026-07-20',
    recordingScheduled: false, videos: [], assignee: null,
    client: { id: 'c1', name: 'Cliente', industry: null, platforms: ['instagram'] },
    ...over,
  } as IdeaWithPipeline
}

function client(id: string, name: string) {
  return { id, name, industry: null, platforms: ['instagram'] as SocialPlatform[] }
}

/** One client parked in each column, so all five stages are populated. */
const SAMPLE: IdeaWithPipeline[] = [
  idea({ id: '1', client_id: 'c1', title: 'Rutina de piernas', client: client('c1', 'Nora Fitness'), status: 'idea' }),
  idea({ id: '2', client_id: 'c2', title: 'Antes y después', client: client('c2', 'Clínica Sonrisa'), status: 'producida' }),
  idea({
    id: '3', client_id: 'c3', title: 'Tour del apartamento', client: client('c3', 'AA Real Estate'),
    status: 'producida', approval_status: 'submitted',
  }),
  idea({
    id: '4', client_id: 'c4', title: 'Receta en 30s', client: client('c4', 'Café del Valle'),
    status: 'producida', approval_status: 'revision_needed',
  }),
  idea({
    id: '5', client_id: 'c5', title: 'Testimonio de cliente', client: client('c5', 'Gym Titan'),
    status: 'producida', approval_status: 'approved',
  }),
  idea({
    id: '6', client_id: 'c6', title: 'Promo de verano', client: client('c6', 'Surf School PR'),
    status: 'producida', approval_status: 'approved', generated_caption: '¡El verano llegó! 🌊 Reserva tu clase.',
  }),
]

/** `assigned_to` is the real clients column — one editor per client. */
const ALL_CLIENTS: AssignableClient[] = [
  { id: 'c1', name: 'Nora Fitness', assigned_to: 'editor-1' },
  { id: 'c2', name: 'Clínica Sonrisa', assigned_to: 'editor-1' },
  { id: 'c3', name: 'AA Real Estate', assigned_to: 'otro' },
  { id: 'c4', name: 'Café del Valle', assigned_to: 'otro' },
  { id: 'c5', name: 'Gym Titan', assigned_to: null },
  { id: 'c6', name: 'Surf School PR', assigned_to: 'otro' },
]

/**
 * Drop any .mp4 at public/sample-review.mp4 to see real playback here. In the
 * real app this URL comes from getR2PreviewUrl() — a 1-hour signed R2 link.
 */
const SAMPLE_CLIP = '/sample-review.mp4'

const QUEUE: QueueVideo[] = [
  { id: 'q1', videoFileId: 'f1', title: 'Tour del apartamento', clientName: 'AA Real Estate',
    approval_status: 'submitted', submitted_by: 'editor-1', submittedByName: 'Ana (editora)' },
  { id: 'q2', videoFileId: 'f2', title: 'Terraza al atardecer', clientName: 'AA Real Estate',
    approval_status: 'submitted', submitted_by: 'editor-1', submittedByName: 'Ana (editora)' },
  { id: 'q3', videoFileId: 'f3', title: 'Amenidades del edificio', clientName: 'AA Real Estate',
    approval_status: 'submitted', submitted_by: 'editor-1', submittedByName: 'Ana (editora)' },
]

export function PipelinePreview() {
  const [role, setRole] = useState<UserRole>('supervisor')
  const [submitted, setSubmitted] = useState<{ clientId: string; title: string }[]>([])

  // Editors only get their own accounts; supervisors work the whole roster.
  // Convenience filter — see the note in client-visibility.ts.
  const submitterClients = clientsForUser(role, role === 'editor' ? 'editor-1' : 'sup-1', ALL_CLIENTS)


  // Preview only: a real submit calls a server action and the card appears from
  // the refetched board data.
  const ideas = [
    ...SAMPLE,
    ...submitted.map((s, i) =>
      idea({
        id: `new-${i}`,
        client_id: s.clientId,
        title: s.title,
        status: 'producida',
        approval_status: 'submitted',
        client: client(s.clientId, ALL_CLIENTS.find((c) => c.id === s.clientId)?.name ?? 'Cliente'),
      }),
    ),
  ]

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold tracking-tight">
              Pipeline — vista previa
            </h1>
            <p className="truncate text-xs text-muted-foreground">
              Datos de ejemplo. No toca Supabase ni requiere sesión.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 whitespace-nowrap">
            <span className="text-xs text-muted-foreground">Ver como:</span>
            {(['supervisor', 'editor'] as UserRole[]).map((r) => (
              <Button
                key={r}
                size="sm"
                variant={role === r ? 'default' : 'outline'}
                onClick={() => setRole(r)}
              >
                {r === 'supervisor' ? 'Supervisor (revisa)' : 'Editor (envía)'}
              </Button>
            ))}
          </div>
        </div>
        <ol className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          {BATCH_STAGES.map((s, i) => (
            <li key={s.key} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden="true">→</span>}
              <span className="rounded-full border px-2 py-0.5">{STAGE_LABEL_ES[s.key]}</span>
            </li>
          ))}
        </ol>
      </header>

      <section className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 overflow-hidden rounded-xl border">
          <ContentPipelineBoard
            ideas={ideas}
            allClients={ALL_CLIENTS.map((c) => ({ id: c.id, name: c.name }))}
            editedColumnSlot={
              <SubmitVideoCard
                clients={submitterClients}
                onSubmit={(p: SubmitVideoPayload) =>
                  // Real page: presign → PUT to R2 → registerR2Video, then create
                  // the idea. Here we only drop a card on the board.
                  setSubmitted((prev) => [
                    ...prev,
                    ...p.videos.map((v) => ({ clientId: p.clientId, title: v.title })),
                  ])
                }
              />
            }
          />
        </div>
        <aside className="min-w-0 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Revisión interna
          </h2>
          <ReviewQueue
            videos={QUEUE}
            role={role}
            userId="sup-1"
            getPreviewUrl={async () => ({ url: SAMPLE_CLIP })}
            onDecide={async () => {}}
          />
          <p className="text-xs text-muted-foreground">
            Cambia de rol arriba: el <strong>Supervisor</strong> aprueba o pide cambios; el{' '}
            <strong>Editor</strong> solo ve el estado. Pon un .mp4 en{' '}
            <code>public/sample-review.mp4</code> para ver el reproductor con video real.
          </p>
        </aside>
      </section>
    </div>
  )
}
