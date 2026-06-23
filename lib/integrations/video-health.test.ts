import { describe, it, expect } from 'vitest'
import { checkVideoPlayable } from './video-health'

function res(status: number, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, headers })
}

describe('checkVideoPlayable', () => {
  it('ok cuando el Range devuelve 206 + accept-ranges', async () => {
    const fetchImpl = async () => res(206, { 'accept-ranges': 'bytes' })
    expect(await checkVideoPlayable('https://x/v.mp4', fetchImpl as unknown as typeof fetch)).toEqual({
      ok: true,
    })
  })

  it('falla si la URL está vacía (no hace fetch)', async () => {
    let called = false
    const fetchImpl = async () => {
      called = true
      return res(206, { 'accept-ranges': 'bytes' })
    }
    const r = await checkVideoPlayable('', fetchImpl as unknown as typeof fetch)
    expect(r.ok).toBe(false)
    expect(called).toBe(false)
  })

  it('falla si devuelve 200 (Worker sin soporte de Range → preview gira)', async () => {
    const fetchImpl = async () => res(200, { 'accept-ranges': 'bytes' })
    const r = await checkVideoPlayable('https://x/v.mp4', fetchImpl as unknown as typeof fetch)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/206|rango|stream/i)
  })

  it('falla en 404 (el objeto no existe en R2)', async () => {
    const fetchImpl = async () => res(404)
    const r = await checkVideoPlayable('https://x/v.mp4', fetchImpl as unknown as typeof fetch)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/404/)
  })

  it('falla si 206 pero sin accept-ranges', async () => {
    const fetchImpl = async () => res(206)
    const r = await checkVideoPlayable('https://x/v.mp4', fetchImpl as unknown as typeof fetch)
    expect(r.ok).toBe(false)
  })

  it('falla (no lanza) cuando el fetch tira error de red', async () => {
    const fetchImpl = async () => {
      throw new Error('boom')
    }
    const r = await checkVideoPlayable('https://x/v.mp4', fetchImpl as unknown as typeof fetch)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/boom|red|alcanzar/i)
  })
})
