import 'server-only'
import { getEffectiveUserId, requirePermission } from './server'
import { canAccessVideoInventory } from './video-inventory-access'
import { createClient } from '@/lib/supabase/server'

export async function requireVideoInventoryAccess(): Promise<void> {
  await requirePermission('inventory.read')
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!canAccessVideoInventory(user?.id) || !canAccessVideoInventory(await getEffectiveUserId())) {
    throw new Error('Acceso denegado al inventario de videos.')
  }
}
