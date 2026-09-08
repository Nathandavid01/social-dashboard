import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/server', () => ({ requirePermission: vi.fn(async () => undefined) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
let status: string
let concurrentStatus: string | undefined
let payload: Record<string, unknown> | undefined
let filters: Record<string, unknown>
let updating = false
const builder = {
  select: vi.fn(() => builder),
  eq: vi.fn((key: string, value: unknown) => { filters[key] = value; return builder }),
  single: vi.fn(async () => ({ data: { status }, error: null })),
  update: vi.fn((value: Record<string, unknown>) => { payload = value; updating = true; return builder }),
  maybeSingle: vi.fn(async () => {
    if (concurrentStatus) status = concurrentStatus
    if (filters.status !== status) return { data: null, error: null }
    status = String(payload?.status)
    return { data: { id: 'idea-1' }, error: null }
  }),
  then: (resolve: (value: unknown) => unknown) => {
    if (updating) status = String(payload?.status)
    return resolve({ data: null, error: null })
  },
}
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from: () => builder }) }))
import { toggleShotRecorded } from './onsite'

beforeEach(() => { status = 'idea'; concurrentStatus = undefined; payload = undefined; filters = {}; updating = false })
afterEach(() => vi.useRealTimers())

describe('On Site recording transition guard', () => {
  it.each(['producida', 'publicada', 'descartada'])('cannot mark a %s idea as newly recorded from a stale screen', async current => {
    status = current
    expect((await toggleShotRecorded({ ideaId: 'idea-1', recorded: true })).error).toBeTruthy()
    expect(payload).toBeUndefined()
    expect(status).toBe(current)
  })
  it('does not rewrite the recording date when retried', async () => {
    status = 'grabada'
    expect(await toggleShotRecorded({ ideaId: 'idea-1', recorded: true })).toEqual({ ok: true })
    expect(payload).toBeUndefined()
  })
  it('records a pending idea on the Puerto Rico calendar day', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-09T02:00:00Z'))
    expect(await toggleShotRecorded({ ideaId: 'idea-1', recorded: true })).toEqual({ ok: true })
    expect(payload).toEqual({ status: 'grabada', recording_date: '2026-09-08' })
    expect(status).toBe('grabada')
  })
  it('does not overwrite another transition that happened after loading', async () => {
    status = 'grabada'; concurrentStatus = 'producida'
    expect((await toggleShotRecorded({ ideaId: 'idea-1', recorded: false })).error).toBeTruthy()
    expect(status).toBe('producida')
  })
  it('can undo a recorded idea that has not advanced', async () => {
    status = 'grabada'
    expect(await toggleShotRecorded({ ideaId: 'idea-1', recorded: false })).toEqual({ ok: true })
    expect(payload).toEqual({ status: 'idea', recording_date: null })
    expect(status).toBe('idea')
  })
})
