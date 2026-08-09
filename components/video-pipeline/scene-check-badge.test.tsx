import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SceneCheckBadge } from './scene-check-badge'
import type { SceneCheckReport } from '@/lib/llm/scene-check-types'

const base = { checkedAt: '2026-08-06T12:00:00Z', framesAnalyzed: 10, videoTopic: null }

describe('SceneCheckBadge', () => {
  it('sin reporte → no renderiza nada', () => {
    const { container } = render(<SceneCheckBadge report={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('status ok → badge verde de revisado', () => {
    const report: SceneCheckReport = {
      ...base,
      status: 'ok',
      issues: [],
      clientMatch: {
        status: 'match',
        reason: 'El logo y el producto coinciden.',
        evidence: ['Logo Acme visible'],
      },
    }
    render(<SceneCheckBadge report={report} />)
    expect(screen.getByText(/subtítulos revisados/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /corresponde al cliente/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /corresponde al cliente/i }))
    expect(screen.getByText(/logo y el producto coinciden/i)).toBeInTheDocument()
  })

  it('status issues → badge ámbar con el conteo y detalle expandible', () => {
    const report: SceneCheckReport = {
      ...base,
      status: 'issues',
      issues: [
        { text: 'exelente', problem: '«exelente» → «excelente»', approxSecond: 12 },
        { text: 'aser', problem: '«aser» → «hacer»', approxSecond: null },
      ],
    }
    render(<SceneCheckBadge report={report} />)
    expect(screen.getByText(/2 posibles errores/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /2 posibles errores/i }))
    expect(screen.getByText(/«exelente» → «excelente»/)).toBeInTheDocument()
    expect(screen.getByText(/0:12/)).toBeInTheDocument()
    // issue sin segundo: no muestra timestamp
    expect(screen.getByText(/«aser» → «hacer»/)).toBeInTheDocument()
  })

  it('1 solo issue → singular', () => {
    const report: SceneCheckReport = {
      ...base, status: 'issues',
      issues: [{ text: 'x', problem: 'y', approxSecond: null }],
    }
    render(<SceneCheckBadge report={report} />)
    expect(screen.getByText(/1 posible error/i)).toBeInTheDocument()
  })

  it('status error / skipped → nota discreta', () => {
    const report: SceneCheckReport = { ...base, status: 'error', issues: [], error: 'Grok API 500' }
    render(<SceneCheckBadge report={report} />)
    expect(screen.getByText(/revisión ai no disponible/i)).toBeInTheDocument()
  })

  it('mismatch → alerta clara de que no parece ser del cliente', () => {
    const report: SceneCheckReport = {
      ...base,
      status: 'ok',
      issues: [],
      clientMatch: {
        status: 'mismatch',
        reason: 'Aparece el nombre de otra empresa.',
        evidence: ['Logo Beta visible'],
      },
    }
    render(<SceneCheckBadge report={report} />)
    expect(screen.getByRole('button', { name: /no parece ser del cliente/i })).toBeInTheDocument()
  })

  it('uncertain → no inventa una coincidencia', () => {
    const report: SceneCheckReport = {
      ...base,
      status: 'ok',
      issues: [],
      clientMatch: {
        status: 'uncertain',
        reason: 'El contenido es genérico.',
        evidence: [],
      },
    }
    render(<SceneCheckBadge report={report} />)
    expect(screen.getByRole('button', { name: /cliente no confirmado/i })).toBeInTheDocument()
  })
})
