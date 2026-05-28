'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  clientProfilePatchSchema,
  paymentSchema,
  type ClientProfilePatch,
  type PaymentInput,
} from '@/lib/validations/client-profile.schema'
import type { ClientAsset, ClientAssetKind, ClientPayment } from '@/lib/supabase/types'

const ASSETS_BUCKET = 'client-assets'
const CONTRACTS_BUCKET = 'client-contracts'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
}

export async function updateClientProfile(clientId: string, input: ClientProfilePatch) {
  const supabase = await createClient()
  const parsed = clientProfilePatchSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join('; ') }
  }
  const patch = parsed.data
  if (Object.keys(patch).length === 0) return { ok: true }

  const { error } = await supabase
    .from('clients')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', clientId)
  if (error) return { error: error.message }

  revalidatePath(`/clients/${clientId}`)
  revalidatePath('/clients')
  return { ok: true }
}

async function uploadToBucket(
  bucket: string,
  path: string,
  file: File,
  cacheControl = '3600',
  upsert = true,
) {
  const supabase = await createClient()
  const buf = Buffer.from(await file.arrayBuffer())
  const { error } = await supabase.storage.from(bucket).upload(path, buf, {
    contentType: file.type || 'application/octet-stream',
    cacheControl,
    upsert,
  })
  return { supabase, error }
}

export async function uploadClientLogo(
  clientId: string,
  formData: FormData,
): Promise<{ ok?: true; url?: string; error?: string }> {
  const supabase = await createClient()
  const file = formData.get('file') as File | null
  const variant = (formData.get('variant') as string | null) ?? 'light' // 'light' | 'dark'
  if (!file || file.size === 0) return { error: 'Archivo requerido' }
  if (!file.type.startsWith('image/')) return { error: 'Solo se permiten imágenes' }
  if (file.size > 5 * 1024 * 1024) return { error: 'Imagen mayor a 5 MB' }

  const ext = file.name.split('.').pop() || 'png'
  const path = `${clientId}/logo-${variant}-${Date.now()}.${ext.toLowerCase()}`

  const { error: upErr } = await supabase.storage.from(ASSETS_BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: false,
  })
  if (upErr) return { error: upErr.message }

  const { data: pub } = supabase.storage.from(ASSETS_BUCKET).getPublicUrl(path)
  const url = pub.publicUrl

  const column = variant === 'dark' ? 'logo_dark_url' : 'logo_url'
  const { error: updErr } = await supabase
    .from('clients')
    .update({ [column]: url, updated_at: new Date().toISOString() })
    .eq('id', clientId)
  if (updErr) return { error: updErr.message }

  // Also register the upload in client_assets so it shows in gallery
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('client_assets').insert({
    client_id: clientId,
    kind: 'logo' satisfies ClientAssetKind,
    name: file.name,
    url,
    storage_path: `${ASSETS_BUCKET}/${path}`,
    size_bytes: file.size,
    mime_type: file.type,
    uploaded_by: user?.id ?? null,
  })

  revalidatePath(`/clients/${clientId}`)
  return { ok: true, url }
}

export async function uploadContract(
  clientId: string,
  formData: FormData,
): Promise<{ ok?: true; url?: string; error?: string }> {
  const supabase = await createClient()
  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'Archivo requerido' }
  if (file.type !== 'application/pdf') return { error: 'Solo PDF permitido' }
  if (file.size > 20 * 1024 * 1024) return { error: 'PDF mayor a 20 MB' }

  const path = `${clientId}/contract-${Date.now()}.pdf`
  const { error: upErr } = await supabase.storage.from(CONTRACTS_BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: false,
  })
  if (upErr) return { error: upErr.message }

  // Contracts are private — keep storage_path; UI generates signed URLs on demand.
  const storagePath = `${CONTRACTS_BUCKET}/${path}`
  const { error: updErr } = await supabase
    .from('clients')
    .update({ contract_url: storagePath, updated_at: new Date().toISOString() })
    .eq('id', clientId)
  if (updErr) return { error: updErr.message }

  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('client_assets').insert({
    client_id: clientId,
    kind: 'contract' satisfies ClientAssetKind,
    name: file.name,
    url: storagePath,
    storage_path: storagePath,
    size_bytes: file.size,
    mime_type: file.type,
    uploaded_by: user?.id ?? null,
  })

  revalidatePath(`/clients/${clientId}`)
  return { ok: true, url: storagePath }
}

export async function getContractSignedUrl(clientId: string): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient()
  const { data: client, error: cErr } = await supabase
    .from('clients')
    .select('contract_url')
    .eq('id', clientId)
    .single()
  if (cErr) return { error: cErr.message }
  if (!client?.contract_url) return { error: 'Sin contrato' }

  const path = client.contract_url.startsWith(`${CONTRACTS_BUCKET}/`)
    ? client.contract_url.slice(CONTRACTS_BUCKET.length + 1)
    : client.contract_url
  const { data, error } = await supabase.storage.from(CONTRACTS_BUCKET).createSignedUrl(path, 60 * 5)
  if (error) return { error: error.message }
  return { url: data.signedUrl }
}

export async function uploadClientAsset(
  clientId: string,
  formData: FormData,
): Promise<{ ok?: true; asset?: ClientAsset; error?: string }> {
  const supabase = await createClient()
  const file = formData.get('file') as File | null
  const kind = (formData.get('kind') as ClientAssetKind | null) ?? 'other'
  const customName = (formData.get('name') as string | null) ?? file?.name ?? 'asset'

  if (!file || file.size === 0) return { error: 'Archivo requerido' }
  if (file.size > 50 * 1024 * 1024) return { error: 'Archivo mayor a 50 MB' }

  const bucket = kind === 'contract' || kind === 'legal' ? CONTRACTS_BUCKET : ASSETS_BUCKET
  const safeName = slugify(file.name)
  const path = `${clientId}/${kind}-${Date.now()}-${safeName}`

  const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    cacheControl: '3600',
    upsert: false,
  })
  if (upErr) return { error: upErr.message }

  const url =
    bucket === ASSETS_BUCKET
      ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
      : `${bucket}/${path}`

  const { data: { user } } = await supabase.auth.getUser()
  const { data, error: insErr } = await supabase
    .from('client_assets')
    .insert({
      client_id: clientId,
      kind,
      name: customName,
      url,
      storage_path: `${bucket}/${path}`,
      size_bytes: file.size,
      mime_type: file.type || null,
      uploaded_by: user?.id ?? null,
    })
    .select('*')
    .single()
  if (insErr) return { error: insErr.message }

  revalidatePath(`/clients/${clientId}`)
  return { ok: true, asset: data as ClientAsset }
}

export async function deleteClientAsset(assetId: string, clientId: string): Promise<{ ok?: true; error?: string }> {
  const supabase = await createClient()
  const { data: asset, error: fetchErr } = await supabase
    .from('client_assets')
    .select('storage_path')
    .eq('id', assetId)
    .single()
  if (fetchErr) return { error: fetchErr.message }

  if (asset?.storage_path) {
    const [bucket, ...rest] = asset.storage_path.split('/')
    const objectPath = rest.join('/')
    if (bucket && objectPath) {
      await supabase.storage.from(bucket).remove([objectPath])
    }
  }

  const { error } = await supabase.from('client_assets').delete().eq('id', assetId)
  if (error) return { error: error.message }

  revalidatePath(`/clients/${clientId}`)
  return { ok: true }
}

export async function getClientAssets(clientId: string, kind?: ClientAssetKind) {
  const supabase = await createClient()
  let q = supabase.from('client_assets').select('*').eq('client_id', clientId)
  if (kind) q = q.eq('kind', kind)
  const { data, error } = await q.order('uploaded_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as ClientAsset[]
}

export async function addPayment(
  clientId: string,
  input: PaymentInput,
): Promise<{ ok?: true; payment?: ClientPayment; error?: string }> {
  const supabase = await createClient()
  const parsed = paymentSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join('; ') }

  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('client_payments')
    .insert({ client_id: clientId, ...parsed.data, created_by: user?.id ?? null })
    .select('*')
    .single()
  if (error) return { error: error.message }

  revalidatePath(`/clients/${clientId}`)
  return { ok: true, payment: data as ClientPayment }
}

export async function deletePayment(paymentId: string, clientId: string): Promise<{ ok?: true; error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('client_payments').delete().eq('id', paymentId)
  if (error) return { error: error.message }
  revalidatePath(`/clients/${clientId}`)
  return { ok: true }
}

export async function getClientPayments(clientId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('client_payments')
    .select('*')
    .eq('client_id', clientId)
    .order('paid_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as ClientPayment[]
}

