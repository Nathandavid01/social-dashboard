import { describe, it, expect } from 'vitest'
import { isAllowedVideoUploadType, safeServeContentType } from './video-upload-guard'

describe('isAllowedVideoUploadType — whitelist al SUBIR (audit: XSS almacenado vía Content-Type)', () => {
  it('acepta los tipos concretos que ya usa el repo: mp4, quicktime (mov), webm', () => {
    expect(isAllowedVideoUploadType('video/mp4')).toBe(true)
    expect(isAllowedVideoUploadType('video/quicktime')).toBe(true)
    expect(isAllowedVideoUploadType('video/webm')).toBe(true)
  })

  it('acepta cualquier subtipo video/* (p.ej. x-m4v de iPhone)', () => {
    expect(isAllowedVideoUploadType('video/x-m4v')).toBe(true)
  })

  it('es insensible a mayúsculas', () => {
    expect(isAllowedVideoUploadType('VIDEO/MP4')).toBe(true)
  })

  it('ignora parámetros después de ; (codecs)', () => {
    expect(isAllowedVideoUploadType('video/mp4;codecs=avc1')).toBe(true)
  })

  it('rechaza text/html — el hueco de la auditoría', () => {
    expect(isAllowedVideoUploadType('text/html')).toBe(false)
  })

  it('rechaza image/svg+xml (otro vector de XSS)', () => {
    expect(isAllowedVideoUploadType('image/svg+xml')).toBe(false)
  })

  it('rechaza application/octet-stream disfrazado', () => {
    expect(isAllowedVideoUploadType('application/octet-stream')).toBe(false)
  })

  it('rechaza "video/" solo (subtipo vacío) — falla cerrado', () => {
    expect(isAllowedVideoUploadType('video/')).toBe(false)
  })

  it('rechaza vacío, null o undefined — falla cerrado', () => {
    expect(isAllowedVideoUploadType('')).toBe(false)
    expect(isAllowedVideoUploadType(null)).toBe(false)
    expect(isAllowedVideoUploadType(undefined)).toBe(false)
  })
})

describe('safeServeContentType — al SERVIR, nunca confiar en lo guardado', () => {
  it('deja pasar un video/* guardado', () => {
    expect(safeServeContentType('video/mp4')).toBe('video/mp4')
    expect(safeServeContentType('video/quicktime')).toBe('video/quicktime')
  })

  it('degrada text/html a application/octet-stream', () => {
    expect(safeServeContentType('text/html')).toBe('application/octet-stream')
  })

  it('degrada image/svg+xml a application/octet-stream', () => {
    expect(safeServeContentType('image/svg+xml')).toBe('application/octet-stream')
  })

  it('degrada vacío/null/undefined a application/octet-stream', () => {
    expect(safeServeContentType('')).toBe('application/octet-stream')
    expect(safeServeContentType(null)).toBe('application/octet-stream')
    expect(safeServeContentType(undefined)).toBe('application/octet-stream')
  })

  it('normaliza mayúsculas y strip de parámetros igual que al subir', () => {
    expect(safeServeContentType('VIDEO/MP4;codecs=avc1')).toBe('video/mp4')
  })
})
