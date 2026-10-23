import { describe, expect, it } from 'vitest'
import {
  OPERATOR_HOLD_THEME,
  OPERATOR_VIDEO_MAX_BYTES,
  acceptsEditedUpload,
  assertPipelineEditedKey,
  includePipelineRow,
  parseListQuery,
  parseRetry,
  parseSubmit,
  pipelineEditedObjectKey,
  pipelineVideoInsert,
  shapePipelineItem,
} from './operator-jobs'

const CLIENT = '11111111-1111-4111-8111-111111111111'
const IDEA = '22222222-2222-4222-8222-222222222222'

function video(partial: Record<string, unknown>) {
  return {
    id: 'vid',
    kind: 'raw',
    status: 'uploaded',
    storage_provider: 'r2',
    name: 'toma.mp4',
    drive_file_id: 'ideas/x/raw/1-toma.mp4',
    drive_view_link: null,
    mime_type: 'video/mp4',
    size_bytes: 10,
    uploaded_at: '2026-10-20T00:00:00Z',
    ...partial,
  }
}

describe('parseSubmit', () => {
  it('rechaza un cuerpo vacío', () => {
    expect(parseSubmit(null).ok).toBe(false)
  })

  it('el contrato viejo (cliente + título, sin idea) no crea un trabajo', () => {
    const parsed = parseSubmit({ clientId: CLIENT, title: 'Corte nuevo', phase: 'edited' })
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.error).toMatch(/Video QC|ideaId/)
  })

  it('kind ausente es el corte editado de Editores', () => {
    const parsed = parseSubmit({
      ideaId: IDEA,
      fileName: '  corte.mp4  ',
      contentType: 'video/mp4',
    })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value).toEqual({
      ideaId: IDEA,
      fileName: 'corte.mp4',
      contentType: 'video/mp4',
    })
  })

  it('rechaza raw, broll y un tipo que no es video', () => {
    expect(parseSubmit({ ideaId: IDEA, kind: 'raw', fileName: 'a.mp4', contentType: 'video/mp4' }).ok).toBe(false)
    expect(parseSubmit({ ideaId: IDEA, kind: 'broll', fileName: 'a.mp4', contentType: 'video/mp4' }).ok).toBe(false)
    const bad = parseSubmit({ ideaId: IDEA, fileName: 'nota.txt', contentType: 'text/plain' })
    expect(bad.ok).toBe(false)
  })
})

describe('pipelineEditedObjectKey', () => {
  it('usa la misma key que la tarjeta de Editores en el bucket del pipeline', () => {
    expect(pipelineEditedObjectKey(IDEA, 'La Güira.mp4', 10)).toBe(
      `ideas/${IDEA}/edited/10-la-guira.mp4`,
    )
    expect(pipelineEditedObjectKey(IDEA, 'La Güira.mp4', 10)).not.toMatch(/^entregas\//)
  })

  it('la key de Entregas o de otro video no se registra', () => {
    expect(assertPipelineEditedKey(IDEA, `entregas/${IDEA}/edited/10-corte.mp4`)).toMatch(/key/i)
    expect(assertPipelineEditedKey(IDEA, `ideas/${IDEA}/raw/10-corte.mp4`)).toMatch(/key/i)
    expect(assertPipelineEditedKey(IDEA, `ideas/${IDEA}/edited/../otro.mp4`)).toMatch(/key/i)
    expect(assertPipelineEditedKey(IDEA, `ideas/${IDEA}/edited/10-la-guira.mp4`)).toBeNull()
  })
})

describe('parseRetry', () => {
  it('register exige nombre, tope de 5 GB y key del corte editado', () => {
    expect(OPERATOR_VIDEO_MAX_BYTES).toBe(5 * 1024 * 1024 * 1024)
    const ok = parseRetry({
      step: 'register',
      key: `ideas/${IDEA}/edited/10-corte.mp4`,
      name: 'corte.mp4',
      sizeBytes: OPERATOR_VIDEO_MAX_BYTES,
      mimeType: 'video/mp4',
    }, IDEA)
    expect(ok.ok).toBe(true)

    const big = parseRetry({
      step: 'register',
      key: `ideas/${IDEA}/edited/10-corte.mp4`,
      name: 'corte.mp4',
      sizeBytes: OPERATOR_VIDEO_MAX_BYTES + 1,
      mimeType: 'video/mp4',
    }, IDEA)
    expect(big.ok).toBe(false)

    const nameless = parseRetry({
      step: 'register',
      key: `ideas/${IDEA}/edited/10-corte.mp4`,
      sizeBytes: 10,
      mimeType: 'video/mp4',
    }, IDEA)
    expect(nameless.ok).toBe(false)
  })

  it('upload del reintento también es solo el editado', () => {
    expect(parseRetry({ step: 'upload', fileName: 'c.mp4', contentType: 'video/mp4' }, IDEA).ok).toBe(true)
    expect(parseRetry({ step: 'upload', kind: 'raw', fileName: 'c.mp4', contentType: 'video/mp4' }, IDEA).ok).toBe(false)
    expect(parseRetry({ step: 'caption' }, IDEA)).toEqual({ ok: true, step: 'caption' })
  })
})

describe('includePipelineRow', () => {
  it('deja las ideas sin theme y saca solo el parqueo operator-hold', () => {
    expect(includePipelineRow({ theme: null })).toBe(true)
    expect(includePipelineRow({ theme: undefined })).toBe(true)
    expect(includePipelineRow({ theme: 'verano' })).toBe(true)
    expect(includePipelineRow({ theme: OPERATOR_HOLD_THEME })).toBe(false)
    expect(includePipelineRow({ theme: 'operator-hold' })).toBe(false)
  })
})

describe('acceptsEditedUpload', () => {
  const open = {
    status: 'grabada',
    approval_status: 'pending',
    published_at: null,
    theme: null,
    videos: [video({ id: 'raw-1', kind: 'raw' })],
  }

  it('acepta la cola de Editores y rechaza descarte, aprobado, publicado y quien ya tiene corte', () => {
    expect(acceptsEditedUpload(open)).toBe(true)
    expect(acceptsEditedUpload({ ...open, theme: 'operator-hold', status: 'descartada' })).toBe(false)
    expect(acceptsEditedUpload({ ...open, status: 'descartada' })).toBe(false)
    expect(acceptsEditedUpload({ ...open, approval_status: 'approved' })).toBe(false)
    expect(acceptsEditedUpload({ ...open, published_at: '2026-10-01T00:00:00Z' })).toBe(false)
    expect(acceptsEditedUpload({
      ...open,
      videos: [...open.videos, video({ id: 'ed-1', kind: 'edited' })],
    })).toBe(false)
    expect(acceptsEditedUpload({ ...open, videos: [] })).toBe(false)
  })
})

describe('pipelineVideoInsert', () => {
  it('registra el archivo en r2 y no trae campos de la idea', () => {
    const row = pipelineVideoInsert({
      ideaId: IDEA,
      key: `ideas/${IDEA}/edited/10-corte.mp4`,
      name: 'corte.mp4',
      sizeBytes: 12,
      mimeType: 'video/mp4',
    })
    expect(row).toEqual({
      idea_id: IDEA,
      kind: 'edited',
      name: 'corte.mp4',
      drive_file_id: `ideas/${IDEA}/edited/10-corte.mp4`,
      storage_provider: 'r2',
      size_bytes: 12,
      mime_type: 'video/mp4',
      uploaded_by: null,
      status: 'uploaded',
    })
    expect(row).not.toHaveProperty('approval_status')
    expect(row).not.toHaveProperty('theme')
    expect(row).not.toHaveProperty('submitted_at')
  })
})

describe('shapePipelineItem', () => {
  it('habla el lenguaje del tab Pipeline de videos, no el de Entregas', () => {
    const view = shapePipelineItem({
      id: IDEA,
      client_id: CLIENT,
      title: 'Reel de verano',
      hook: 'De qué va',
      content_type: 'R',
      status: 'grabada',
      approval_status: 'pending',
      publish_date: null,
      published_at: null,
      generated_caption: null,
      caption_draft: 'borrador',
      theme: null,
      created_at: '2026-10-20T00:00:00Z',
      client: { id: CLIENT, name: 'La Güira' },
      videos: [video({ id: 'raw-1' })],
    }, { assetCount: 0 })

    expect(view.readyToEdit).toBe(true)
    expect(view.contentTypeLabel).toBe('Reel')
    expect(view.statusLabel).toBe('Grabada')
    expect(view.approvalLabel).toBe('Sin enviar')
    expect(view.slots).toEqual({ raw: 1, broll: 0, edited: 0 })
    expect(view.progress.stages.map((s) => s.label)).toEqual([
      'Idea', 'Material', 'Editado', 'Banco', 'Aprobación', 'Caption', 'Publicado',
    ])
    expect(view.progress.stages.find((s) => s.key === 'caption')?.done).toBe(false)
    expect(view.stageLabel).toBe('Editado')
    expect(view.retryable).toEqual(['upload', 'register', 'caption'])
    expect(view.outputs[0]).toMatchObject({ kind: 'raw', videoId: 'raw-1' })
    expect(JSON.stringify(view)).not.toMatch(/waiting|Esperando archivo|entregas-r2/)
  })
})

describe('parseListQuery', () => {
  it('cola por defecto todos y acepta editores', () => {
    const params = new URLSearchParams()
    const parsed = parseListQuery(params)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value).toEqual({ clientId: null, limit: 20, queue: 'todos' })

    const editors = parseListQuery(new URLSearchParams('queue=editores&limit=5'))
    expect(editors.ok).toBe(true)
    if (!editors.ok) return
    expect(editors.value.queue).toBe('editores')
    expect(editors.value.limit).toBe(5)
  })
})
