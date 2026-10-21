'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import { credentialKeyConfigured, decryptSecret, encryptSecret } from '@/lib/crypto/credential-cipher'
import {
  isCredentialPlatform,
  type ClientCredentialSummary,
  type CredentialPlatform,
} from '@/lib/utils/client-credentials-types'

/**
 * Accesos (usuario + contraseña) de cada red social del cliente.
 *
 * La contraseña se cifra en el servidor antes de tocar la base y solo se
 * descifra cuando alguien con permiso pulsa «Mostrar» o «Copiar». La lista
 * nunca la incluye, ni siquiera cifrada.
 */

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

export async function listClientCredentials(clientId: string): Promise<{
  credentials?: ClientCredentialSummary[]
  keyConfigured: boolean
  error?: string
}> {
  const keyConfigured = credentialKeyConfigured()
  try {
    await requirePermission('clients.credentials.read')
  } catch (err) {
    return { keyConfigured, error: errorText(err, 'No autorizado') }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('client_social_credentials')
    .select('id, platform, username, notes, updated_at, password_encrypted')
    .eq('client_id', clientId)
    .order('platform')
  if (error) {
    const missing = ['PGRST205', '42P01'].includes((error as { code?: string }).code ?? '')
    return { keyConfigured, error: missing ? 'Falta aplicar la migración 0092 (accesos de redes) en Supabase.' : error.message }
  }

  const credentials = ((data ?? []) as (Omit<ClientCredentialSummary, 'has_password'> & { password_encrypted: string | null })[])
    .map(({ password_encrypted, ...row }) => ({ ...row, has_password: !!password_encrypted }))
  return { credentials, keyConfigured }
}

export async function saveClientCredential(input: {
  id?: string
  clientId: string
  platform: CredentialPlatform
  username: string
  /** Vacío o ausente al editar = conservar la contraseña guardada. */
  password?: string
  notes?: string
}): Promise<{ ok?: true; id?: string; error?: string }> {
  try {
    await requirePermission('clients.credentials.edit')
  } catch (err) {
    return { error: errorText(err, 'No autorizado') }
  }

  if (!isCredentialPlatform(input.platform)) return { error: 'Red social no reconocida.' }
  const username = input.username.trim()
  if (!username) return { error: 'Escribe el usuario.' }

  const row: Record<string, unknown> = {
    platform: input.platform,
    username,
    notes: input.notes?.trim() || null,
  }
  if (input.password) {
    try {
      row.password_encrypted = encryptSecret(input.password)
    } catch (err) {
      return { error: errorText(err, 'No se pudo cifrar la contraseña.') }
    }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  row.updated_by = user?.id ?? null
  row.updated_at = new Date().toISOString()

  // .select() para contar filas: un UPDATE bloqueado por RLS no da error,
  // simplemente no cambia nada.
  const { data, error } = input.id
    ? await supabase
        .from('client_social_credentials')
        .update(row)
        .eq('id', input.id)
        .eq('client_id', input.clientId)
        .select('id')
    : await supabase
        .from('client_social_credentials')
        .insert({ ...row, client_id: input.clientId })
        .select('id')
  if (error) return { error: error.message }
  const saved = (data ?? []) as { id: string }[]
  if (saved.length === 0) return { error: 'No se guardó: no tienes permiso o el acceso ya no existe.' }

  revalidatePath(`/clients/${input.clientId}`)
  return { ok: true, id: saved[0].id }
}

export async function revealClientCredentialPassword(id: string): Promise<{ password?: string; error?: string }> {
  try {
    await requirePermission('clients.credentials.read')
  } catch (err) {
    return { error: errorText(err, 'No autorizado') }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('client_social_credentials')
    .select('password_encrypted')
    .eq('id', id)
    .maybeSingle()
  if (error) return { error: error.message }
  const sealed = (data as { password_encrypted: string | null } | null)?.password_encrypted
  if (!sealed) return { error: 'Este acceso no tiene contraseña guardada.' }
  try {
    return { password: decryptSecret(sealed) }
  } catch (err) {
    return { error: errorText(err, 'No se pudo descifrar la contraseña.') }
  }
}

export async function deleteClientCredential(id: string): Promise<{ ok?: true; error?: string }> {
  try {
    await requirePermission('clients.credentials.edit')
  } catch (err) {
    return { error: errorText(err, 'No autorizado') }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('client_social_credentials')
    .delete()
    .eq('id', id)
    .select('id')
  if (error) return { error: error.message }
  if (((data ?? []) as unknown[]).length === 0) return { error: 'No se borró: no tienes permiso o ya no existe.' }
  return { ok: true }
}
