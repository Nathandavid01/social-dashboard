import { describe, it, expect, vi, beforeEach } from 'vitest'

const requirePermission = vi.fn(async (_p: string) => {})
vi.mock('@/lib/auth/server', () => ({
  requirePermission: (p: string) => requirePermission(p),
  currentUserHas: vi.fn(async () => true),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

let inserts: Record<string, any[]>
let updates: Record<string, any[]>
let ideaRow: { id: string }

function makeSupabase() {
  inserts = {}
  updates = {}
  const tableApi = (table: string) => ({
    insert: (payload: any) => {
      const rows = Array.isArray(payload) ? payload : [payload]
      inserts[table] = (inserts[table] ?? []).concat(rows)
      return {
        select: () => ({ single: async () => ({ data: ideaRow, error: null }) }),
        then: (resolve: (v: unknown) => unknown) => resolve({ error: null }),
      }
    },
    update: (payload: any) => {
      updates[table] = (updates[table] ?? []).concat([payload])
      return { eq: async () => ({ error: null }), in: async () => ({ error: null }) }
    },
    select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
  })
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })) },
    from: vi.fn((t: string) => tableApi(t)),
  }
}

let supa = makeSupabase()
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => supa }))

import { createRecordedVideo } from './recorded-video'

const base = {
  clientId: 'client-1',
  title: 'Promo Black Friday',
  entryStage: 'video' as const,
}

beforeEach(() => {
  ideaRow = { id: 'idea-1' }
  requirePermission.mockReset().mockResolvedValue(undefined)
  supa = makeSupabase()
})

describe('createRecordedVideo — validation', () => {
  it('rejects an empty title and writes nothing', async () => {
    const res = await createRecordedVideo({ ...base, title: '   ' })
    expect(res.error).toBeTruthy()
    expect(inserts.content_ideas).toBeUndefined()
  })

  it('rejects a missing client', async () => {
    const res = await createRecordedVideo({ ...base, clientId: '' })
    expect(res.error).toBeTruthy()
    expect(inserts.content_ideas).toBeUndefined()
  })

  it('rejects an invalid entry stage (idea/caption are not allowed)', async () => {
    const res = await createRecordedVideo({ ...base, entryStage: 'idea' as any })
    expect(res.error).toBeTruthy()
    expect(inserts.content_ideas).toBeUndefined()
  })

  it('rejects more than 5 raw videos', async () => {
    const rawLinks = Array.from({ length: 6 }, (_, i) => `https://drive.google.com/raw${i}`)
    const res = await createRecordedVideo({ ...base, rawLinks })
    expect(res.error).toMatch(/5/)
    expect(inserts.content_ideas).toBeUndefined()
  })

  it('returns an error and writes nothing when the user lacks permission', async () => {
    requirePermission.mockRejectedValueOnce(new Error('No tienes permiso'))
    const res = await createRecordedVideo(base)
    expect(res.error).toBeTruthy()
    expect(inserts.content_ideas).toBeUndefined()
  })
})

describe('createRecordedVideo — idea creation', () => {
  it('creates the idea at the chosen column (video → grabada) and returns its id', async () => {
    const res = await createRecordedVideo({ ...base, entryStage: 'video' })
    expect(res.ideaId).toBe('idea-1')
    expect(inserts.content_ideas[0]).toMatchObject({
      client_id: 'client-1',
      title: 'Promo Black Friday',
      status: 'grabada',
      created_by: 'user-1',
    })
  })

  it('approval entry sets approval_status submitted', async () => {
    await createRecordedVideo({ ...base, entryStage: 'approval' })
    expect(inserts.content_ideas[0]).toMatchObject({
      status: 'producida',
      approval_status: 'submitted',
    })
  })

  it('saves the caption when provided', async () => {
    await createRecordedVideo({ ...base, caption: '🔥 Black Friday' })
    expect(inserts.content_ideas[0]).toMatchObject({ generated_caption: '🔥 Black Friday' })
  })
})

describe('createRecordedVideo — video attachments', () => {
  it('inserts one raw row per link plus the edited row, all linked to the idea', async () => {
    await createRecordedVideo({
      ...base,
      rawLinks: [
        'https://drive.google.com/raw1',
        'https://drive.google.com/raw2',
        'https://drive.google.com/raw3',
      ],
      editedLink: 'https://drive.google.com/edited',
    })
    const vids = inserts.content_idea_videos ?? []
    expect(vids).toHaveLength(4)
    const raws = vids.filter((v) => v.kind === 'raw')
    const edited = vids.filter((v) => v.kind === 'edited')
    expect(raws).toHaveLength(3)
    expect(edited).toHaveLength(1)
    expect(raws[0]).toMatchObject({
      idea_id: 'idea-1',
      kind: 'raw',
      drive_view_link: 'https://drive.google.com/raw1',
      status: 'uploaded',
      uploaded_by: 'user-1',
    })
    expect(edited[0]).toMatchObject({ drive_view_link: 'https://drive.google.com/edited', kind: 'edited' })
    expect(raws.every((r) => typeof r.name === 'string' && r.name.length > 0)).toBe(true)
  })

  it('ignores blank/whitespace links', async () => {
    await createRecordedVideo({
      ...base,
      rawLinks: ['https://drive.google.com/raw1', '   ', ''],
      editedLink: '   ',
    })
    const vids = inserts.content_idea_videos ?? []
    expect(vids).toHaveLength(1)
    expect(vids[0]).toMatchObject({ kind: 'raw', drive_view_link: 'https://drive.google.com/raw1' })
  })

  it('creates no video rows when no links are given', async () => {
    await createRecordedVideo(base)
    expect(inserts.content_idea_videos).toBeUndefined()
  })
})

describe('createRecordedVideo — assignee', () => {
  it('links a production task to the assignee without changing the entry status', async () => {
    await createRecordedVideo({ ...base, entryStage: 'video', assigneeId: 'person-1' })
    // a production task is created for the assignee, tied to the idea
    expect(inserts.production_tasks).toHaveLength(1)
    expect(inserts.production_tasks[0]).toMatchObject({ assigned_to_id: 'person-1', idea_id: 'idea-1' })
    // the idea points at the task...
    expect(updates.content_ideas?.[0]).toMatchObject({ production_task_id: 'idea-1' })
    // ...but its column status is NOT overwritten to "asignada"
    expect(JSON.stringify(updates.content_ideas?.[0])).not.toContain('asignada')
  })

  it('creates no production task when no assignee is given', async () => {
    await createRecordedVideo(base)
    expect(inserts.production_tasks).toBeUndefined()
  })
})
