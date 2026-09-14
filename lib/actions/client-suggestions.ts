'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentRole, getEffectiveRole } from '@/lib/auth/server'
import { hasAnyPermission } from '@/lib/auth/permissions'
import {
  normalizeSuggestionInput,
  sortSuggestionsNewestFirst,
} from '@/lib/utils/client-suggestions'
import type { ClientSuggestion } from '@/lib/supabase/types'

async function assertCanEditSuggestions(): Promise<{ error?: string }> {
  const role = await getCurrentRole()
  if (!hasAnyPermission(role, ['clients.edit', 'clients.brand.edit'])) {
    return { error: 'No tienes permiso para guardar sugerencias del cliente.' }
  }
  return {}
}

/** List suggestions (newest first). clients.read or ideas.read (idea writers). */
export async function listClientSuggestions(
  clientId: string,
): Promise<{ suggestions: ClientSuggestion[]; error?: string }> {
  const role = await getEffectiveRole()
  if (!hasAnyPermission(role, ['clients.read', 'ideas.read'])) {
    return {
      suggestions: [],
      error: 'No tienes permiso para ver sugerencias del cliente.',
    }
  }

  if (!clientId) return { suggestions: [], error: 'Cliente requerido.' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('client_suggestions')
    .select('id, client_id, body, source, created_by, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error) return { suggestions: [], error: error.message }

  const suggestions = sortSuggestionsNewestFirst(
    (data ?? []) as ClientSuggestion[],
  )
  return { suggestions }
}

/** Add a manually pasted client suggestion. Requires clients.edit or clients.brand.edit. */
export async function addClientSuggestion(input: {
  clientId: string
  body: string
  source?: string
}): Promise<{ suggestion?: ClientSuggestion; error?: string }> {
  const gate = await assertCanEditSuggestions()
  if (gate.error) return gate

  const parsed = normalizeSuggestionInput({ body: input.body, source: input.source })
  if (!parsed.ok) return { error: parsed.error }

  if (!input.clientId) return { error: 'Cliente requerido.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado.' }

  const { data, error } = await supabase
    .from('client_suggestions')
    .insert({
      client_id: input.clientId,
      body: parsed.body,
      source: parsed.source,
      created_by: user.id,
    })
    .select('id, client_id, body, source, created_by, created_at')
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/clients/${input.clientId}`)
  revalidatePath('/escribir-ideas')

  return { suggestion: data as ClientSuggestion }
}
