/**
 * Al abrir una idea lista, se genera UN borrador. No se pisa un draft ni un
 * caption aprobado, y la misma idea no dispara dos llamadas (Strict Mode).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const generateIdeaCaption = vi.fn(async () => ({ ok: true as const, caption: 'auto copy' }))
vi.mock('@/lib/actions/idea-captions', () => ({
  generateIdeaCaption: (...a: unknown[]) => generateIdeaCaption(...(a as [])),
}))

import { useAutoDraftCaption, resetAutoDraftAttempts } from './use-auto-draft-caption'

beforeEach(() => {
  generateIdeaCaption.mockClear()
  generateIdeaCaption.mockResolvedValue({ ok: true as const, caption: 'auto copy' })
  resetAutoDraftAttempts()
})

const ready = {
  ideaId: 'i1',
  hook: 'tips de gym',
  hasVideo: true,
}

describe('useAutoDraftCaption', () => {
  it('llama generateIdeaCaption una vez cuando la idea está lista y no hay copy', async () => {
    const onDraft = vi.fn()
    renderHook(() => useAutoDraftCaption({ ...ready, onDraft }))
    await waitFor(() => expect(generateIdeaCaption).toHaveBeenCalledTimes(1))
    expect(generateIdeaCaption).toHaveBeenCalledWith('i1', { auto: true })
    await waitFor(() => expect(onDraft).toHaveBeenCalledWith('auto copy'))
  })

  it('no llama si ya hay un borrador', async () => {
    renderHook(() => useAutoDraftCaption({ ...ready, captionDraft: 'ya hay draft' }))
    await Promise.resolve()
    expect(generateIdeaCaption).not.toHaveBeenCalled()
  })

  it('no llama si el caption ya está aprobado', async () => {
    renderHook(() => useAutoDraftCaption({ ...ready, generatedCaption: 'ya aprobado' }))
    await Promise.resolve()
    expect(generateIdeaCaption).not.toHaveBeenCalled()
  })

  it('no llama sin video ni sin tema', async () => {
    renderHook(() => useAutoDraftCaption({ ideaId: 'i1', hook: 'tips', hasVideo: false }))
    renderHook(() => useAutoDraftCaption({ ideaId: 'i2', hook: '', hasVideo: true }))
    await Promise.resolve()
    expect(generateIdeaCaption).not.toHaveBeenCalled()
  })

  it('no llama si está desactivado (sin permiso)', async () => {
    renderHook(() => useAutoDraftCaption({ ...ready, enabled: false }))
    await Promise.resolve()
    expect(generateIdeaCaption).not.toHaveBeenCalled()
  })

  it('no vuelve a llamar si se desmonta y se abre la misma idea', async () => {
    const first = renderHook(() => useAutoDraftCaption(ready))
    await waitFor(() => expect(generateIdeaCaption).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(first.result.current.autoDrafting).toBe(false))
    first.unmount()
    renderHook(() => useAutoDraftCaption(ready))
    await Promise.resolve()
    await Promise.resolve()
    expect(generateIdeaCaption).toHaveBeenCalledTimes(1)
  })

  it('sí llama para otra idea', async () => {
    renderHook(() => useAutoDraftCaption(ready))
    await waitFor(() => expect(generateIdeaCaption).toHaveBeenCalledTimes(1))
    renderHook(() => useAutoDraftCaption({ ...ready, ideaId: 'i2' }))
    await waitFor(() => expect(generateIdeaCaption).toHaveBeenCalledTimes(2))
    expect(generateIdeaCaption).toHaveBeenLastCalledWith('i2', { auto: true })
  })

  it('muestra autoDrafting mientras espera y lo apaga al terminar', async () => {
    let resolveGen: (v: { ok: true; caption: string }) => void = () => {}
    generateIdeaCaption.mockImplementationOnce(
      () => new Promise((resolve) => { resolveGen = resolve }),
    )
    const { result } = renderHook(() => useAutoDraftCaption(ready))
    await waitFor(() => expect(result.current.autoDrafting).toBe(true))
    resolveGen({ ok: true, caption: 'auto copy' })
    await waitFor(() => expect(result.current.autoDrafting).toBe(false))
  })
})
