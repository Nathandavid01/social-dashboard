/**
 * Banco permanente de assets por cliente (logo, b-roll, foto, otro).
 * Vive en `client_assets`, no en una idea ni en content_idea_videos.
 * PURO — sin imports de servidor.
 */

export const BANK_KINDS = ['logo', 'broll', 'photo', 'other'] as const
export type BankAssetKind = (typeof BANK_KINDS)[number]

export const BANK_KIND_LABELS: Record<BankAssetKind, string> = {
  logo: 'Logo',
  broll: 'B-roll',
  photo: 'Foto',
  other: 'Otro',
}

/** Tope ya implementado en `uploadClientAsset` (bucket Supabase `client-assets`). */
export const SUPABASE_ASSET_MAX_BYTES = 50 * 1024 * 1024

const R2_PATH_PREFIX = 'r2:'

export interface BankAssetRow {
  id: string
  client_id: string
  kind: string
  name?: string
  url?: string
  storage_path?: string | null
  size_bytes?: number | null
  mime_type?: string | null
}

export interface ClientBankFile {
  id: string
  clientId: string
  name: string
  kind: BankAssetKind
  url: string
  storagePath: string | null
  sizeBytes: number | null
  mimeType: string | null
}

export function isBankAssetKind(kind: string): kind is BankAssetKind {
  return (BANK_KINDS as readonly string[]).includes(kind)
}

export function filterBankAssets<T extends { kind: string }>(assets: T[]): T[] {
  return assets.filter((asset) => isBankAssetKind(asset.kind))
}

export function storageForBankFile(
  _kind: BankAssetKind,
  _mimeType: string,
  r2Configured: boolean,
): 'r2' | 'supabase' {
  return r2Configured ? 'r2' : 'supabase'
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export function clientAssetR2Key(
  clientId: string,
  kind: BankAssetKind,
  fileName: string,
  now = Date.now(),
): string {
  return `client-assets/${clientId}/${kind}/${now}-${slugify(fileName)}`
}

export function isClientAssetR2Key(key: string, clientId?: string): boolean {
  if (!key || key.includes('..') || key.includes('\\')) return false
  if (key.startsWith('ideas/') || key.includes('/ideas/')) return false
  if (!key.startsWith('client-assets/')) return false
  if (clientId && !key.startsWith(`client-assets/${clientId}/`)) return false
  return true
}

export function encodeR2StoragePath(key: string): string {
  return `${R2_PATH_PREFIX}${key}`
}

export function decodeR2StoragePath(path: string | null | undefined): string | null {
  if (!path?.startsWith(R2_PATH_PREFIX)) return null
  return path.slice(R2_PATH_PREFIX.length)
}

export function validateBankUpload(input: {
  clientId: string
  kind: string
  fileName: string
  mimeType: string
  sizeBytes: number
  storage: 'r2' | 'supabase'
}): string | null {
  if (!input.clientId.trim()) return 'Elige un cliente'
  if (!isBankAssetKind(input.kind)) return 'Elige una categoría: logo, B-roll, foto u otro'
  if (!input.fileName.trim() || input.sizeBytes <= 0) return 'Elige un archivo'
  if (input.storage === 'supabase' && input.sizeBytes > SUPABASE_ASSET_MAX_BYTES) {
    return 'Archivo mayor a 50 MB'
  }
  const mime = (input.mimeType ?? '').split(';')[0]!.trim().toLowerCase()
  if (input.kind === 'logo' || input.kind === 'photo') {
    if (!mime.startsWith('image/') || mime === 'image/') return 'Solo se aceptan imágenes para logo y foto'
  }
  if (input.kind === 'broll') {
    if (!mime.startsWith('video/') || mime === 'video/') return 'El B-roll tiene que ser un video'
  }
  return null
}

export function toClientBankFile(row: BankAssetRow): ClientBankFile | null {
  if (!isBankAssetKind(row.kind)) return null
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name?.trim() || 'archivo',
    kind: row.kind,
    url: row.url ?? '',
    storagePath: row.storage_path ?? null,
    sizeBytes: row.size_bytes ?? null,
    mimeType: row.mime_type ?? null,
  }
}

export function groupBankAssetsByClient(rows: BankAssetRow[]): Record<string, ClientBankFile[]> {
  const grouped: Record<string, ClientBankFile[]> = {}
  for (const row of rows) {
    const file = toClientBankFile(row)
    if (!file) continue
    const list = grouped[file.clientId] ?? []
    list.push(file)
    grouped[file.clientId] = list
  }
  return grouped
}
