'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/server'
import type { ClientAsset, ClientAssetKind } from '@/lib/supabase/types'

/**
 * Activo del cliente que es un ENLACE (carpeta de Drive con los B-rolls, el
 * Drive de logos…), sin archivo en Storage. Mismo catálogo que los archivos
 * subidos, así el banco del editor siempre tiene a dónde apuntar.
 */
export async function addClientAssetLink(
  clientId: string,
  input: { name: string; url: string; kind: ClientAssetKind },
): Promise<{ ok?: true; asset?: ClientAsset; error?: string }> {
  try {
    await requirePermission('clients.edit')
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'No autorizado' }
  }
  const name = input.name.trim()
  if (!name) return { error: 'Ponle un nombre al enlace (p. ej. "B-rolls en Drive").' }
  let url: URL
  try {
    url = new URL(input.url.trim())
  } catch {
    return { error: 'El enlace no es válido.' }
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { error: 'El enlace tiene que empezar por http(s).' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('client_assets')
    .insert({
      client_id: clientId,
      kind: input.kind,
      name,
      url: url.toString(),
      storage_path: null,
      size_bytes: null,
      mime_type: null,
      uploaded_by: user?.id ?? null,
    })
    .select()
    .single()
  if (error) return { error: error.message }
  revalidatePath(`/clients/${clientId}`)
  revalidatePath('/pipeline')
  return { ok: true, asset: data as ClientAsset }
}
