import { describe, it, expect } from 'vitest'
import { uploadPhaseText } from './upload-phase-text'
import type { UploadItem, UploadPhase } from '@/lib/stores/upload-store'

function item(phase: UploadPhase, overrides: Partial<UploadItem> = {}): UploadItem {
  return {
    id: 'u1', fileName: 'a.mp4', sizeBytes: 1000, ideaId: 'idea-1', kind: 'edited', provider: 'r2',
    phase, pct: 0, partsDone: 0, partsTotal: 1, attempt: 0, ...overrides,
  }
}

describe('uploadPhaseText', () => {
  it('subiendo shows the percent, and part count only when multipart', () => {
    expect(uploadPhaseText(item('subiendo', { pct: 45 }))).toBe('Subiendo… 45%')
    expect(uploadPhaseText(item('subiendo', { pct: 45, partsDone: 11, partsTotal: 26 }))).toBe('Subiendo… 45% · parte 12 de 26')
  })

  it('reintentando shows the attempt out of 5', () => {
    expect(uploadPhaseText(item('reintentando', { attempt: 2 }))).toMatch(/reintentando \(2 de 5\)/)
  })

  it('every phase has its own text', () => {
    const phases: UploadPhase[] = ['preparando', 'subiendo', 'reintentando', 'ensamblando', 'registrando', 'analizando', 'listo', 'error', 'cancelado']
    const texts = new Set(phases.map((p) => uploadPhaseText(item(p))))
    expect(texts.size).toBe(phases.length)
  })

  it('error includes the message when present', () => {
    expect(uploadPhaseText(item('error', { error: 'R2 500' }))).toBe('Falló: R2 500')
    expect(uploadPhaseText(item('error'))).toBe('Falló la subida')
  })
})
