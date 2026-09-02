'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import { canUpdateOwnAvatar, isAllowedAvatarUrl, validateAvatarFile } from '@/lib/utils/avatar-core'
import { storeAvatar } from '@/lib/utils/avatar-storage'

async function requireOwnAvatarWrite(): Promise<{ userId: string } | { error: string }> {
  try {
    await requirePermission('profile.avatar')
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'No autorizado' }
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !canUpdateOwnAvatar(user.id, user.id)) return { error: 'No autenticado' }
  return { userId: user.id }
}

/** Set a generated (DiceBear) avatar URL for the current user. */
export async function setAvatarUrl(url: string): Promise<{ ok?: true; error?: string }> {
  const gate = await requireOwnAvatarWrite()
  if ('error' in gate) return { error: gate.error }
  const supabase = await createClient()
  if (!isAllowedAvatarUrl(url)) return { error: 'URL de avatar no permitida' }

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: url, updated_at: new Date().toISOString() })
    .eq('id', gate.userId)
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function uploadAvatar(formData: FormData): Promise<{ ok?: true; url?: string; error?: string }> {
  const gate = await requireOwnAvatarWrite()
  if ('error' in gate) return { error: gate.error }
  const supabase = await createClient()
  const user = { id: gate.userId }

  const valid = validateAvatarFile(formData.get('file') as File | null)
  if (!valid.ok) return { error: valid.error }
  const stored = await storeAvatar(supabase, user.id, valid.file)
  if ('error' in stored) return { error: stored.error }
  const url = stored.url

  const { error: updErr } = await supabase
    .from('profiles')
    .update({ avatar_url: url, updated_at: new Date().toISOString() })
    .eq('id', user.id)
  if (updErr) return { error: updErr.message }

  revalidatePath('/', 'layout')
  return { ok: true, url }
}

export async function removeAvatar(): Promise<{ ok?: true; error?: string }> {
  const gate = await requireOwnAvatarWrite()
  if ('error' in gate) return { error: gate.error }
  const supabase = await createClient()

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: null, updated_at: new Date().toISOString() })
    .eq('id', gate.userId)
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { ok: true }
}
