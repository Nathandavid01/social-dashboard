import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVideoAnalysisPolling } from './use-video-analysis-polling'
import * as actions from '@/lib/actions/video-analysis'

/**
 * `/api/video-analysis` hace upsert 'done' y LUEGO llama a
 * generateIdeaCaption (que tarda segundos) — hay una ventana real donde el
 * cliente ve 'done' con hasCaption:false. El predicado `keepPolling`
 * mantiene el sondeo vivo para ese caso sin tocar el comportamiento de
 * quien no lo pasa (review-overlay via VideoAnalysisReport).
 */

vi.mock('@/lib/actions/video-analysis', () => ({ getVideoAnalysis: vi.fn() }))
const mockGet = vi.mocked(actions.getVideoAnalysis)

const doneFindings = {
  burned_captions: { text: 'ok', issues: [] },
  relevance: { verdict: 'ok' as const, explanation: '' },
  visual_summary: '',
}

describe('useVideoAnalysisPolling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('sin predicado: done detiene el sondeo (comportamiento actual, review-overlay)', async () => {
    mockGet.mockResolvedValue({ analysis: { status: 'done', findings: doneFindings, hasCaption: false } })
    renderHook(() => useVideoAnalysisPolling('idea-1'))
    await act(async () => {})
    expect(mockGet).toHaveBeenCalledTimes(1)

    await act(() => vi.advanceTimersByTimeAsync(30_000))
    expect(mockGet).toHaveBeenCalledTimes(1)
  })

  it('con predicado: done + hasCaption:false sigue sondeando; al llegar hasCaption:true, la última lectura lo refleja y para', async () => {
    mockGet
      .mockResolvedValueOnce({ analysis: { status: 'done', findings: doneFindings, hasCaption: false } })
      .mockResolvedValueOnce({ analysis: { status: 'done', findings: doneFindings, hasCaption: false } })
      .mockResolvedValue({ analysis: { status: 'done', findings: doneFindings, hasCaption: true } })

    const { result } = renderHook(() =>
      useVideoAnalysisPolling('idea-1', (a) => !a.hasCaption),
    )
    await act(async () => {})
    expect(mockGet).toHaveBeenCalledTimes(1)
    expect(result.current?.hasCaption).toBe(false)

    await act(() => vi.advanceTimersByTimeAsync(10_000))
    expect(mockGet).toHaveBeenCalledTimes(2)
    expect(result.current?.hasCaption).toBe(false)

    await act(() => vi.advanceTimersByTimeAsync(10_000))
    expect(mockGet).toHaveBeenCalledTimes(3)
    expect(result.current?.hasCaption).toBe(true)

    // Ya con hasCaption:true, el predicado deja de pedir más sondeo.
    await act(() => vi.advanceTimersByTimeAsync(30_000))
    expect(mockGet).toHaveBeenCalledTimes(3)
  })

  it('con predicado que nunca se satisface: el tope de ~5min también aplica (no sondea infinito)', async () => {
    mockGet.mockResolvedValue({ analysis: { status: 'done', findings: doneFindings, hasCaption: false } })
    renderHook(() => useVideoAnalysisPolling('idea-1', (a) => !a.hasCaption))
    await act(async () => {})

    await act(() => vi.advanceTimersByTimeAsync(5 * 60_000))
    const callsAtCap = mockGet.mock.calls.length
    expect(callsAtCap).toBeGreaterThan(1)

    await act(() => vi.advanceTimersByTimeAsync(60_000))
    expect(mockGet).toHaveBeenCalledTimes(callsAtCap)
  })

  it('sigue sondeando también mientras status es pending, con o sin predicado (regresión del comportamiento previo)', async () => {
    mockGet
      .mockResolvedValueOnce({ analysis: { status: 'pending', findings: null, hasCaption: false } })
      .mockResolvedValue({ analysis: { status: 'done', findings: doneFindings, hasCaption: true } })

    renderHook(() => useVideoAnalysisPolling('idea-1', (a) => !a.hasCaption))
    await act(async () => {})
    expect(mockGet).toHaveBeenCalledTimes(1)

    await act(() => vi.advanceTimersByTimeAsync(10_000))
    expect(mockGet).toHaveBeenCalledTimes(2)
  })
})
