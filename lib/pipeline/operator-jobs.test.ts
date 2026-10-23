import { describe, expect, it } from 'vitest'
import { ideaStage } from '@/lib/entregas/batches'
import {
  decideRegister,
  entregasEditedObjectKey,
  ideaInsertForStart,
  isClosedForNewFile,
  parseRetry,
  parseStartJob,
  rawVideoInsert,
  registerUpdate,
  shapeOperatorJob,
} from './operator-jobs'

const CLIENT = '11111111-1111-4111-8111-111111111111'

describe('parseStartJob', () => {
  it('rechaza un cuerpo vacío', () => {
    expect(parseStartJob(null).ok).toBe(false)
  })

  it('normaliza un corte editado con link de Drive y no pide subida de crudo', () => {
    const parsed = parseStartJob({
      clientId: CLIENT,
      title: '  Reel de verano  ',
      hook: ' De qué va ',
      publishDate: '2026-10-24',
      driveLink: 'https://drive.google.com/file/d/abcdefghijklmnopqrstuvwxyz/view',
      phase: 'edited',
      fileName: 'corte.mp4',
      contentType: 'video/mp4',
    })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.title).toBe('Reel de verano')
    expect(parsed.value.hook).toBe('De qué va')
    expect(parsed.value.phase).toBe('edited')
    expect(parsed.value.driveFileId).toBe('abcdefghijklmnopqrstuvwxyz')
    expect(parsed.value.fileName).toBe('corte.mp4')
    expect(parsed.value.contentType).toBe('video/mp4')
  })

  it('el material crudo no se sube al bucket de Entregas', () => {
    const parsed = parseStartJob({
      clientId: CLIENT,
      title: 'Toma 1',
      phase: 'raw',
      fileName: 'crudo.mp4',
      contentType: 'video/mp4',
    })
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.error).toMatch(/Drive/i)
  })

  it('rechaza un tipo que no es video', () => {
    const parsed = parseStartJob({
      clientId: CLIENT,
      title: 'Corte',
      fileName: 'nota.txt',
      contentType: 'text/plain',
    })
    expect(parsed.ok).toBe(false)
  })
})

describe('ideaInsertForStart', () => {
  it('un editado nace pendiente, no en revisión, y el crudo queda grabado', () => {
    const edited = parseStartJob({ clientId: CLIENT, title: 'Corte', driveLink: 'abcdefghijklmnopqrstuvwxyz' })
    if (!edited.ok) throw new Error(edited.error)
    expect(ideaInsertForStart(edited.value)).toMatchObject({
      client_id: CLIENT,
      content_type: 'R',
      title: 'Corte',
      status: 'descartada',
      approval_status: 'pending',
      theme: 'operator-hold',
      visual_brief: 'Referencia en Drive: https://drive.google.com/file/d/abcdefghijklmnopqrstuvwxyz/view',
    })
    expect(ideaInsertForStart(edited.value)).not.toHaveProperty('submitted_at')

    const raw = parseStartJob({
      clientId: CLIENT,
      title: 'Toma',
      phase: 'raw',
      driveLink: 'https://drive.google.com/file/d/abcdefghijklmnopqrstuvwxyz/view',
    })
    if (!raw.ok) throw new Error(raw.error)
    expect(ideaInsertForStart(raw.value)).toMatchObject({ status: 'grabada', approval_status: 'pending' })
    expect(rawVideoInsert('idea-9', raw.value)).toMatchObject({
      idea_id: 'idea-9',
      kind: 'raw',
      storage_provider: 'drive',
      drive_file_id: 'abcdefghijklmnopqrstuvwxyz',
      status: 'uploaded',
    })
  })
})

describe('registro del corte', () => {
  it('la key del objeto vive bajo entregas/{idea}/edited/', () => {
    expect(entregasEditedObjectKey('idea-1', 'La Güira.mp4', 10)).toBe(
      'entregas/idea-1/edited/10-la-guira.mp4',
    )
  })

  it('un corte pendiente entra a revisión; uno aprobado no acepta otro archivo', () => {
    expect(decideRegister({ status: 'producida', approval_status: 'pending' })).toEqual({
      ok: true,
      submitToReview: true,
    })
    expect(decideRegister({ status: 'descartada', approval_status: 'pending', theme: 'operator-hold' })).toEqual({
      ok: true,
      submitToReview: true,
    })
    expect(isClosedForNewFile({ status: 'descartada', approval_status: 'pending' })).toBe(true)
    expect(isClosedForNewFile({ status: 'producida', approval_status: 'approved' })).toBe(true)
    const closed = decideRegister({ status: 'producida', approval_status: 'approved' })
    expect(closed.ok).toBe(false)
  })

  it('revision_needed registra el archivo y no lo reenvía solo', () => {
    const decision = decideRegister({ status: 'producida', approval_status: 'revision_needed' })
    expect(decision).toEqual({ ok: true, submitToReview: false })
    expect(
      registerUpdate(
        { status: 'producida', approval_status: 'revision_needed' },
        '2026-10-23T12:00:00.000Z',
      ),
    ).toBeNull()
  })

  it('el parche de revisión no toca el caption ni Metricool', () => {
    const patch = registerUpdate(
      { status: 'grabada', approval_status: 'pending' },
      '2026-10-23T12:00:00.000Z',
    )
    expect(patch).toEqual({
      status: 'producida',
      approval_status: 'submitted',
      submitted_at: '2026-10-23T12:00:00.000Z',
    })
    expect(
      registerUpdate(
        { status: 'descartada', approval_status: 'pending', theme: 'operator-hold' },
        '2026-10-23T12:00:00.000Z',
      ),
    ).toMatchObject({ status: 'producida', approval_status: 'submitted', theme: null })
    expect(patch).not.toHaveProperty('generated_caption')
    expect(patch).not.toHaveProperty('metricool_post_id')
  })
})

describe('parseRetry', () => {
  it('acepta caption, upload y register', () => {
    expect(parseRetry({ step: 'caption' })).toEqual({ ok: true, step: 'caption' })
    const upload = parseRetry({ step: 'upload', fileName: 'a.mp4', contentType: 'video/mp4' })
    expect(upload.ok).toBe(true)
    const registered = parseRetry({
      step: 'register',
      key: 'entregas/idea-1/edited/1-a.mp4',
      name: 'a.mp4',
      sizeBytes: 10,
      mimeType: 'video/mp4',
    })
    expect(registered.ok).toBe(true)
  })

  it('register rechaza una key fuera del corte de esa idea', () => {
    const bad = parseRetry({
      step: 'register',
      key: 'ideas/otra/raw/a.mp4',
      name: 'a.mp4',
      sizeBytes: 10,
      mimeType: 'video/mp4',
      ideaId: 'idea-1',
    })
    expect(bad.ok).toBe(false)
  })
})

describe('shapeOperatorJob', () => {
  it('usa la misma etapa que el tablero y lista salidas sin promover el borrador', () => {
    const view = shapeOperatorJob({
      id: 'idea-1',
      client_id: CLIENT,
      title: 'Reel',
      hook: 'gancho',
      status: 'producida',
      approval_status: 'approved',
      publish_date: '2026-10-24',
      published_at: null,
      generated_caption: null,
      caption_draft: 'borrador',
      metricool_post_id: null,
      posted_at: null,
      posting_started_at: null,
      visual_brief: null,
      created_at: '2026-10-23T00:00:00.000Z',
      client: { id: CLIENT, name: 'Cliente' },
      videos: [
        {
          id: 'v1',
          kind: 'edited',
          status: 'uploaded',
          storage_provider: 'entregas-r2',
          name: 'corte.mp4',
          drive_file_id: 'entregas/idea-1/edited/1-corte.mp4',
          drive_view_link: null,
          mime_type: 'video/mp4',
          size_bytes: 10,
          uploaded_at: '2026-10-23T00:00:00.000Z',
        },
      ],
    })
    expect(view.stage).toBe(
      ideaStage({
        status: 'producida',
        approval_status: 'approved',
        generated_caption: null,
        published_at: null,
      } as never),
    )
    expect(view.stage).toBe('copy')
    const parked = shapeOperatorJob({
      id: 'idea-hold',
      client_id: CLIENT,
      title: 'Sin corte',
      hook: null,
      status: 'descartada',
      approval_status: 'pending',
      theme: 'operator-hold',
      publish_date: null,
      published_at: null,
      generated_caption: null,
      caption_draft: null,
      metricool_post_id: null,
      posted_at: null,
      posting_started_at: null,
      visual_brief: null,
      created_at: '2026-10-23T00:00:00.000Z',
      client: { id: CLIENT, name: 'Cliente' },
      videos: [],
    })
    expect(parked.stage).toBe('waiting')
    expect(parked.stageLabel).toBe('Esperando archivo')
    expect(parked.retryable).toEqual(['upload', 'register'])
    expect(view.stageLabel).toBe('Copy')
    expect(view.outputs.some((o) => o.kind === 'caption_draft' && o.text === 'borrador')).toBe(true)
    expect(view.outputs.some((o) => o.kind === 'caption')).toBe(false)
    expect(view.retryable).toContain('caption')
    expect(view.retryable).not.toContain('upload')
  })

  it('la URL firmada solo se adjunta al corte vigente', () => {
    const view = shapeOperatorJob(
      {
        id: 'idea-1',
        client_id: CLIENT,
        title: 'Reel',
        hook: null,
        status: 'producida',
        approval_status: 'pending',
        publish_date: null,
        published_at: null,
        generated_caption: null,
        caption_draft: null,
        metricool_post_id: null,
        posted_at: null,
        posting_started_at: null,
        visual_brief: null,
        created_at: '2026-10-23T00:00:00.000Z',
        client: { id: CLIENT, name: 'Cliente' },
        videos: [
          {
            id: 'viejo',
            kind: 'edited',
            status: 'uploaded',
            storage_provider: 'entregas-r2',
            name: 'v1.mp4',
            drive_file_id: 'entregas/idea-1/edited/1-v1.mp4',
            drive_view_link: null,
            mime_type: 'video/mp4',
            size_bytes: 1,
            uploaded_at: '2026-10-22T00:00:00.000Z',
          },
          {
            id: 'nuevo',
            kind: 'edited',
            status: 'uploaded',
            storage_provider: 'entregas-r2',
            name: 'v2.mp4',
            drive_file_id: 'entregas/idea-1/edited/2-v2.mp4',
            drive_view_link: null,
            mime_type: 'video/mp4',
            size_bytes: 2,
            uploaded_at: '2026-10-23T00:00:00.000Z',
          },
        ],
      },
      { downloadUrl: 'https://firmada.example/v2', downloadVideoId: 'nuevo' },
    )
    const hrefs = Object.fromEntries(view.outputs.filter((o) => o.kind === 'edited').map((o) => [o.videoId, o.href]))
    expect(hrefs.nuevo).toBe('https://firmada.example/v2')
    expect(hrefs.viejo).toBeNull()
  })
})
