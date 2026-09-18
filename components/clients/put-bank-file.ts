'use client'

import { getClientAssetUploadUrl, registerClientBankAsset } from '@/lib/actions/client-asset-bank'
import { uploadClientAsset } from '@/lib/actions/client-profile'
import {
  isBankAssetKind,
  storageForBankFile,
  validateBankUpload,
  type BankAssetKind,
} from '@/lib/utils/client-asset-bank'

export async function putBankFile(input: {
  clientId: string
  kind: BankAssetKind
  file: File
}): Promise<{ error?: string }> {
  if (!isBankAssetKind(input.kind)) return { error: 'Elige una categoría: logo, B-roll, foto u otro' }

  const asR2 = validateBankUpload({
    clientId: input.clientId,
    kind: input.kind,
    fileName: input.file.name,
    mimeType: input.file.type,
    sizeBytes: input.file.size,
    storage: 'r2',
  })
  if (asR2) return { error: asR2 }

  const signed = await getClientAssetUploadUrl({
    clientId: input.clientId,
    kind: input.kind,
    fileName: input.file.name,
    contentType: input.file.type || 'application/octet-stream',
  })

  if (signed.error && /R2 no está configurado/i.test(signed.error)) {
    if (storageForBankFile(input.kind, input.file.type, false) !== 'supabase') {
      return { error: signed.error }
    }
    const fallback = validateBankUpload({
      clientId: input.clientId,
      kind: input.kind,
      fileName: input.file.name,
      mimeType: input.file.type,
      sizeBytes: input.file.size,
      storage: 'supabase',
    })
    if (fallback) return { error: fallback }
    const fd = new FormData()
    fd.append('file', input.file)
    fd.append('kind', input.kind)
    fd.append('name', input.file.name)
    const res = await uploadClientAsset(input.clientId, fd)
    return res.error ? { error: res.error } : {}
  }

  if (signed.error || !signed.url || !signed.key) {
    return { error: signed.error || 'No se pudo preparar la subida' }
  }

  const put = await fetch(signed.url, {
    method: 'PUT',
    body: input.file,
    headers: { 'Content-Type': input.file.type || 'application/octet-stream' },
  })
  if (!put.ok) return { error: 'La subida falló. Intenta otra vez.' }

  const saved = await registerClientBankAsset({
    clientId: input.clientId,
    kind: input.kind,
    name: input.file.name,
    key: signed.key,
    sizeBytes: input.file.size,
    mimeType: input.file.type || 'application/octet-stream',
  })
  return saved.error ? { error: saved.error } : {}
}
