import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { avatarStoragePath } from './avatar-core'

export const AVATARS_BUCKET = 'avatars'

/**
 * Sube la foto al bucket público `avatars` en la ruta estable del usuario y
 * devuelve la URL con cache-bust. La usan la foto propia (`uploadAvatar`) y la
 * que un owner pone a otra persona (`setUserAvatar`): una sola forma de guardar.
 */
export async function storeAvatar(
  supabase: Pick<SupabaseClient, 'storage'>,
  userId: string,
  file: File,
): Promise<{ url: string } | { error: string }> {
  const path = avatarStoragePath(userId, file.name)
  const { error } = await supabase.storage.from(AVATARS_BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: true,
  })
  if (error) return { error: error.message }
  const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path)
  return { url: `${data.publicUrl}?v=${Date.now()}` }
}
