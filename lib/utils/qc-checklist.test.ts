import { describe, it, expect } from 'vitest'
import { qcChecklist } from './qc-checklist'
import type { VideoAnalysisFindings } from '@/lib/llm/video-analysis-core'

const findings = (over: Partial<VideoAnalysisFindings> = {}): VideoAnalysisFindings => ({
  burned_captions: { text: '', issues: [] },
  relevance: { verdict: 'ok', explanation: 'coincide' },
  visual_summary: '',
  ...over,
})

describe('qcChecklist (5 checks fijos al subir)', () => {
  it('pending: las 5 filas en espera, fotogramas si hay count', () => {
    const rows = qcChecklist({
      status: 'pending',
      findings: null,
      frameCount: 12,
      uploadedBy: null,
    })
    expect(rows.map((r) => r.text)).toEqual([
      '¿Del cliente? …',
      'Captions …',
      'Formato …',
      'Quién lo subió …',
      'Errores …',
      '12 fotogramas extraídos',
    ])
    expect(rows.every((r) => r.state === 'wait' || r.key === 'frames')).toBe(true)
    expect(rows.find((r) => r.key === 'frames')?.state).toBe('ok')
  })

  it('done: cliente + %, captions, uploader, errores, fotogramas', () => {
    const rows = qcChecklist({
      status: 'done',
      findings: findings({
        relevance: { verdict: 'ok', confidence: 87, explanation: 'sí' },
        burned_captions: { text: 'Ven hoy', issues: [] },
      }),
      frameCount: 48,
      uploadedBy: 'María',
    })
    expect(rows.map((r) => `${r.state}|${r.text}`)).toEqual([
      'ok|Del cliente · 87% de confiabilidad',
      'ok|Captions: Libre de errores',
      'wait|Formato: sin dato',
      'ok|Lo subió María',
      'ok|Sin errores de QC',
      'ok|48 fotogramas extraídos',
    ])
  })

  it('no es del cliente: warning + % (fallback 45 si no hay confidence)', () => {
    const rows = qcChecklist({
      status: 'done',
      findings: findings({ relevance: { verdict: 'warning', explanation: 'otro negocio' } }),
      frameCount: 0,
      uploadedBy: null,
    })
    expect(rows[0]).toEqual({
      key: 'client',
      state: 'warn',
      text: 'No parece del cliente · 45% de confiabilidad',
    })
    expect(rows[3].text).toBe('Quién lo subió: sin dato')
    expect(rows[3].state).toBe('wait')
  })

  it('captions vacíos → No tiene captions; issues → N error(es)', () => {
    const empty = qcChecklist({
      status: 'done',
      findings: findings(),
      frameCount: null,
      uploadedBy: 'Eric',
    })
    expect(empty[1]).toEqual({ key: 'captions', state: 'warn', text: 'Captions: No tiene captions' })

    const bad = qcChecklist({
      status: 'done',
      findings: findings({
        burned_captions: { text: 'aserca', issues: [{ quote: 'aserca', problem: 'orto', suggestion: 'acerca' }] },
      }),
      frameCount: null,
      uploadedBy: 'Eric',
    })
    expect(bad[1]).toEqual({ key: 'captions', state: 'warn', text: 'Captions: 1 error' })
    expect(bad[4]).toEqual({ key: 'errors', state: 'warn', text: 'Hay errores de QC' })
  })

  it('sin fotogramas extraídos todavía → wait, no se oculta la fila', () => {
    const rows = qcChecklist({
      status: 'done',
      findings: findings(),
      frameCount: null,
      uploadedBy: 'Eric',
    })
    expect(rows[5]).toEqual({ key: 'frames', state: 'wait', text: 'Fotogramas: todavía no' })
  })
})

describe('qcChecklist — fila Formato (v4.15)', () => {
  it('con formato limpio: 9:16 · 1080×1920 · 18 s en verde', () => {
    const rows = qcChecklist({ status: 'done', uploadedBy: 'Carlos', frameCount: 5, findings: findings({ format: { width: 1080, height: 1920, durationSec: 18, aspect: '9:16', orientation: 'vertical', issues: [] } }) })
    expect(rows.find((r) => r.key === 'format')).toEqual({ key: 'format', state: 'ok', text: 'Formato: 9:16 · 1080×1920 · 18 s' })
  })
  it('con avisos: los cuenta y queda en ámbar', () => {
    const rows = qcChecklist({ status: 'done', uploadedBy: null, frameCount: 5, findings: findings({ format: { width: 1920, height: 1080, durationSec: 100, aspect: '16:9', orientation: 'horizontal', issues: [{ problem: 'a', suggestion: 'b' }, { problem: 'c', suggestion: 'd' }] } }) })
    expect(rows.find((r) => r.key === 'format')).toEqual({ key: 'format', state: 'warn', text: 'Formato: 2 avisos · 16:9 · 1920×1080 · 100 s' })
  })
  it('análisis viejo sin formato: "sin dato", no inventa', () => {
    const rows = qcChecklist({ status: 'done', uploadedBy: null, frameCount: 5, findings: findings() })
    expect(rows.find((r) => r.key === 'format')).toEqual({ key: 'format', state: 'wait', text: 'Formato: sin dato' })
  })
})
