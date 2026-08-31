import { beforeEach, describe, expect, it, vi } from 'vitest'

const getEffectiveRole = vi.fn(async (): Promise<'editor' | 'owner'> => 'editor')
const createClient = vi.fn(async () => { throw new Error('DB should not be reached') })
const getClientVideoBatch = vi.fn(async (_clientId: string) => { throw new Error('pipeline should not be reached') })

vi.mock('@/lib/auth/server', () => ({
  getEffectiveRole: () => getEffectiveRole(),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => createClient(),
}))
vi.mock('@/lib/actions/video-pipeline', () => ({
  getClientVideoBatch: (clientId: string) => getClientVideoBatch(clientId),
}))
vi.mock('@/lib/utils/posting-cadence', () => ({ computePostingTargets: vi.fn() }))
vi.mock('@/lib/utils/planned-sessions', () => ({ planSessions: vi.fn(), planSlots: vi.fn() }))
vi.mock('@/lib/utils/recording-window', () => ({ resolveInterval: vi.fn() }))

import { getClientBatchData } from './client-batch'
import { getBatchVideoPreviewUrls } from './batch-video-previews'

beforeEach(() => {
  vi.clearAllMocks()
  getEffectiveRole.mockResolvedValue('editor')
})

describe('acciones administrativas de Pipeline', () => {
  it('un editor no puede abrir el lote de un cliente por ID directo', async () => {
    await expect(getClientBatchData('cliente-ajeno')).resolves.toBeNull()
    expect(createClient).not.toHaveBeenCalled()
    expect(getClientVideoBatch).not.toHaveBeenCalled()
  })

  it('un editor no puede pedir URLs de videos arbitrarios', async () => {
    await expect(getBatchVideoPreviewUrls(['video-ajeno'])).resolves.toEqual({ error: 'No autorizado' })
    expect(createClient).not.toHaveBeenCalled()
  })
})
