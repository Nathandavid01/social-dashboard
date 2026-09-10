import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * snapshotIdeaBeforeUpdate inserta PREVIOUS values then returns version id.
 * Mock supabase chain: select→eq→single, insert→select→single, auth.getUser.
 */

const prevRow = {
  id: 'idea-1',
  title: 'Antes',
  hook: 'Hook viejo',
  visual_brief: null,
  caption_angle: null,
  hashtags_suggestion: null,
  status: 'idea',
  content_type: 'R',
  shot_type: null,
  reference_url: null,
  rationale: null,
  shooting_notes: null,
}

let insertPayload: Record<string, unknown> | null = null
let readFails = false
let insertFails = false

function makeSupabase() {
  const ideasBuilder: Record<string, unknown> = {}
  ideasBuilder.select = vi.fn(() => ideasBuilder)
  ideasBuilder.eq = vi.fn(() => ideasBuilder)
  ideasBuilder.single = vi.fn(async () =>
    readFails
      ? { data: null, error: { message: 'not found' } }
      : { data: prevRow, error: null },
  )

  const versionsBuilder: Record<string, unknown> = {}
  versionsBuilder.insert = vi.fn((payload: Record<string, unknown>) => {
    insertPayload = payload
    return versionsBuilder
  })
  versionsBuilder.select = vi.fn(() => versionsBuilder)
  versionsBuilder.single = vi.fn(async () =>
    insertFails
      ? { data: null, error: { message: 'insert fail' } }
      : { data: { id: 'ver-99' }, error: null },
  )

  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u-1' } }, error: null })) },
    from: vi.fn((table: string) => (table === 'content_idea_versions' ? versionsBuilder : ideasBuilder)),
  }
}

vi.mock('server-only', () => ({}))

import { snapshotIdeaBeforeUpdate } from './idea-versions'

beforeEach(() => {
  insertPayload = null
  readFails = false
  insertFails = false
})

describe('snapshotIdeaBeforeUpdate', () => {
  it('inserta snapshot con valores previos y reason', async () => {
    const sb = makeSupabase()
    const id = await snapshotIdeaBeforeUpdate(sb as never, 'idea-1', 'brief_updated')
    expect(id).toBe('ver-99')
    expect(insertPayload).toMatchObject({
      content_idea_id: 'idea-1',
      reason: 'brief_updated',
      created_by: 'u-1',
      snapshot: expect.objectContaining({ title: 'Antes', hook: 'Hook viejo', status: 'idea' }),
    })
  })

  it('devuelve null si no puede leer la fila previa', async () => {
    readFails = true
    const id = await snapshotIdeaBeforeUpdate(makeSupabase() as never, 'missing', 'title_updated')
    expect(id).toBeNull()
    expect(insertPayload).toBeNull()
  })

  it('devuelve null si el insert falla (best-effort)', async () => {
    insertFails = true
    const id = await snapshotIdeaBeforeUpdate(makeSupabase() as never, 'idea-1', 'discarded')
    expect(id).toBeNull()
  })
})
