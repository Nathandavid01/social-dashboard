import { describe, expect, it } from 'vitest'
import type { ContentIdeaVideo, IdeaWithPipeline } from '@/lib/supabase/types'
import {
  EDITOR_WIP_LIMIT,
  canAccessEditorBank,
  canDownloadOrPreviewRaw,
  editorWipIdeaIds,
  filterIdeasForEditorBank,
  groupEditorVideoBank,
  isIdeaApproved,
  prepareIdeasForEditorBank,
} from './editor-video-bank'

function raw(over: Partial<ContentIdeaVideo> = {}): ContentIdeaVideo {
  return {
    id: 'v1',
    idea_id: 'i1',
    kind: 'raw',
    name: 'crudo.mp4',
    drive_file_id: 'ideas/i1/raw/x',
    drive_view_link: null,
    drive_thumb_url: null,
    storage_provider: 'r2',
    mime_type: 'video/mp4',
    size_bytes: 10,
    duration_sec: null,
    notes: null,
    uploaded_by: 'vid-1',
    status: 'uploaded',
    error_message: null,
    uploaded_at: '2026-08-23T12:00:00Z',
    updated_at: '2026-08-23T12:00:00Z',
    ...over,
  }
}

function idea(over: Partial<IdeaWithPipeline> = {}): IdeaWithPipeline {
  return {
    id: 'i1',
    client_id: 'c1',
    content_type: 'R',
    title: 'Intro clínica',
    hook: null,
    visual_brief: null,
    caption_angle: null,
    hashtags_suggestion: null,
    rationale: null,
    status: 'grabada',
    production_task_id: null,
    recording_session_id: null,
    theme: null,
    generation_prompt: null,
    model: null,
    generated_caption: null,
    caption_draft: null,
    caption_platform: null,
    platform_formats: null,
    caption_generated_at: null,
    published_at: null,
    approval_status: 'pending',
    approved_by: null,
    approved_at: null,
    submitted_at: null,
    recording_date: null,
    publish_date: null,
    deadline: null,
    metricool_post_id: null,
    metricool_uuid: null,
    posted_at: null,
    posting_error: null,
    posting_started_at: null,
    created_by: null,
    created_at: '2026-08-20',
    updated_at: '2026-08-20',
    shooting_notes: 'Toma 2, 35mm',
    recordingScheduled: true,
    videos: [raw()],
    assignee: { id: 'ed-maria', full_name: 'María R.' },
    client: { id: 'c1', name: 'Blue Chiropractic', industry: null, logo_url: null },
    ...over,
  } as IdeaWithPipeline
}

describe('canAccessEditorBank', () => {
  const assigned = {
    ideaAssigneeId: 'ed-maria',
    clientAssigneeId: 'ed-diego',
    uploadedBy: 'vid-1',
  }

  it('owner y supervisor ven todo el banco', () => {
    expect(canAccessEditorBank({ role: 'owner', userId: 'x', ...assigned })).toBe(true)
    expect(canAccessEditorBank({ role: 'supervisor', userId: 'x', ...assigned })).toBe(true)
  })

  it('el editor solo ve lo asignado a él (tarea o cliente)', () => {
    expect(canAccessEditorBank({ role: 'editor', userId: 'ed-maria', ...assigned })).toBe(true)
    expect(canAccessEditorBank({ role: 'editor', userId: 'ed-diego', ...assigned })).toBe(true)
    expect(canAccessEditorBank({ role: 'editor', userId: 'ed-otro', ...assigned })).toBe(false)
  })

  it('el videógrafo no entra al banco de otros', () => {
    expect(canAccessEditorBank({ role: 'video', userId: 'vid-1', ...assigned })).toBe(false)
    expect(canAccessEditorBank({ role: 'video', userId: 'ed-maria', ...assigned })).toBe(false)
  })

  it('sin rol no hay acceso', () => {
    expect(canAccessEditorBank({ role: null, userId: 'ed-maria', ...assigned })).toBe(false)
  })
})

describe('canDownloadOrPreviewRaw', () => {
  it('quien subió el crudo puede bajarlo (videógrafo confirma su toma)', () => {
    expect(canDownloadOrPreviewRaw({
      role: 'video',
      userId: 'vid-1',
      ideaAssigneeId: 'ed-maria',
      clientAssigneeId: null,
      uploadedBy: 'vid-1',
    })).toBe(true)
  })

  it('el editor no baja el banco de otro aunque tenga el id del archivo', () => {
    expect(canDownloadOrPreviewRaw({
      role: 'editor',
      userId: 'ed-otro',
      ideaAssigneeId: 'ed-maria',
      clientAssigneeId: 'ed-maria',
      uploadedBy: 'vid-1',
    })).toBe(false)
  })

  it('copy y diseñador no bajan crudos de todos', () => {
    expect(canDownloadOrPreviewRaw({
      role: 'copy',
      userId: 'copy-1',
      ideaAssigneeId: 'ed-maria',
      clientAssigneeId: null,
      uploadedBy: 'vid-1',
    })).toBe(false)
    expect(canDownloadOrPreviewRaw({
      role: 'disenador',
      userId: 'des-1',
      ideaAssigneeId: 'ed-maria',
      clientAssigneeId: null,
      uploadedBy: 'vid-1',
    })).toBe(false)
  })

  it('el editor no baja un crudo fuera de su WIP de 2', () => {
    expect(canDownloadOrPreviewRaw({
      role: 'editor',
      userId: 'ed-maria',
      ideaAssigneeId: 'ed-maria',
      clientAssigneeId: null,
      uploadedBy: 'vid-1',
      inEditorWip: false,
    })).toBe(false)
    expect(canDownloadOrPreviewRaw({
      role: 'editor',
      userId: 'ed-maria',
      ideaAssigneeId: 'ed-maria',
      clientAssigneeId: null,
      uploadedBy: 'vid-1',
      inEditorWip: true,
    })).toBe(true)
  })
})

describe('filterIdeasForEditorBank', () => {
  it('el editor solo recibe sus ideas; el owner las recibe todas', () => {
    const rows = [
      idea({ id: 'a', assignee: { id: 'ed-maria', full_name: 'María R.' } }),
      idea({ id: 'b', assignee: { id: 'ed-diego', full_name: 'Diego V.' }, client: { id: 'c2', name: 'Lumen', industry: null } }),
    ]
    const maria = filterIdeasForEditorBank(rows, { role: 'editor', userId: 'ed-maria' })
    expect(maria.map((i) => i.id)).toEqual(['a'])
    const owner = filterIdeasForEditorBank(rows, { role: 'owner', userId: 'own-1' })
    expect(owner.map((i) => i.id)).toEqual(['a', 'b'])
  })
})

describe('groupEditorVideoBank', () => {
  it('agrupa por editor y luego por cliente; Sin asignar al final', () => {
    const rows = groupEditorVideoBank([
      idea({
        id: 'i-blue',
        assignee: { id: 'ed-maria', full_name: 'María R.' },
        client: { id: 'c1', name: 'Blue Chiropractic', industry: null },
      }),
      idea({
        id: 'i-lumen',
        assignee: { id: 'ed-diego', full_name: 'Diego V.' },
        client: { id: 'c2', name: 'Lumen', industry: null },
        videos: [raw({ id: 'v2', idea_id: 'i-lumen', name: 'lumen.mp4' })],
      }),
      idea({
        id: 'i-free',
        assignee: null,
        title: 'Sin dueño',
        client: { id: 'c3', name: 'Norte', industry: null },
        videos: [raw({ id: 'v3', idea_id: 'i-free', name: 'norte.mp4' })],
      }),
    ])

    expect(rows.map((r) => r.editorName)).toEqual(['Diego V.', 'María R.', 'Sin asignar'])
    const maria = rows.find((r) => r.editorId === 'ed-maria')!
    expect(maria.clients).toHaveLength(1)
    expect(maria.clients[0].clientName).toBe('Blue Chiropractic')
    expect(maria.clients[0].clips[0].title).toBe('Intro clínica')
    expect(maria.clients[0].clips[0].files.map((f) => f.name)).toEqual(['crudo.mp4'])
    expect(maria.clients[0].clips[0].shootingNotes).toBe('Toma 2, 35mm')
  })

  it('omite ideas sin crudo/b-roll y las descartadas', () => {
    const rows = groupEditorVideoBank([
      idea({ id: 'empty', videos: [] }),
      idea({ id: 'edited-only', videos: [raw({ kind: 'edited', name: 'final.mp4' })] }),
      idea({ id: 'dead', status: 'descartada' }),
    ])
    expect(rows).toEqual([])
  })

  it('varios clientes del mismo editor quedan en una sola fila', () => {
    const rows = groupEditorVideoBank([
      idea({
        id: 'a',
        client_id: 'c1',
        client: { id: 'c1', name: 'Alpha', industry: null },
      }),
      idea({
        id: 'b',
        client_id: 'c2',
        title: 'Otra toma',
        client: { id: 'c2', name: 'Beta', industry: null },
        videos: [raw({ id: 'vb', idea_id: 'b', name: 'beta.mp4' })],
      }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].clients.map((c) => c.clientName)).toEqual(['Alpha', 'Beta'])
  })

  it('cada cliente muestra cuántos videos tiene aprobados', () => {
    const rows = groupEditorVideoBank([
      idea({ id: 'raw', status: 'grabada' }),
      idea({
        id: 'ok1',
        status: 'producida',
        approval_status: 'approved',
        videos: [],
      }),
      idea({
        id: 'ok2',
        status: 'publicada',
        published_at: '2026-08-22',
        videos: [],
      }),
    ])
    expect(isIdeaApproved(idea({ approval_status: 'approved', videos: [] }))).toBe(true)
    expect(rows[0].clients[0].approvedCount).toBe(2)
  })
})

describe('editor WIP (máximo 2)', () => {
  const queued = [
    idea({ id: 'a', created_at: '2026-08-01', videos: [raw({ id: 'va', idea_id: 'a' })] }),
    idea({ id: 'b', created_at: '2026-08-02', videos: [raw({ id: 'vb', idea_id: 'b' })] }),
    idea({ id: 'c', created_at: '2026-08-03', videos: [raw({ id: 'vc', idea_id: 'c' })] }),
  ]

  it('el editor solo tiene 2 ideas activas; el resto espera', () => {
    expect(EDITOR_WIP_LIMIT).toBe(2)
    const ids = editorWipIdeaIds(queued, 'ed-maria')
    expect(Array.from(ids)).toEqual(['a', 'b'])
  })

  it('si una se aprueba, entra la siguiente', () => {
    const after = [
      idea({ id: 'a', created_at: '2026-08-01', approval_status: 'approved', videos: [raw({ id: 'va', idea_id: 'a' })] }),
      idea({ id: 'b', created_at: '2026-08-02', videos: [raw({ id: 'vb', idea_id: 'b' })] }),
      idea({ id: 'c', created_at: '2026-08-03', videos: [raw({ id: 'vc', idea_id: 'c' })] }),
    ]
    expect(Array.from(editorWipIdeaIds(after, 'ed-maria'))).toEqual(['b', 'c'])
  })

  it('prepareIdeasForEditorBank quita los ids de archivo de lo que está en espera', () => {
    const prepared = prepareIdeasForEditorBank(queued, { role: 'editor', userId: 'ed-maria' })
    const byId = Object.fromEntries(prepared.map((i) => [i.id, i]))
    expect(byId.a.videos).toHaveLength(1)
    expect(byId.b.videos).toHaveLength(1)
    expect(byId.c.videos).toEqual([])
    expect(byId.c.bankQueue).toBe('waiting')
  })

  it('owner no tiene tope de 2', () => {
    const prepared = prepareIdeasForEditorBank(queued, { role: 'owner', userId: 'own-1' })
    expect(prepared.every((i) => i.videos.length > 0)).toBe(true)
    const rows = groupEditorVideoBank(prepared)
    expect(rows[0].clients[0].clips).toHaveLength(3)
    expect(rows[0].clients[0].clips.every((c) => c.queue === 'active')).toBe(true)
  })

  it('en el banco del editor, los extras salen en espera sin archivos', () => {
    const prepared = prepareIdeasForEditorBank(queued, { role: 'editor', userId: 'ed-maria' })
    const rows = groupEditorVideoBank(prepared)
    const clips = rows[0].clients[0].clips
    expect(clips.filter((c) => c.queue === 'active')).toHaveLength(2)
    expect(clips.find((c) => c.ideaId === 'c')).toMatchObject({ queue: 'waiting', files: [] })
  })
})
