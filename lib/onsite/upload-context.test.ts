import { describe, expect, it } from 'vitest'
import {
  buildOnsiteUploadContext,
  footageLabel,
  mergeInFlightUploads,
  uploadStatusLabel,
  uploadTargetSummary,
  withRawCount,
} from './upload-context'

describe('footageLabel', () => {
  it('dice Ya hay crudo cuando hay al menos un raw vivo', () => {
    expect(footageLabel(1)).toBe('Ya hay crudo')
    expect(footageLabel(4)).toBe('Ya hay crudo')
  })

  it('dice Falta crudo cuando no hay raw', () => {
    expect(footageLabel(0)).toBe('Falta crudo')
  })
})

describe('uploadStatusLabel', () => {
  it('usa el mismo español que el panel de material', () => {
    expect(uploadStatusLabel('uploaded')).toBe('Subido')
    expect(uploadStatusLabel('uploading')).toBe('Subiendo')
    expect(uploadStatusLabel('processing')).toBe('Procesando')
    expect(uploadStatusLabel('failed')).toBe('Falló')
    expect(uploadStatusLabel('archived')).toBe('Archivado')
  })
})

describe('uploadTargetSummary', () => {
  it('nombra cliente, sesión e ideas de un vistazo', () => {
    expect(uploadTargetSummary({
      clientName: 'Blue Chiropractic',
      sessionTitle: 'Mañana Arecibo',
      ideaCount: 3,
    })).toBe('Blue Chiropractic · Mañana Arecibo · 3 ideas')
  })

  it('singulariza una idea y usa Sesión si no hay título', () => {
    expect(uploadTargetSummary({
      clientName: 'El Truco',
      sessionTitle: '',
      ideaCount: 1,
    })).toBe('El Truco · Sesión · 1 idea')
  })
})

describe('buildOnsiteUploadContext', () => {
  const shots = [
    { id: 'i1', title: 'Intro Patricia' },
    { id: 'i2', title: 'Tour de sala' },
  ]

  it('cuenta solo crudos vivos por idea y lista lo subido', () => {
    const ctx = buildOnsiteUploadContext({
      sessionId: 's1',
      clientName: 'Blue Chiropractic',
      sessionTitle: 'Mañana',
      sessionDate: '2026-09-21',
      shots,
      videos: [
        { id: 'v1', name: 'IMG_1.MOV', status: 'uploaded', kind: 'raw', idea_id: 'i1' },
        { id: 'v2', name: 'IMG_2.MOV', status: 'uploading', kind: 'raw', idea_id: 'i1' },
        { id: 'v3', name: 'edit.mp4', status: 'uploaded', kind: 'edited', idea_id: 'i1' },
        { id: 'v4', name: 'old.mp4', status: 'archived', kind: 'raw', idea_id: 'i2' },
      ],
    })

    expect(ctx.ideas).toEqual([
      { ideaId: 'i1', title: 'Intro Patricia', rawCount: 2 },
      { ideaId: 'i2', title: 'Tour de sala', rawCount: 0 },
    ])
    expect(ctx.uploads).toEqual([
      { videoId: 'v1', name: 'IMG_1.MOV', status: 'uploaded', ideaId: 'i1', ideaTitle: 'Intro Patricia' },
      { videoId: 'v2', name: 'IMG_2.MOV', status: 'uploading', ideaId: 'i1', ideaTitle: 'Intro Patricia' },
    ])
  })

  it('no inventa ideas: si el call sheet está vacío, no hay filas', () => {
    const ctx = buildOnsiteUploadContext({
      sessionId: 's1',
      clientName: 'Blue',
      sessionTitle: 'Hoy',
      sessionDate: '2026-09-21',
      shots: [],
      videos: [{ id: 'v1', name: 'x.mp4', status: 'uploaded', kind: 'raw', idea_id: 'ghost' }],
    })
    expect(ctx.ideas).toEqual([])
    expect(ctx.uploads).toEqual([])
  })
})

describe('mergeInFlightUploads', () => {
  it('añade subidas en vuelo de las ideas de la sesión y no duplica las de DB', () => {
    const merged = mergeInFlightUploads(
      [{ videoId: 'v1', name: 'ya.mp4', status: 'uploaded', ideaId: 'i1', ideaTitle: 'Intro' }],
      [
        { id: 'v1', fileName: 'ya.mp4', ideaId: 'i1', phase: 'listo' },
        { id: 'up-2', fileName: 'nuevo.MOV', ideaId: 'i1', phase: 'subiendo' },
        { id: 'up-3', fileName: 'otro.mp4', ideaId: 'otro', phase: 'subiendo' },
      ],
      new Map([['i1', 'Intro']]),
    )
    expect(merged).toEqual([
      { videoId: 'v1', name: 'ya.mp4', status: 'uploaded', ideaId: 'i1', ideaTitle: 'Intro' },
      { videoId: 'up-2', name: 'nuevo.MOV', status: 'uploading', ideaId: 'i1', ideaTitle: 'Intro' },
    ])
  })

  it('no lista un duplicado o cancelado como si se estuviera subiendo', () => {
    const merged = mergeInFlightUploads(
      [],
      [
        { id: 'up-dup', fileName: 'mismo.mp4', ideaId: 'i1', phase: 'duplicado' },
        { id: 'up-can', fileName: 'no.mp4', ideaId: 'i1', phase: 'cancelado' },
        { id: 'up-ok', fileName: 'nuevo.mp4', ideaId: 'i1', phase: 'subiendo' },
      ],
      new Map([['i1', 'Intro']]),
    )
    expect(merged).toEqual([
      { videoId: 'up-ok', name: 'nuevo.mp4', status: 'uploading', ideaId: 'i1', ideaTitle: 'Intro' },
    ])
  })
})

describe('withRawCount', () => {
  it('pega el conteo de crudo en cada toma del call sheet', () => {
    const shots = withRawCount(
      [{ id: 'i1', title: 'A' }, { id: 'i2', title: 'B' }],
      [{ ideaId: 'i1', title: 'A', rawCount: 2 }],
    )
    expect(shots[0].rawCount).toBe(2)
    expect(shots[1].rawCount).toBe(0)
  })
})
