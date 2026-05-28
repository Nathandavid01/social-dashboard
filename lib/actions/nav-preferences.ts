'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { NavPreferences } from '@/lib/supabase/types'

export async function saveNavPreferences(prefs: NavPreferences): Promise<{ ok?: true; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Validate shape: each href is a string starting with "/"
  const clean: NavPreferences = {}
  if (Array.isArray(prefs.order)) {
    clean.order = prefs.order.filter((h) => typeof h === 'string' && h.startsWith('/'))
  }
  if (Array.isArray(prefs.hidden)) {
    clean.hidden = prefs.hidden.filter((h) => typeof h === 'string' && h.startsWith('/'))
  }

  const { error } = await supabase
    .from('profiles')
    .update({ nav_preferences: clean, updated_at: new Date().toISOString() })
    .eq('id', user.id)
  if (error) return { error: error.message }

  // Refresh layout so sidebar reflects new prefs on next render
  revalidatePath('/', 'layout')
  return { ok: true }
}
