import { describe, it, expect, vi, beforeEach } from 'vitest'

const requirePermission = vi.fn(async () => {})
vi.mock('@/lib/auth/server', () => ({ requirePermission: () => requirePermission() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
let inserted: Record<string, unknown> | null = null
const supa = {
  auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } } })) },
  from: vi.fn(() => ({
    insert: (row: Record<string, unknown>) => { inserted = row; return { select: () => ({ single: async () => ({ data: { id: 'a1', ...row }, error: null }) }) } },
  })),
}
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => supa }))

import { addClientAssetLink } from './client-asset-links'

beforeEach(() => { inserted = null; requirePermission.mockReset().mockResolvedValue(undefined) })

describe('addClientAssetLink — enlace externo (carpeta de B-rolls, Drive de logos…)', () => {
  it('guarda un activo sin archivo con la URL y el nombre', async () => {
    const res = await addClientAssetLink('c1', { name: 'B-rolls (Drive)', url: 'https://drive.google.com/drive/folders/abc', kind: 'other' })
    expect(res.ok).toBe(true)
    expect(inserted).toEqual(expect.objectContaining({ client_id: 'c1', kind: 'other', name: 'B-rolls (Drive)', url: 'https://drive.google.com/drive/folders/abc', storage_path: null, uploaded_by: 'u1' }))
  })
  it('solo http(s) y nombre obligatorio', async () => {
    expect((await addClientAssetLink('c1', { name: '', url: 'https://x.com', kind: 'other' })).error).toMatch(/nombre/i)
    expect((await addClientAssetLink('c1', { name: 'x', url: 'javascript:alert(1)', kind: 'other' })).error).toMatch(/enlace/i)
    expect((await addClientAssetLink('c1', { name: 'x', url: 'ftp://x', kind: 'other' })).error).toMatch(/enlace/i)
    expect(inserted).toBeNull()
  })
  it('exige clients.edit', async () => {
    requirePermission.mockRejectedValueOnce(new Error('No autorizado'))
    expect((await addClientAssetLink('c1', { name: 'x', url: 'https://x.com', kind: 'other' })).error).toMatch(/autorizado/i)
  })
})
