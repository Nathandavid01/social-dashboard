'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const AVATARS_BUCKET = 'avatars'

export async function uploadAvatar(formData: FormData): Promise<{ ok?: true; url?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'Archivo requerido' }
  if (!file.type.startsWith('image/')) return { error: 'Solo se permiten imágenes' }
  if (file.size > 4 * 1024 * 1024) return { error: 'Imagen mayor a 4 MB' }

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  // Stable path per user so re-uploads overwrite; cache-bust via ?v=timestamp.
  const path = `${user.id}/avatar.${ext}`

  const { error: upErr } = await supabase.storage.from(AVATARS_BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: true,
  })
  if (upErr) return { error: upErr.message }

  const { data: pub } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path)
  const url = `${pub.publicUrl}?v=${Date.now()}`

  const { error: updErr } = await supabase
    .from('profiles')
    .update({ avatar_url: url, updated_at: new Date().toISOString() })
    .eq('id', user.id)
  if (updErr) return { error: updErr.message }

  revalidatePath('/', 'layout')
  return { ok: true, url }
}

export async function removeAvatar(): Promise<{ ok?: true; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: null, updated_at: new Date().toISOString() })
    .eq('id', user.id)
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { ok: true }
}
