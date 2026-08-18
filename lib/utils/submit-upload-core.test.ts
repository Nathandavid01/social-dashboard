import { describe, it, expect, vi, beforeEach } from 'vitest'
import { submitOneVideo, type SubmitDeps, type SubmitInput } from './submit-upload-core'

function file(name = 'reel.mp4', size = 1000, type = 'video/mp4'): File {
  const f = new File(['x'], name, { type })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

const input: SubmitInput = {
  clientId: 'c1',
  title: 'Reel de abril',
  hook: 'Un socio cuenta su progreso',
  driveLink: null,
  publishDate: '2026-08-03',
  file: file(),
}

function deps(over: Partial<SubmitDeps> = {}): SubmitDeps {
  return {
    createIdea: vi.fn(async () => ({ idea: { id: 'idea-1' } })),
    getUploadUrl: vi.fn(async () => ({ url: 'https://r2/put', key: 'ideas/idea-1/edited/reel.mp4' })),
    putFile: vi.fn(async () => {}),
    registerVideo: vi.fn(async () => ({ ok: true as const, id: 'video-1' })),
    ...over,
  }
}

beforeEach(() => vi.clearAllMocks())

describe('submitOneVideo — cadena completa', () => {
  it('crear → presign → subir → registrar, en ese orden', async () => {
    const order: string[] = []
    const d = deps({
      createIdea: vi.fn(async () => { order.push('crear'); return { idea: { id: 'idea-1' } } }),
      getUploadUrl: vi.fn(async () => { order.push('presign'); return { url: 'u', key: 'k' } }),
      putFile: vi.fn(async () => { order.push('subir') }),
      registerVideo: vi.fn(async () => { order.push('registrar'); return { ok: true as const, id: 'video-1' } }),
    })
    const r = await submitOneVideo(d, input)
    expect(r).toEqual({ ok: true, ideaId: 'idea-1', videoId: 'video-1', stage: 'listo' })
    expect(order).toEqual(['crear', 'presign', 'subir', 'registrar'])
  })

  it('el presign va contra la idea recién creada', async () => {
    const d = deps()
    await submitOneVideo(d, input)
    expect(d.getUploadUrl).toHaveBeenCalledWith({
      ideaId: 'idea-1', kind: 'edited', fileName: 'reel.mp4', contentType: 'video/mp4',
    })
  })

  it('registra con la key que devolvió el presign y el peso real', async () => {
    const d = deps()
    const f = file('otro.mp4', 4242)
    await submitOneVideo(d, { ...input, file: f })
    expect(d.registerVideo).toHaveBeenCalledWith({
      ideaId: 'idea-1', kind: 'edited', key: 'ideas/idea-1/edited/reel.mp4',
      name: 'otro.mp4', sizeBytes: 4242, mimeType: 'video/mp4', file: f,
    })
  })

  it('un archivo sin mime asume video/mp4', async () => {
    const d = deps()
    await submitOneVideo(d, { ...input, file: file('x.mp4', 10, '') })
    expect(d.getUploadUrl).toHaveBeenCalledWith(expect.objectContaining({ contentType: 'video/mp4' }))
  })
})

describe('submitOneVideo — fallos', () => {
  it('si crear falla, no intenta subir nada', async () => {
    const d = deps({ createIdea: vi.fn(async () => ({ error: 'No autorizado' })) })
    const r = await submitOneVideo(d, input)
    expect(r).toEqual({ ok: false, stage: 'creando', error: 'No autorizado' })
    expect(d.getUploadUrl).not.toHaveBeenCalled()
    expect(d.putFile).not.toHaveBeenCalled()
  })

  it('si el presign falla, la idea ya creada se reporta para poder reintentar', async () => {
    const d = deps({ getUploadUrl: vi.fn(async () => ({ error: 'R2 no configurado' })) })
    const r = await submitOneVideo(d, input)
    expect(r).toEqual({ ok: false, ideaId: 'idea-1', stage: 'subiendo', error: 'R2 no configurado' })
    expect(d.registerVideo).not.toHaveBeenCalled()
  })

  it('si la subida revienta, no registra un video que no está', async () => {
    const d = deps({ putFile: vi.fn(async () => { throw new Error('Red caída') }) })
    const r = await submitOneVideo(d, input)
    expect(r).toEqual({ ok: false, ideaId: 'idea-1', stage: 'subiendo', error: 'Red caída' })
    expect(d.registerVideo).not.toHaveBeenCalled()
  })

  it('si registrar falla lo dice, con la idea para no perderla', async () => {
    const d = deps({ registerVideo: vi.fn(async () => ({ error: 'columna inválida' })) })
    const r = await submitOneVideo(d, input)
    expect(r).toEqual({ ok: false, ideaId: 'idea-1', stage: 'registrando', error: 'columna inválida' })
  })

  it('una excepción cruda no se escapa: vuelve como resultado', async () => {
    const d = deps({ createIdea: vi.fn(async () => { throw new Error('boom') }) })
    await expect(submitOneVideo(d, input)).resolves.toEqual({
      ok: false, stage: 'creando', error: 'boom',
    })
  })
})

describe('submitOneVideo — progreso', () => {
  it('reporta las etapas en orden y termina en listo', async () => {
    const stages: string[] = []
    const d = deps({
      putFile: vi.fn(async (_u, _f, onP) => { onP(50); onP(100) }),
    })
    await submitOneVideo(d, input, (stage) => stages.push(stage))
    expect(stages[0]).toBe('creando')
    expect(stages).toContain('subiendo')
    expect(stages).toContain('registrando')
    expect(stages[stages.length - 1]).toBe('listo')
  })

  it('el porcentaje de subida llega al que escucha', async () => {
    const pcts: number[] = []
    const d = deps({ putFile: vi.fn(async (_u, _f, onP) => { onP(25); onP(80) }) })
    await submitOneVideo(d, input, (stage, pct) => { if (stage === 'subiendo') pcts.push(pct) })
    expect(pcts).toContain(25)
    expect(pcts).toContain(80)
  })
})
