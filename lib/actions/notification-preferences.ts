'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  normalizeNotificationPreferences,
  type NotificationPreferences,
} from '@/lib/utils/notification-preferences'

export async function getMyNotificationPreferences(): Promise<NotificationPreferences> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}
  const { data } = await supabase
    .from('profiles')
    .select('notification_preferences')
    .eq('id', user.id)
    .maybeSingle()
  return normalizeNotificationPreferences(data?.notification_preferences)
}

export async function saveNotificationPreferences(
  prefs: NotificationPreferences,
): Promise<{ ok?: true; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: existing } = await supabase
    .from('profiles')
    .select('notification_preferences')
    .eq('id', user.id)
    .maybeSingle()

  const merged = {
    ...normalizeNotificationPreferences(existing?.notification_preferences),
    ...normalizeNotificationPreferences(prefs),
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      notification_preferences: merged,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  revalidatePath('/account/notifications')
  return { ok: true }
}
