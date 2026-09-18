import { beforeEach, describe, expect, it, vi } from 'vitest'

const requirePermission = vi.fn(async (_perm: string) => undefined)
const getEffectiveRole = vi.fn(async (): Promise<'owner' | 'supervisor' | 'editor' | 'video' | 'copy' | 'disenador' | 'team_member'> => 'video')
const revalidatePathMock = vi.fn()
const getSignedUrl = vi.fn(async (..._args: unknown[]) => 'https://signed.example/put')
const r2Send = vi.fn(async () => ({}))
const isR2Configured = vi.fn(() => true)

type Op = { table: string; method: string; payload?: unknown }
const ops: Op[] = []
let inserted: Record<string, unknown> | null = { id: 'asset-1', client_id: 'c1', kind: 'photo' }
let listed: Record<string, unknown>[] = []
let fetched: Record<string, unknown> | null = null
let userId: string | null = 'user-1'

vi.mock('@/lib/auth/server', () => ({
  requirePermission: (perm: string) => requirePermission(perm),
  getEffectiveRole: () => getEffectiveRole(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => revalidatePathMock(path),
}))

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]) => getSignedUrl(...args),
}))

vi.mock('@/lib/integrations/r2', () => ({
  r2Client: () => ({ send: r2Send }),
  r2Bucket: () => 'nmedia-videos',
  isR2Configured: () => isR2Configured(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
    from(table: string) {
      const chain: Record<string, unknown> = {}
      const self = () => chain
      chain.select = self
      chain.eq = self
      chain.in = self
      chain.order = async () => ({ data: listed, error: null })
      chain.maybeSingle = async () => ({ data: fetched, error: null })
      chain.single = async () => ({ data: fetched ?? inserted, error: null })
      chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve({ data: fetched ?? inserted, error: null }).then(resolve, reject)
      chain.insert = (payload: unknown) => {
        ops.push({ table, method: 'insert', payload })
        return chain
      }
      chain.delete = () => {
        ops.push({ table, method: 'delete' })
        return chain
      }
      chain.update = (payload: unknown) => {
        ops.push({ table, method: 'update', payload })
        return chain
      }
      return chain
    },
    storage: {
      from: () => ({
        remove: vi.fn(async () => ({ error: null })),
      }),
    },
  }),
}))

import {
  deleteClientBankAsset,
  getClientAssetDownloadUrl,
  getClientAssetUploadUrl,
  listClientBankAssets,
  listClientBankAssetsByClientIds,
  registerClientBankAsset,
} from './client-asset-bank'

beforeEach(() => {
  requirePermission.mockReset().mockResolvedValue(undefined)
  getEffectiveRole.mockReset().mockResolvedValue('video')
  revalidatePathMock.mockReset()
  getSignedUrl.mockReset().mockResolvedValue('https://signed.example/put')
  r2Send.mockReset()
  isR2Configured.mockReset().mockReturnValue(true)
  ops.length = 0
  inserted = { id: 'asset-1', client_id: 'c1', kind: 'photo' }
  listed = []
  fetched = null
  userId = 'user-1'
})

describe('getClientAssetUploadUrl', () => {
  it('exige clients.assets.upload y nunca usa el prefijo ideas/', async () => {
    requirePermission.mockRejectedValueOnce(new Error('No autorizado'))
    const denied = await getClientAssetUploadUrl({
      clientId: 'c1',
      kind: 'broll',
      fileName: 'Patio.mp4',
      contentType: 'video/mp4',
    })
    expect(denied.error).toMatch(/autorizado/i)

    const res = await getClientAssetUploadUrl({
      clientId: 'c1',
      kind: 'broll',
      fileName: 'Patio.mp4',
      contentType: 'video/mp4',
    })
    expect(requirePermission).toHaveBeenCalledWith('clients.assets.upload')
    expect(res.url).toBe('https://signed.example/put')
    expect(res.key).toMatch(/^client-assets\/c1\/broll\//)
    expect(res.key).not.toMatch(/^ideas\//)
  })

  it('rechaza un crudo disfrazado de logo', async () => {
    const res = await getClientAssetUploadUrl({
      clientId: 'c1',
      kind: 'logo',
      fileName: 'marca.png',
      contentType: 'video/mp4',
    })
    expect(res.error).toMatch(/imágenes/i)
    expect(res.key).toBeUndefined()
  })
})

describe('registerClientBankAsset', () => {
  it('escribe solo client_assets y rechaza claves del pipeline', async () => {
    const blocked = await registerClientBankAsset({
      clientId: 'c1',
      kind: 'broll',
      name: 'crudo.mp4',
      key: 'ideas/idea-9/raw/crudo.mp4',
      sizeBytes: 10,
      mimeType: 'video/mp4',
    })
    expect(blocked.error).toMatch(/no pertenece al banco/i)
    expect(ops).toEqual([])

    const res = await registerClientBankAsset({
      clientId: 'c1',
      kind: 'photo',
      name: 'Sala.jpg',
      key: 'client-assets/c1/photo/1-sala.jpg',
      sizeBytes: 20,
      mimeType: 'image/jpeg',
    })
    expect(res.ok).toBe(true)
    expect(ops.some((op) => op.table === 'content_idea_videos')).toBe(false)
    expect(ops.filter((op) => op.table === 'client_assets' && op.method === 'insert')).toHaveLength(1)
    const payload = ops.find((op) => op.method === 'insert')?.payload as Record<string, unknown>
    expect(payload.storage_path).toBe('r2:client-assets/c1/photo/1-sala.jpg')
    expect(payload.kind).toBe('photo')
    expect(revalidatePathMock).toHaveBeenCalledWith('/onsite')
    expect(revalidatePathMock).toHaveBeenCalledWith('/pipeline')
  })
})

describe('listClientBankAssets', () => {
  it('el editor puede leer el banco; no inventa filas', async () => {
    getEffectiveRole.mockResolvedValue('editor')
    listed = [
      { id: 'a', client_id: 'c1', kind: 'logo', name: 'Logo.png', url: 'https://x/logo.png', storage_path: 'client-assets/c1/x', size_bytes: 1, mime_type: 'image/png' },
      { id: 'b', client_id: 'c1', kind: 'contract', name: 'Contrato.pdf', url: 'x', storage_path: 'x', size_bytes: 1, mime_type: 'application/pdf' },
    ]
    const res = await listClientBankAssets('c1')
    expect(res.error).toBeUndefined()
    expect(res.assets?.map((a) => a.id)).toEqual(['a'])
  })

  it('niega a quien no graba ni edita', async () => {
    getEffectiveRole.mockResolvedValue('copy')
    const res = await listClientBankAssets('c1')
    expect(res.error).toMatch(/autorizado/i)
  })
})

describe('listClientBankAssetsByClientIds', () => {
  it('agrupa por cliente para el editor', async () => {
    getEffectiveRole.mockResolvedValue('editor')
    listed = [
      { id: 'a', client_id: 'c1', kind: 'photo', name: 'A.jpg', url: 'https://x/a.jpg', storage_path: 'x', size_bytes: 1, mime_type: 'image/jpeg' },
      { id: 'b', client_id: 'c2', kind: 'broll', name: 'B.mp4', url: 'r2:client-assets/c2/broll/1.mp4', storage_path: 'r2:client-assets/c2/broll/1.mp4', size_bytes: 2, mime_type: 'video/mp4' },
    ]
    const res = await listClientBankAssetsByClientIds(['c1', 'c2'])
    expect(res.byClient?.c1).toHaveLength(1)
    expect(res.byClient?.c2[0]?.kind).toBe('broll')
  })
})

describe('getClientAssetDownloadUrl', () => {
  it('firma R2 del banco y no pide un video de idea', async () => {
    getEffectiveRole.mockResolvedValue('editor')
    fetched = {
      id: 'asset-1',
      client_id: 'c1',
      kind: 'broll',
      name: 'Patio.mp4',
      url: 'r2:client-assets/c1/broll/1-patio.mp4',
      storage_path: 'r2:client-assets/c1/broll/1-patio.mp4',
    }
    getSignedUrl.mockResolvedValueOnce('https://signed.example/get')
    const res = await getClientAssetDownloadUrl('asset-1')
    expect(res.url).toBe('https://signed.example/get')
    expect(ops.some((op) => op.table === 'content_idea_videos')).toBe(false)
  })
})

describe('deleteClientBankAsset', () => {
  it('borra la fila del banco, nunca content_idea_videos ni ideas/', async () => {
    fetched = {
      id: 'asset-1',
      client_id: 'c1',
      kind: 'photo',
      storage_path: 'r2:client-assets/c1/photo/1-sala.jpg',
    }
    const res = await deleteClientBankAsset('asset-1', 'c1')
    expect(res.ok).toBe(true)
    expect(ops.filter((op) => op.table === 'client_assets' && op.method === 'delete')).toHaveLength(1)
    expect(ops.some((op) => op.table === 'content_idea_videos')).toBe(false)
    expect(r2Send).toHaveBeenCalled()
  })

  it('no borra un objeto R2 fuera de client-assets/', async () => {
    fetched = {
      id: 'asset-1',
      client_id: 'c1',
      kind: 'photo',
      storage_path: 'r2:ideas/idea-1/raw/clip.mp4',
    }
    const res = await deleteClientBankAsset('asset-1', 'c1')
    expect(res.error).toMatch(/no pertenece al banco/i)
    expect(ops.some((op) => op.method === 'delete')).toBe(false)
    expect(r2Send).not.toHaveBeenCalled()
  })
})
