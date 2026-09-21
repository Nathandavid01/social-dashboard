import { describe, it, expect, vi, beforeEach } from 'vitest'

const currentUserHas = vi.fn<(perm: string) => Promise<boolean>>(async () => false)
vi.mock('@/lib/auth/server', () => ({
  currentUserHas: (perm: string) => currentUserHas(perm),
}))

const getUser = vi.fn(async () => ({ data: { user: { id: '11111111-1111-4111-8111-111111111111' } } }))
const videoLimit = vi.fn<() => Promise<{ data: unknown; error: { message: string } | null }>>(
  async () => ({ data: [], error: null }),
)
const ideaLimit = vi.fn<() => Promise<{ data: unknown; error: { message: string } | null }>>(
  async () => ({ data: [], error: null }),
)

function chain(limit: () => Promise<{ data: unknown; error: { message: string } | null }>) {
  const builder: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'neq', 'or', 'not', 'order']) {
    builder[method] = () => builder
  }
  builder.limit = limit
  return builder
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser },
    from: (table: string) => chain(table === 'content_idea_videos' ? videoLimit : ideaLimit),
  }),
}))

import { getVideographerHistory } from './videographer-history'

const ME = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'

beforeEach(() => {
  currentUserHas.mockReset().mockResolvedValue(false)
  getUser.mockReset().mockResolvedValue({ data: { user: { id: ME } } })
  videoLimit.mockReset().mockResolvedValue({ data: [], error: null })
  ideaLimit.mockReset().mockResolvedValue({ data: [], error: null })
})

describe('getVideographerHistory', () => {
  it('refuses another person when the caller cannot read the team', async () => {
    const res = await getVideographerHistory(OTHER)
    expect(res.error).toBe('No autorizado')
    expect(res.sessions).toEqual([])
    expect(videoLimit).not.toHaveBeenCalled()
  })

  it('groups the caller\'s raw under the idea and marks the extra idea from the shoot', async () => {
    videoLimit.mockResolvedValue({
      data: [{
        id: 'v1',
        name: 'primera.mp4',
        kind: 'raw',
        status: 'uploaded',
        uploaded_by: ME,
        uploaded_at: '2026-09-12T15:00:00.000Z',
        idea_id: '33333333-3333-4333-8333-333333333333',
      }],
      error: null,
    })
    ideaLimit.mockResolvedValue({
      data: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          title: 'Hook del mes',
          created_by: 'sup',
          created_at: '2026-09-01T12:00:00.000Z',
          recording_session_id: '44444444-4444-4444-8444-444444444444',
          client: { name: 'Nana' },
          recording_session: { title: 'Parque', session_date: '2026-09-12' },
        },
        {
          id: '55555555-5555-4555-8555-555555555555',
          title: 'DJI_0991',
          created_by: ME,
          created_at: '2026-09-12T18:00:00.000Z',
          recording_session_id: '44444444-4444-4444-8444-444444444444',
          client: [{ name: 'Nana' }],
          recording_session: [{ title: 'Parque', session_date: '2026-09-12' }],
        },
      ],
      error: null,
    })

    const res = await getVideographerHistory(ME)
    expect(res.error).toBeUndefined()
    expect(res.sessions[0].clientName).toBe('Nana')
    expect(res.sessions[0].ideas.map((idea) => idea.title)).toEqual(['Hook del mes', 'DJI_0991'])
    expect(res.sessions[0].ideas[1].additional).toBe(true)
    expect(res.sessions[0].ideas[0].videos[0].name).toBe('primera.mp4')
  })

  it('rejects a person id that is not a uuid', async () => {
    const res = await getVideographerHistory('no')
    expect(res.error).toBe('Persona no válida')
    expect(getUser).not.toHaveBeenCalled()
  })
})
