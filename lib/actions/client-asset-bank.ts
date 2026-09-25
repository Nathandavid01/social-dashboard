'use server'

import { revalidatePath } from 'next/cache'
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { requirePermission, getEffectiveRole } from '@/lib/auth/server'
import { hasPermission } from '@/lib/auth/permissions'
import { createClient } from '@/lib/supabase/server'
import { r2Client, r2Bucket, isR2Configured } from '@/lib/integrations/r2'
import type { ClientAsset } from '@/lib/supabase/types'
import {
  BANK_KINDS,
  clientAssetR2Key,
  decodeR2StoragePath,
  encodeR2StoragePath,
  filterBankAssets,
  groupBankAssetsByClient,
  isBankAssetKind,
  isClientAssetR2Key,
  toClientBankFile,
  validateBankUpload,
  type ClientBankFile,
} from '@/lib/utils/client-asset-bank'
import { attachmentDisposition } from '@/lib/utils/content-disposition'

/**
 * Banco permanente por cliente. Additive: nunca escribe ni borra
 * `content_idea_videos` ni objetos bajo `ideas/` (crudos del pipeline).
 */

const MIGRATION_PENDING =
  'Falta una actualización pendiente en la base de datos (banco del cliente). Avisa al equipo.'

function canReadBank(role: Awaited<ReturnType<typeof getEffectiveRole>>): boolean {
  return (
    hasPermission(role, 'clients.assets.upload')
    || hasPermission(role, 'pipeline.read')
    || hasPermission(role, 'recording.read')
  )
}

function authError(err: unknown): string {
  return err instanceof Error ? err.message : 'No autorizado'
}

function isKindConstraintError(message: string | undefined): boolean {
  if (!message) return false
  return /client_assets_kind|check constraint|invalid input value/i.test(message)
}

function refreshBankPaths(clientId: string) {
  revalidatePath('/onsite')
  revalidatePath('/pipeline')
  revalidatePath(`/clients/${clientId}`)
  revalidatePath('/produccion')
}

export async function getClientAssetUploadUrl(input: {
  clientId: string
  kind: string
  fileName: string
  contentType: string
}): Promise<{ url?: string; key?: string; error?: string }> {
  try {
    await requirePermission('clients.assets.upload')
  } catch (err) {
    return { error: authError(err) }
  }

  const problem = validateBankUpload({
    clientId: input.clientId,
    kind: input.kind,
    fileName: input.fileName,
    mimeType: input.contentType,
    sizeBytes: 1,
    storage: 'r2',
  })
  if (problem) return { error: problem }
  if (!isBankAssetKind(input.kind)) return { error: 'Elige una categoría: logo, B-roll, foto u otro' }
  if (!isR2Configured()) return { error: 'R2 no está configurado' }

  const client = r2Client()
  if (!client) return { error: 'R2 no está configurado' }

  const key = clientAssetR2Key(input.clientId.trim(), input.kind, input.fileName)
  try {
    const url = await getSignedUrl(
      client,
      new PutObjectCommand({ Bucket: r2Bucket(), Key: key, ContentType: input.contentType }),
      { expiresIn: 60 * 60 },
    )
    return { url, key }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error generando URL de subida' }
  }
}

export async function registerClientBankAsset(input: {
  clientId: string
  kind: string
  name: string
  key: string
  sizeBytes: number
  mimeType: string
}): Promise<{ ok?: true; asset?: ClientAsset; error?: string }> {
  try {
    await requirePermission('clients.assets.upload')
  } catch (err) {
    return { error: authError(err) }
  }

  const problem = validateBankUpload({
    clientId: input.clientId,
    kind: input.kind,
    fileName: input.name,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    storage: 'r2',
  })
  if (problem) return { error: problem }
  if (!isBankAssetKind(input.kind)) return { error: 'Elige una categoría: logo, B-roll, foto u otro' }
  if (!isClientAssetR2Key(input.key, input.clientId.trim())) {
    return { error: 'Ese archivo no pertenece al banco del cliente' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const storagePath = encodeR2StoragePath(input.key)
  const { data, error } = await supabase
    .from('client_assets')
    .insert({
      client_id: input.clientId.trim(),
      kind: input.kind,
      name: input.name.trim() || input.key.split('/').pop() || 'archivo',
      url: storagePath,
      storage_path: storagePath,
      size_bytes: input.sizeBytes,
      mime_type: input.mimeType || null,
      uploaded_by: user?.id ?? null,
    })
    .select('*')
    .single()
  if (error) {
    return { error: isKindConstraintError(error.message) ? MIGRATION_PENDING : error.message }
  }

  refreshBankPaths(input.clientId.trim())
  return { ok: true, asset: data as ClientAsset }
}

export async function listClientBankAssets(
  clientId: string,
): Promise<{ assets?: ClientBankFile[]; error?: string }> {
  const role = await getEffectiveRole()
  if (!canReadBank(role)) return { error: 'No autorizado' }
  if (!clientId.trim()) return { error: 'Elige un cliente' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('client_assets')
    .select('*')
    .eq('client_id', clientId.trim())
    .order('uploaded_at', { ascending: false })
  if (error) return { error: error.message }
  return { assets: filterBankAssets(data ?? []).map(toClientBankFile).filter((a): a is ClientBankFile => a !== null) }
}

export async function listClientBankAssetsByClientIds(
  clientIds: string[],
): Promise<{ byClient?: Record<string, ClientBankFile[]>; error?: string }> {
  const role = await getEffectiveRole()
  if (!canReadBank(role)) return { error: 'No autorizado' }
  const ids = [...new Set(clientIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) return { byClient: {} }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('client_assets')
    .select('*')
    .in('client_id', ids)
    .order('uploaded_at', { ascending: false })
  if (error) return { error: error.message }
  return { byClient: groupBankAssetsByClient(data ?? []) }
}

export async function getClientAssetDownloadUrl(
  assetId: string,
): Promise<{ url?: string; error?: string }> {
  const role = await getEffectiveRole()
  if (!canReadBank(role)) return { error: 'No autorizado' }
  if (!assetId.trim()) return { error: 'Archivo no encontrado' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('client_assets')
    .select('id, client_id, kind, name, url, storage_path')
    .eq('id', assetId.trim())
    .maybeSingle()
  if (error || !data) return { error: 'Archivo no encontrado' }
  if (!isBankAssetKind(data.kind)) return { error: 'Ese archivo no pertenece al banco del cliente' }

  const key = decodeR2StoragePath(data.storage_path) ?? decodeR2StoragePath(data.url)
  if (key) {
    if (!isClientAssetR2Key(key, data.client_id)) {
      return { error: 'Ese archivo no pertenece al banco del cliente' }
    }
    const client = r2Client()
    if (!client || !isR2Configured()) return { error: 'R2 no está configurado' }
    try {
      const url = await getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: r2Bucket(),
          Key: key,
          ResponseContentDisposition: attachmentDisposition(data.name, 'archivo'),
        }),
        { expiresIn: 60 * 60 },
      )
      return { url }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Error generando URL de descarga' }
    }
  }

  if (typeof data.url === 'string' && /^https?:\/\//i.test(data.url)) return { url: data.url }
  return { error: 'Archivo no disponible' }
}

export async function deleteClientBankAsset(
  assetId: string,
  clientId: string,
): Promise<{ ok?: true; error?: string }> {
  try {
    await requirePermission('clients.assets.upload')
  } catch (err) {
    return { error: authError(err) }
  }

  const supabase = await createClient()
  const { data: asset, error: fetchErr } = await supabase
    .from('client_assets')
    .select('id, client_id, kind, storage_path, url')
    .eq('id', assetId)
    .maybeSingle()
  if (fetchErr || !asset) return { error: 'Archivo no encontrado' }
  if (asset.client_id !== clientId) return { error: 'Archivo no encontrado' }
  if (!isBankAssetKind(asset.kind)) return { error: 'Ese archivo no pertenece al banco del cliente' }

  const key = decodeR2StoragePath(asset.storage_path) ?? decodeR2StoragePath(asset.url)
  if (key) {
    if (!isClientAssetR2Key(key, clientId)) {
      return { error: 'Ese archivo no pertenece al banco del cliente' }
    }
    const client = r2Client()
    if (!client || !isR2Configured()) return { error: 'R2 no está configurado' }
    try {
      await client.send(new DeleteObjectCommand({ Bucket: r2Bucket(), Key: key }))
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'No se pudo borrar el archivo' }
    }
  } else if (typeof asset.storage_path === 'string' && asset.storage_path.includes('ideas/')) {
    return { error: 'Ese archivo no pertenece al banco del cliente' }
  }

  const { error } = await supabase.from('client_assets').delete().eq('id', assetId)
  if (error) return { error: error.message }
  refreshBankPaths(clientId)
  return { ok: true }
}
