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
    expect(rows[2].text).toBe('Quién lo subió: sin dato')
    expect(rows[2].state).toBe('wait')
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
    expect(bad[3]).toEqual({ key: 'errors', state: 'warn', text: 'Hay errores de QC' })
  })

  it('sin fotogramas extraídos todavía → wait, no se oculta la fila', () => {
    const rows = qcChecklist({
      status: 'done',
      findings: findings(),
      frameCount: null,
      uploadedBy: 'Eric',
    })
    expect(rows[4]).toEqual({ key: 'frames', state: 'wait', text: 'Fotogramas: todavía no' })
  })
})
