import { beforeEach, describe, expect, it, vi } from 'vitest'

const schedulePoolIdea = vi.fn()
const idea = vi.fn()

vi.mock('@/lib/actions/client-pool', () => ({
  schedulePoolIdea: (...args: unknown[]) => schedulePoolIdea(...args),
}))
vi.mock('@/lib/utils/deadlines', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils/deadlines')>()
  return { ...actual, todayISOInTimeZone: () => '2026-10-04' }
})
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => idea(),
        }),
      }),
    }),
  })),
}))

import { publishReciboOnCadence } from './recibo-publish'

beforeEach(() => {
  schedulePoolIdea.mockReset()
  idea.mockReset()
  idea.mockResolvedValue({
    data: {
      id: 'i1',
      client: { posting_days: [1, 5], posting_time: '18:00', posting_schedule: null },
    },
    error: null,
  })
})

describe('publishReciboOnCadence', () => {
  it('programa el espacio con schedulePoolIdea, no publica ya ni inventa otro día', async () => {
    schedulePoolIdea.mockResolvedValue({ ok: true, state: 'agendado', draft: true })
    const res = await publishReciboOnCadence('i1', '2026-10-09')
    expect(schedulePoolIdea).toHaveBeenCalledWith({ ideaId: 'i1', date: '2026-10-09' })
    expect(res).toMatchObject({ ok: true })
    if (res.ok) expect(res.label).toMatch(/viernes 9 de octubre/i)
  })

  it('sin fecha de espacio usa el próximo hueco de cadencia (comportamiento actual)', async () => {
    schedulePoolIdea.mockResolvedValue({ ok: true, state: 'agendado', draft: true })
    const res = await publishReciboOnCadence('i1')
    expect(schedulePoolIdea).toHaveBeenCalledWith({ ideaId: 'i1', date: '2026-10-05' })
    expect(res.ok).toBe(true)
  })

  it('una fecha de espacio ya pasada no llama a Metricool ni inventa otra', async () => {
    const res = await publishReciboOnCadence('i1', '2026-09-28')
    expect(schedulePoolIdea).not.toHaveBeenCalled()
    expect(res).toMatchObject({ error: expect.stringMatching(/ya pasó/i), reason: 'pasado' })
  })

  it('hoy con la hora de cadencia ya pasada no llama a Metricool', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-04T20:00:00-04:00'))
    const res = await publishReciboOnCadence('i1', '2026-10-04')
    expect(schedulePoolIdea).not.toHaveBeenCalled()
    expect(res).toMatchObject({ error: expect.stringMatching(/ya pasó/i), reason: 'pasado' })
  })

  it('sin días de cadencia y sin fecha de espacio no inventa una fecha', async () => {
    idea.mockResolvedValue({
      data: { id: 'i1', client: { posting_days: [], posting_time: '18:00', posting_schedule: null } },
      error: null,
    })
    const res = await publishReciboOnCadence('i1')
    expect(schedulePoolIdea).not.toHaveBeenCalled()
    expect(res.error).toMatch(/días de publicación/i)
  })
})
