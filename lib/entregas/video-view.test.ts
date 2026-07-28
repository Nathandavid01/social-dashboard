import { describe, it, expect } from 'vitest'
import {
  contentTypeLabel,
  videoStageKey,
  batchStageKey,
  buildStepper,
  isRecorded,
  cardStatus,
  slotStatus,
  batchHint,
  videoNextStep,
  type EntregaVideo,
} from './video-view'
import type { ContentIdeaVideo } from '@/lib/supabase/types'

function rawFile(): ContentIdeaVideo {
  return {
    id: 'v1',
    idea_id: 'i1',
    kind: 'raw',
    name: 'clip.mp4',
    drive_file_id: null,
    drive_view_link: null,
    drive_thumb_url: null,
    storage_provider: 'r2',
    mime_type: 'video/mp4',
    size_bytes: 1000,
    duration_sec: 42,
    notes: null,
    uploaded_by: null,
    status: 'uploaded',
    error_message: null,
    uploaded_at: '2026-06-01',
    updated_at: '2026-06-01',
  }
}

function mk(overrides: Partial<EntregaVideo> = {}): EntregaVideo {
  return {
    id: 'idea-1',
    client_id: 'c1',
    content_type: 'R',
    title: 'Video de prueba',
    hook: null,
    visual_brief: null,
    caption_angle: null,
    hashtags_suggestion: null,
    rationale: null,
    status: 'idea',
    production_task_id: null,
    recording_session_id: null,
    theme: null,
    generation_prompt: null,
    model: null,
    generated_caption: null,
    caption_platform: null,
    caption_generated_at: null,
    published_at: null,
    approval_status: 'pending',
    approved_by: null,
    approved_at: null,
    submitted_at: null,
    recording_date: null,
    publish_date: null,
    created_by: null,
    created_at: '2026-06-01',
    updated_at: '2026-06-01',
    videos: { raw: [], broll: [], edited: [] },
    ...overrides,
  } as EntregaVideo
}

describe('contentTypeLabel', () => {
  it('maps known content_type codes to Spanish labels', () => {
    expect(contentTypeLabel('R')).toBe('Reel')
    expect(contentTypeLabel('C')).toBe('Carrusel')
    expect(contentTypeLabel('P')).toBe('Post')
    expect(contentTypeLabel('S')).toBe('Story')
  })
  it('falls back to "Video" for unknown/empty', () => {
    expect(contentTypeLabel('X')).toBe('Video')
    expect(contentTypeLabel(null)).toBe('Video')
    expect(contentTypeLabel(undefined)).toBe('Video')
  })
})

describe('videoStageKey', () => {
  it('anything not yet sent to review sits in "edited", the board entry point', () => {
    expect(videoStageKey(mk())).toBe('edited')
    expect(videoStageKey(mk({ hook: 'gancho', visual_brief: 'brief' }))).toBe('edited')
    expect(videoStageKey(mk({ hook: 'g', generated_caption: 'texto' }))).toBe('edited')
    expect(videoStageKey(mk({ status: 'grabada' }))).toBe('edited')
    expect(videoStageKey(mk({ recording_date: '2026-06-11' }))).toBe('edited')
    expect(videoStageKey(mk({ videos: { raw: [rawFile()], broll: [], edited: [] } }))).toBe('edited')
    expect(videoStageKey(mk({ videos: { raw: [], broll: [], edited: [rawFile()] } }))).toBe('edited')
    expect(videoStageKey(mk({ status: 'producida' }))).toBe('edited')
  })
  it('is "approval" only while the reviewer actually holds it', () => {
    expect(videoStageKey(mk({ approval_status: 'submitted' }))).toBe('approval')
  })
  it('goes back to "edited" when the reviewer asks for changes', () => {
    expect(videoStageKey(mk({ approval_status: 'revision_needed' }))).toBe('edited')
  })
  it('is "copy" once approved but with no copy written yet', () => {
    expect(videoStageKey(mk({ approval_status: 'approved' }))).toBe('copy')
  })
  it('is "publication" once the copy is written, or once published', () => {
    expect(videoStageKey(mk({ approval_status: 'approved', generated_caption: 'Copy listo' }))).toBe('publication')
    expect(videoStageKey(mk({ published_at: '2026-06-20' }))).toBe('publication')
    expect(videoStageKey(mk({ status: 'publicada' }))).toBe('publication')
  })
})

describe('batchStageKey', () => {
  it('returns "edited" for an empty batch', () => {
    expect(batchStageKey([])).toBe('edited')
  })
  it('returns the LEAST-advanced active video stage (videos move together)', () => {
    const videos = [
      mk({ id: 'a', approval_status: 'approved' }), // copy
      mk({ id: 'b', status: 'grabada' }), // edited
    ]
    expect(batchStageKey(videos)).toBe('edited')
  })
  it('ignores discarded videos', () => {
    const videos = [
      mk({ id: 'a', status: 'descartada' }),
      mk({ id: 'b', status: 'grabada' }),
    ]
    expect(batchStageKey(videos)).toBe('edited')
  })
  it('returns "publication" only when all active videos are published', () => {
    const videos = [
      mk({ id: 'a', status: 'publicada' }),
      mk({ id: 'b', published_at: '2026-06-20' }),
    ]
    expect(batchStageKey(videos)).toBe('publication')
  })
})

describe('buildStepper', () => {
  it('marks earlier stages done, the current stage current, later ones neither', () => {
    const stepper = buildStepper([mk({ status: 'producida', approval_status: 'submitted' })]) // batch at "approval"
    const byKey = Object.fromEntries(stepper.map((s) => [s.key, s]))
    expect(byKey.edited.done).toBe(true)
    expect(byKey.approval.current).toBe(true)
    expect(byKey.approval.done).toBe(false)
    expect(byKey.publication.done).toBe(false)
    expect(byKey.publication.current).toBe(false)
  })
  it('uses Spanish labels', () => {
    const labels = buildStepper([]).map((s) => s.label)
    expect(labels).toEqual(['Editado', 'Revisión', 'Copy', 'Publicación'])
  })
})

describe('cardStatus / isRecorded', () => {
  it('is "Por grabar" before the video stage', () => {
    expect(isRecorded(mk({ hook: 'g' }))).toBe(false)
    expect(cardStatus(mk({ hook: 'g' })).label).toBe('Por grabar')
  })
  it('is "Grabado" once a raw file exists', () => {
    const v = mk({ videos: { raw: [rawFile()], broll: [], edited: [] } })
    expect(isRecorded(v)).toBe(true)
    expect(cardStatus(v).label).toBe('Grabado')
  })
})

describe('slotStatus', () => {
  it('is Listo when a file exists', () => {
    expect(slotStatus(2)).toEqual({ label: 'Listo', tone: 'ready' })
  })
  it('is Pendiente when required and empty, Opcional when optional and empty', () => {
    expect(slotStatus(0)).toEqual({ label: 'Pendiente', tone: 'pending' })
    expect(slotStatus(0, true)).toEqual({ label: 'Opcional', tone: 'muted' })
  })
})

describe('batchHint', () => {
  it('returns the current stage label and an actionable tip', () => {
    const hint = batchHint([mk({ status: 'grabada' })])
    expect(hint.stageLabel).toBe('Editado')
    expect(hint.tip).toMatch(/drive/i)
  })
})

describe('videoNextStep — the single "what to do next" per video', () => {
  // An unshot planned slot must be told to SHOOT, not to write a caption — most
  // of the real board is exactly this, and asking for a caption on a video that
  // doesn't exist yet is how the board became noise.
  it('asks for the camera first when nothing has been recorded', () => {
    expect(videoNextStep(mk())).toEqual({ label: 'Siguiente: graba el video', tone: 'action' })
  })

  it('walks the happy path in order: grabar → caption → edited → review → approve → publish', () => {
    expect(videoNextStep(mk())).toEqual({ label: 'Siguiente: graba el video', tone: 'action' })
    expect(videoNextStep(mk({ status: 'grabada' }))).toEqual({
      label: 'Siguiente: genera el caption',
      tone: 'action',
    })
    expect(videoNextStep(mk({ status: 'grabada', generated_caption: 'c' }))).toEqual({
      label: 'Siguiente: sube el video editado',
      tone: 'action',
    })
    expect(
      videoNextStep(mk({ status: 'grabada', generated_caption: 'c', videos: { raw: [], broll: [], edited: [rawFile()] } })),
    ).toEqual({ label: 'Siguiente: envía a revisión', tone: 'action' })
    expect(videoNextStep(mk({ approval_status: 'submitted' }))).toEqual({
      label: 'En revisión — aprueba o pide cambios',
      tone: 'waiting',
    })
    expect(
      videoNextStep(
        mk({ approval_status: 'approved', generated_caption: 'c', videos: { raw: [], broll: [], edited: [rawFile()] } }),
      ),
    ).toEqual({ label: 'Aprobado — listo para Metricool', tone: 'action' })
  })

  it('surfaces a publish failure so the team can retry (posting_error)', () => {
    expect(
      videoNextStep(mk({ approval_status: 'approved', posting_error: 'La URL del video no responde' } as Partial<EntregaVideo>)),
    ).toEqual({ label: 'Error al publicar — revisa y reintenta', tone: 'warn' })
    // A recorded post wins over a stale error (success clears it, but belt-and-suspenders).
    expect(
      videoNextStep(
        mk({ approval_status: 'approved', posting_error: 'viejo', metricool_post_id: 9 } as Partial<EntregaVideo>),
      ),
    ).toEqual({ label: 'Programado en Metricool', tone: 'done' })
  })

  it('is honest when an approved video is not actually Metricool-ready', () => {
    expect(videoNextStep(mk({ approval_status: 'approved' }))).toEqual({
      label: 'Aprobado — falta el caption para Metricool',
      tone: 'warn',
    })
    expect(videoNextStep(mk({ approval_status: 'approved', generated_caption: 'c' }))).toEqual({
      label: 'Aprobado — falta el video editado para Metricool',
      tone: 'warn',
    })
  })

  it('flags requested changes', () => {
    expect(videoNextStep(mk({ approval_status: 'revision_needed' }))).toEqual({
      label: 'Cambios pedidos — corrige y reenvía',
      tone: 'warn',
    })
  })

  it('shows scheduled and published end states', () => {
    expect(videoNextStep(mk({ metricool_post_id: 123 } as Partial<EntregaVideo>))).toEqual({
      label: 'Programado en Metricool',
      tone: 'done',
    })
    expect(videoNextStep(mk({ status: 'publicada' }))).toEqual({ label: 'Publicado', tone: 'done' })
    expect(videoNextStep(mk({ published_at: '2026-07-01' }))).toEqual({ label: 'Publicado', tone: 'done' })
  })
})
