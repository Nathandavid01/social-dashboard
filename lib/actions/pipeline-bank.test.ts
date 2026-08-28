import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IdeaWithPipeline } from '@/lib/supabase/types'

const requirePermission = vi.fn(async (_perm: string) => undefined)
const getEffectiveRole = vi.fn(async (): Promise<'editor' | 'owner' | 'supervisor'> => 'editor')
const getEffectiveUserId = vi.fn(async () => 'ed-maria')
const getIdeacionPipeline = vi.fn(async () => [] as IdeaWithPipeline[])

vi.mock('@/lib/auth/server', () => ({
  requirePermission: (perm: string) => requirePermission(perm),
  getEffectiveRole: () => getEffectiveRole(),
  getEffectiveUserId: () => getEffectiveUserId(),
}))
vi.mock('@/lib/actions/content-ideas', () => ({
  getIdeacionPipeline: () => getIdeacionPipeline(),
}))

import { getEditorPipelineHistory, getEditorVideoBank } from './pipeline-bank'

function idea(id: string, editorId: string): IdeaWithPipeline {
  return {
    id,
    client_id: 'c1',
    title: id,
    created_at: '2026-08-01',
    status: 'grabada',
    assignee: { id: editorId, full_name: editorId },
    client: { id: 'c1', name: 'Blue', industry: null },
    videos: [{
      id: `v-${id}`,
      idea_id: id,
      kind: 'raw',
      name: `${id}.mp4`,
      drive_file_id: 'k',
      drive_view_link: null,
      drive_thumb_url: null,
      storage_provider: 'r2',
      mime_type: 'video/mp4',
      size_bytes: 1,
      duration_sec: null,
      notes: null,
      uploaded_by: 'vid-1',
      status: 'uploaded',
      error_message: null,
      uploaded_at: '2026-08-23',
      updated_at: '2026-08-23',
    }],
  } as IdeaWithPipeline
}

beforeEach(() => {
  requirePermission.mockReset().mockResolvedValue(undefined)
  getEffectiveRole.mockReset().mockResolvedValue('editor')
  getEffectiveUserId.mockReset().mockResolvedValue('ed-maria')
  getIdeacionPipeline.mockReset().mockResolvedValue([
    idea('mia', 'ed-maria'),
    idea('otra', 'ed-diego'),
  ])
})

describe('getEditorVideoBank', () => {
  it('exige pipeline.read antes de listar', async () => {
    requirePermission.mockRejectedValueOnce(new Error('No autorizado'))
    const res = await getEditorVideoBank()
    expect(res.error).toMatch(/autorizado/i)
    expect(getIdeacionPipeline).not.toHaveBeenCalled()
  })

  it('el editor solo lista su fila; no el banco de otro', async () => {
    const res = await getEditorVideoBank()
    expect(requirePermission).toHaveBeenCalledWith('pipeline.read')
    expect(res.error).toBeUndefined()
    expect(res.rows?.map((r) => r.editorId)).toEqual(['ed-maria'])
    expect(res.rows?.[0].clients[0].clips.map((c) => c.ideaId)).toEqual(['mia'])
  })

  it('owner ve todas las filas de editor', async () => {
    getEffectiveRole.mockResolvedValue('owner')
    getEffectiveUserId.mockResolvedValue('own-1')
    const res = await getEditorVideoBank()
    expect(res.rows?.map((r) => r.editorId).sort()).toEqual(['ed-diego', 'ed-maria'])
  })

  it('supervisor ve todas las filas de editor', async () => {
    getEffectiveRole.mockResolvedValue('supervisor')
    const res = await getEditorVideoBank()
    expect(res.rows?.map((r) => r.editorId).sort()).toEqual(['ed-diego', 'ed-maria'])
  })

  it('el editor solo recibe 2 clips activos; el tercero espera sin archivo', async () => {
    getIdeacionPipeline.mockResolvedValue([
      idea('uno', 'ed-maria'),
      { ...idea('dos', 'ed-maria'), created_at: '2026-08-02' },
      { ...idea('tres', 'ed-maria'), created_at: '2026-08-03' },
    ] as IdeaWithPipeline[])
    const res = await getEditorVideoBank()
    const clips = res.rows?.[0].clients[0].clips ?? []
    expect(clips.filter((c) => c.queue === 'active')).toHaveLength(2)
    expect(clips.find((c) => c.ideaId === 'tres')).toMatchObject({ queue: 'waiting', files: [] })
  })
})

describe('getEditorPipelineHistory', () => {
  it('rechaza a un editor aunque tenga team.read por área', async () => {
    const res = await getEditorPipelineHistory('ed-diego')
    expect(res.error).toMatch(/administrador|autorizado/i)
    expect(getIdeacionPipeline).not.toHaveBeenCalled()
  })

  it('permite que un editor vea su propio historial', async () => {
    const res = await getEditorPipelineHistory('ed-maria')
    expect(res.error).toBeUndefined()
    expect(res.items?.map((item) => item.ideaId)).toEqual(['mia'])
  })

  it('exige team.read y un admin puede consultar el historial solicitado', async () => {
    requirePermission.mockRejectedValueOnce(new Error('No autorizado'))
    const denied = await getEditorPipelineHistory('ed-maria')
    expect(denied.error).toMatch(/autorizado/i)
    expect(getIdeacionPipeline).not.toHaveBeenCalled()

    requirePermission.mockResolvedValue(undefined)
    getEffectiveRole.mockResolvedValue('owner')
    const res = await getEditorPipelineHistory('ed-maria')
    expect(requirePermission).toHaveBeenCalledWith('team.read')
    expect(res.items?.map((i) => i.ideaId)).toEqual(['mia'])
    expect(res.items?.some((i) => i.ideaId === 'otra')).toBe(false)
  })
})
