import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import { QcProgressDots } from './qc-progress-dots'
import * as actions from '@/lib/actions/video-analysis'
import * as analysisClient from '@/lib/utils/video-analysis-client'

/**
 * "Tres bolitas" de un vistazo: relevancia, captions sin errores, caption
 * generado. Mismo patrón de fetch/act() que video-analysis-report.test.tsx
 * (fetch real en useEffect, sin timers reales colgando).
 */

vi.mock('@/lib/actions/video-analysis', () => ({ getVideoAnalysis: vi.fn() }))
const mockGet = vi.mocked(actions.getVideoAnalysis)

vi.mock('@/lib/utils/video-analysis-client', () => ({ analyzeExistingVideo: vi.fn() }))
const mockAnalyze = vi.mocked(analysisClient.analyzeExistingVideo)

vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }))
const mockToast = vi.fn()

// Drives whether el usuario puede disparar el análisis (video.upload). Mutable across tests.
let canAnalyze = true
vi.mock('@/components/auth/role-gate', () => ({
  useHasPermission: () => canAnalyze,
}))

const okFindings = {
  burned_captions: { text: 'Bien escrito', issues: [] },
  relevance: { verdict: 'ok' as const, explanation: 'coincide con el cliente' },
  visual_summary: 'persona hablando a cámara',
}

const warningFindings = {
  burned_captions: {
    text: 'Ven hoy a nuestra clinica',
    issues: [
      { quote: 'clinica', problem: 'falta la tilde', suggestion: 'clínica' },
      { quote: 'Ven hoy', problem: 'falta signo de puntuación', suggestion: 'Ven hoy,' },
    ],
  },
  relevance: { verdict: 'warning' as const, explanation: 'no se menciona al cliente' },
  visual_summary: 'persona hablando a cámara',
}

describe('QcProgressDots', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    canAnalyze = true
  })

  it('done + relevancia ok + 0 issues + uploader + frames → las 5 filas', async () => {
    mockGet.mockResolvedValue({
      analysis: {
        status: 'done',
        findings: { ...okFindings, relevance: { ...okFindings.relevance, confidence: 87 } },
        hasCaption: true,
        frameCount: 48,
        uploadedBy: 'María',
      },
    })
    render(<QcProgressDots ideaId="i1" />)

    await waitFor(() => expect(screen.getByText('Del cliente · 87% de confiabilidad')).toBeInTheDocument())
    expect(screen.getByText('Captions: Libre de errores')).toBeInTheDocument()
    expect(screen.getByText('Lo subió María')).toBeInTheDocument()
    expect(screen.getByText('Sin errores de QC')).toBeInTheDocument()
    expect(screen.getByText('48 fotogramas extraídos')).toBeInTheDocument()
  })

  it('done + relevancia warning + 2 issues → cliente y captions ámbar, expandibles', async () => {
    mockGet.mockResolvedValue({ analysis: { status: 'done', findings: warningFindings, hasCaption: true, uploadedBy: 'María' } })
    render(<QcProgressDots ideaId="i1" />)

    await waitFor(() => expect(screen.getByText(/No parece del cliente/)).toBeInTheDocument())
    expect(screen.getByText('Captions: 2 errores')).toBeInTheDocument()
    expect(screen.getByText('Hay errores de QC')).toBeInTheDocument()

    expect(screen.queryByText(/no se menciona al cliente/)).not.toBeInTheDocument()
    expect(screen.queryByText(/clínica/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByText(/No parece del cliente/))
    expect(screen.getByText(/no se menciona al cliente/)).toBeInTheDocument()

    fireEvent.click(screen.getByText('Captions: 2 errores'))
    expect(screen.getByText(/clínica/)).toBeInTheDocument()
    expect(screen.getByText(/Ven hoy,/)).toBeInTheDocument()
  })

  it('pending → cliente, captions y errores en espera; fotogramas si hay count', async () => {
    mockGet.mockResolvedValue({ analysis: { status: 'pending', findings: null, hasCaption: false, frameCount: 12, uploadedBy: null } })
    render(<QcProgressDots ideaId="i1" />)

    await waitFor(() => expect(screen.getByText('¿Del cliente? …')).toBeInTheDocument())
    expect(screen.getByText('Captions …')).toBeInTheDocument()
    expect(screen.getByText('Quién lo subió …')).toBeInTheDocument()
    expect(screen.getByText('Errores …')).toBeInTheDocument()
    expect(screen.getByText('12 fotogramas extraídos')).toBeInTheDocument()
  })

  it('sin caption escrito no cambia las 5 filas de QC (el copy es aparte)', async () => {
    mockGet.mockResolvedValue({ analysis: { status: 'done', findings: okFindings, hasCaption: false, uploadedBy: 'Eric' } })
    render(<QcProgressDots ideaId="i1" />)
    await waitFor(() => expect(screen.getByText(/Del cliente/)).toBeInTheDocument())
    expect(screen.queryByText('Generando caption…')).not.toBeInTheDocument()
    expect(screen.queryByText('Caption generado')).not.toBeInTheDocument()
  })

  it('status error o findings null → filas en “no disponible”, no se rompe', async () => {
    mockGet.mockResolvedValue({ analysis: { status: 'error', findings: null, hasCaption: false } })
    render(<QcProgressDots ideaId="i1" />)

    await waitFor(() => expect(screen.getByText('¿Del cliente? no disponible')).toBeInTheDocument())
    expect(screen.getByText('Captions: no disponible')).toBeInTheDocument()
    expect(screen.getByText('Errores: no disponible')).toBeInTheDocument()
  })

  it('analysis: null (migración sin aplicar u otro fallo degradado) → no rompe: no renderiza nada', async () => {
    mockGet.mockResolvedValue({ analysis: null })
    const { container } = render(<QcProgressDots ideaId="i1" />)
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(container.textContent).toBe('')
  })

  it('sin warnings de act(): el fetch inicial se resuelve dentro de un solo act', async () => {
    mockGet.mockResolvedValue({ analysis: { status: 'done', findings: okFindings, hasCaption: true, uploadedBy: 'Eric' } })
    await act(async () => {
      render(<QcProgressDots ideaId="i1" />)
      await Promise.resolve()
    })
    expect(screen.getByText(/Del cliente/)).toBeInTheDocument()
  })

  it('sin frameCount (columna sin migrar / fila vieja) → “Fotogramas: todavía no”, no se oculta', async () => {
    mockGet.mockResolvedValue({ analysis: { status: 'done', findings: okFindings, hasCaption: true, uploadedBy: 'Eric' } })
    render(<QcProgressDots ideaId="i1" />)
    await waitFor(() => expect(screen.getByText('Fotogramas: todavía no')).toBeInTheDocument())
  })

  it('frame_count === 1 → singular “1 fotograma extraído”', async () => {
    mockGet.mockResolvedValue({ analysis: { status: 'done', findings: okFindings, hasCaption: true, frameCount: 1, uploadedBy: 'Eric' } })
    render(<QcProgressDots ideaId="i1" />)
    await waitFor(() => expect(screen.getByText('1 fotograma extraído')).toBeInTheDocument())
  })
})

describe('QcProgressDots — botón "Analizar con IA" / "Re-analizar" (v3.39)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    canAnalyze = true
  })

  it('sin análisis pero con videoId y permiso → sale "Analizar con IA"', async () => {
    mockGet.mockResolvedValue({ analysis: null })
    render(<QcProgressDots ideaId="i1" videoId="v1" />)
    await waitFor(() => expect(screen.getByRole('button', { name: /Analizar con IA/ })).toBeInTheDocument())
  })

  it('sin análisis y SIN videoId (no hay video editado) → no renderiza nada, como antes', async () => {
    mockGet.mockResolvedValue({ analysis: null })
    const { container } = render(<QcProgressDots ideaId="i1" />)
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(container.textContent).toBe('')
  })

  it('sin análisis, con videoId pero SIN permiso video.upload → no renderiza nada', async () => {
    canAnalyze = false
    mockGet.mockResolvedValue({ analysis: null })
    const { container } = render(<QcProgressDots ideaId="i1" videoId="v1" />)
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(container.textContent).toBe('')
  })

  it('con análisis existente y videoId + permiso → sale "Re-analizar" discreto junto a las bolitas', async () => {
    mockGet.mockResolvedValue({ analysis: { status: 'done', findings: okFindings, hasCaption: true } })
    render(<QcProgressDots ideaId="i1" videoId="v1" />)
    await waitFor(() => expect(screen.getByText('Re-analizar')).toBeInTheDocument())
  })

  it('con análisis existente pero SIN permiso → no sale "Re-analizar"', async () => {
    canAnalyze = false
    mockGet.mockResolvedValue({ analysis: { status: 'done', findings: okFindings, hasCaption: true } })
    render(<QcProgressDots ideaId="i1" videoId="v1" />)
    await waitFor(() => expect(screen.getByText(/Del cliente/)).toBeInTheDocument())
    expect(screen.queryByText('Re-analizar')).not.toBeInTheDocument()
  })

  it('con análisis existente pero SIN videoId → no sale "Re-analizar" (no hay qué re-analizar)', async () => {
    mockGet.mockResolvedValue({ analysis: { status: 'done', findings: okFindings, hasCaption: true } })
    render(<QcProgressDots ideaId="i1" />)
    await waitFor(() => expect(screen.getByText(/Del cliente/)).toBeInTheDocument())
    expect(screen.queryByText('Re-analizar')).not.toBeInTheDocument()
  })

  it('click en "Analizar con IA": llama a analyzeExistingVideo(videoId), muestra progreso, y al terminar refresca', async () => {
    mockGet
      .mockResolvedValueOnce({ analysis: null })
      .mockResolvedValueOnce({ analysis: { status: 'done', findings: okFindings, hasCaption: true } })
    let resolveAnalyze!: (v: { ok: true }) => void
    mockAnalyze.mockReturnValue(new Promise((r) => { resolveAnalyze = r }))

    render(<QcProgressDots ideaId="i1" videoId="v1" />)
    const btn = await screen.findByRole('button', { name: /Analizar con IA/ })
    fireEvent.click(btn)

    // Deshabilitado con spinner mientras corre.
    await waitFor(() => expect(screen.getByRole('button')).toBeDisabled())
    expect(mockAnalyze).toHaveBeenCalledWith('v1', expect.objectContaining({ onProgress: expect.any(Function) }))

    await act(async () => { resolveAnalyze({ ok: true }) })

    // Se refrescó vía el mismo hook → ahora muestra las bolitas.
    await waitFor(() => expect(screen.getByText(/Del cliente/)).toBeInTheDocument())
    expect(mockGet).toHaveBeenCalledTimes(2)
  })

  it('click en "Re-analizar" que falla → toast de error, panel sigue en pie', async () => {
    mockGet.mockResolvedValue({ analysis: { status: 'done', findings: okFindings, hasCaption: true } })
    mockAnalyze.mockResolvedValue({ error: 'No se pudo cargar el video para analizarlo' })

    render(<QcProgressDots ideaId="i1" videoId="v1" />)
    const btn = await screen.findByText('Re-analizar')
    await act(async () => { fireEvent.click(btn) })

    expect(mockAnalyze).toHaveBeenCalledWith('v1', expect.anything())
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'No se pudo analizar el video',
      description: 'No se pudo cargar el video para analizarlo',
      variant: 'destructive',
    })))
    // El panel no se rompe: las bolitas siguen visibles.
    expect(screen.getByText(/Del cliente/)).toBeInTheDocument()
  })
})
