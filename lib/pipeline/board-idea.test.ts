import { describe, it, expect } from 'vitest'
import { BOARD_IDEA_FIELDS, BOARD_VIDEO_FIELDS, toBoardIdea, toBoardIdeas } from './board-idea'
import type { IdeaWithPipeline } from '@/lib/supabase/types'

function fullIdea(over: Partial<IdeaWithPipeline> = {}): IdeaWithPipeline {
  return {
    id: 'i1', client_id: 'c1', content_type: 'reel', title: 'Intro', hook: 'Hook', hook_source: 'ai',
    visual_brief: 'brief', shooting_notes: 'notas', virality_score: 8, caption_angle: 'angle',
    hashtags_suggestion: '#a', rationale: 'por qué', status: 'producida', production_task_id: 'pt1',
    recording_session_id: 'rs1', theme: 'tema', generation_prompt: 'PROMPT LARGO', model: 'grok',
    generated_caption: 'caption', caption_draft: null, caption_platform: 'instagram', platform_formats: null,
    caption_generated_at: null, published_at: null, approval_status: 'submitted', approved_by: null,
    approved_at: null, submitted_at: '2026-09-01', recording_date: null, publish_date: '2026-09-03',
    deadline: null, metricool_post_id: null, metricool_uuid: null, posted_at: null, posting_error: null,
    posting_started_at: null, created_by: 'u1', created_at: '2026-08-30', updated_at: '2026-09-01',
    recordingScheduled: false, videos: [], client: { id: 'c1', name: 'Cliente', industry: null },
    assignee: null, recording_session: null,
    // columnas que existen en la fila real pero NO en el tipo: deben quedarse en el servidor
    review_token: 'SECRETO', review_token_expires_at: '2026-10-01', client_review_status: 'x',
    ...over,
  } as IdeaWithPipeline
}

describe('toBoardIdea', () => {
  it('conserva lo que el tablero usa', () => {
    const b = toBoardIdea(fullIdea())
    expect(b.id).toBe('i1')
    expect(b.title).toBe('Intro')
    expect(b.status).toBe('producida')
    expect(b.approval_status).toBe('submitted')
    expect(b.publish_date).toBe('2026-09-03')
    expect(b.generated_caption).toBe('caption')
    expect(b.visual_brief).toBe('brief')
    expect(b.client?.name).toBe('Cliente')
    expect(b.videos).toEqual([])
  })

  it('NO manda al navegador tokens de revisión ni columnas fuera de la lista', () => {
    const b = toBoardIdea(fullIdea()) as unknown as Record<string, unknown>
    for (const secret of ['review_token', 'review_token_expires_at', 'generation_prompt', 'rationale', 'hashtags_suggestion', 'caption_angle', 'model', 'theme', 'metricool_uuid', 'approved_by', 'client_review_status']) {
      expect(b, secret).not.toHaveProperty(secret)
    }
    expect(Object.keys(b).every((k) => k === 'videos' || (BOARD_IDEA_FIELDS as readonly string[]).includes(k))).toBe(true)
  })

  it('no inventa claves ausentes (campos opcionales que la fila no trae)', () => {
    const idea = fullIdea()
    delete (idea as Partial<IdeaWithPipeline>).bankQueue
    const b = toBoardIdea(idea) as unknown as Record<string, unknown>
    expect(b).not.toHaveProperty('bankQueue')
  })

  it('toBoardIdeas proyecta cada elemento, respeta el orden y deja fuera las descartadas', () => {
    const out = toBoardIdeas([fullIdea({ id: 'a' }), fullIdea({ id: 'x', status: 'descartada' }), fullIdea({ id: 'b' })])
    expect(out.map((i) => i.id)).toEqual(['a', 'b'])
  })

  it('recorta el cliente anidado a lo tipado (fuera assigned_to y posting_days)', () => {
    const idea = fullIdea({ client: { id: 'c1', name: 'Cliente', industry: 'salud', logo_url: 'l', platforms: ['instagram'], status: 'active', assigned_to: 'u9', posting_days: [1, 3] } as unknown as IdeaWithPipeline['client'] })
    const c = toBoardIdea(idea).client as unknown as Record<string, unknown>
    expect(c).toEqual({ id: 'c1', name: 'Cliente', industry: 'salud', logo_url: 'l', platforms: ['instagram'], status: 'active' })
  })

  it('recorta cada video a lo que se pinta (sin notas, errores ni tamaño)', () => {
    const video = {
      id: 'v1', idea_id: 'i1', kind: 'edited', name: 'final.mp4', drive_file_id: null, drive_view_link: null,
      drive_thumb_url: null, storage_provider: 'entregas-r2', mime_type: 'video/mp4', size_bytes: 123456789,
      duration_sec: 18, notes: 'nota larga', uploaded_by: 'u1', status: 'ready', error_message: 'err',
      thumb_keys: ['k1'], uploaded_at: '2026-09-01', updated_at: '2026-09-01',
      uploader: { id: 'u1', full_name: 'Eric', email: 'e@x.com' },
    } as unknown as IdeaWithPipeline['videos'][number]
    const b = toBoardIdea(fullIdea({ videos: [video] }))
    const v = b.videos[0] as unknown as Record<string, unknown>
    expect(v.kind).toBe('edited')
    expect(v.thumb_keys).toEqual(['k1'])
    expect(v.status).toBe('ready')
    for (const dropped of ['notes', 'error_message', 'size_bytes', 'mime_type', 'updated_at', 'uploader']) {
      expect(v, dropped).not.toHaveProperty(dropped)
    }
    expect(Object.keys(v).every((k) => (BOARD_VIDEO_FIELDS as readonly string[]).includes(k))).toBe(true)
  })
})
