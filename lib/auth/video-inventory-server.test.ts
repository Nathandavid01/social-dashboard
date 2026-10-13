import { beforeEach, expect, it, vi } from 'vitest'
const h = vi.hoisted(() => ({ id: 'another-owner' as string | null, realId: 'another-owner' as string | null, permission: vi.fn() }))
vi.mock('@/lib/auth/server', () => ({ requirePermission: h.permission, getEffectiveUserId: async () => h.id }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: h.realId ? { id: h.realId } : null } }) } }) }))
import { requireVideoInventoryAccess } from './video-inventory-server'
beforeEach(() => { h.permission.mockReset(); h.permission.mockResolvedValue(undefined); h.id = 'another-owner'; h.realId = 'another-owner' })
it('denies other owners at the server data boundary', async () => { await expect(requireVideoInventoryAccess()).rejects.toThrow('Acceso denegado') })
it('allows Nathan only with a valid effective permission and identity', async () => {
  h.id = '165e5259-8f69-4ff4-b0f0-f790cba77b80'
  h.realId = h.id
  await expect(requireVideoInventoryAccess()).resolves.toBeUndefined()
  h.permission.mockRejectedValue(new Error('Denied'))
  await expect(requireVideoInventoryAccess()).rejects.toThrow('Denied')
})
it('denies a different owner impersonating Nathan through view-as', async () => {
  h.id = '165e5259-8f69-4ff4-b0f0-f790cba77b80'
  await expect(requireVideoInventoryAccess()).rejects.toThrow('Acceso denegado')
})
