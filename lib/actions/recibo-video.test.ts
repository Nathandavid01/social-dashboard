import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ permission: vi.fn(), single: vi.fn(), from: vi.fn(), steps: [] as [string, unknown[]][] }))
vi.mock('@/lib/auth/server', () => ({ requirePermission: mocks.permission }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from: mocks.from }) }))
import { getReciboEditedVideo } from './recibo-video'
describe('current Recibo cut query', () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.steps.length = 0; mocks.permission.mockResolvedValue(undefined)
    const chain: Record<string, unknown> = { maybeSingle: mocks.single }
    for (const name of ['select', 'eq', 'in', 'not', 'neq', 'order', 'limit']) {
      chain[name] = (...args: unknown[]) => { mocks.steps.push([name, args]); return chain }
    }
    mocks.from.mockReturnValue(chain)
  })
  it('keeps both storage providers and excludes raw, missing, failed and archived files', async () => {
    mocks.single.mockResolvedValue({ data: { id: 'new', storage_provider: 'r2' }, error: null })
    expect(await getReciboEditedVideo('idea')).toEqual({ id: 'new', storage_provider: 'r2' })
    expect(mocks.permission).toHaveBeenCalledWith('entregas.read')
    expect(mocks.steps).toEqual(expect.arrayContaining([
      ['eq', ['idea_id', 'idea']], ['eq', ['kind', 'edited']],
      ['in', ['storage_provider', ['r2', 'entregas-r2']]],
      ['not', ['status', 'in', '(archived,failed)']],
      ['not', ['drive_file_id', 'is', null]], ['neq', ['drive_file_id', '']],
      ['order', ['uploaded_at', { ascending: false }]], ['limit', [1]],
    ]))
  })
  it('does not read media when permission is denied', async () => {
    mocks.permission.mockRejectedValue(new Error('No autorizado'))
    expect(await getReciboEditedVideo('idea')).toEqual({ error: 'No autorizado' })
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('surfaces database errors instead of reporting an empty card', async () => {
    mocks.single.mockResolvedValue({ data: null, error: { message: 'unavailable' } })
    expect(await getReciboEditedVideo('idea')).toEqual({ error: 'unavailable' })
  })
})
