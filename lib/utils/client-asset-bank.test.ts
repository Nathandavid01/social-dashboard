import { describe, expect, it } from 'vitest'
import {
  BANK_KIND_LABELS,
  BANK_KINDS,
  SUPABASE_ASSET_MAX_BYTES,
  clientAssetR2Key,
  decodeR2StoragePath,
  encodeR2StoragePath,
  filterBankAssets,
  groupBankAssetsByClient,
  isBankAssetKind,
  isClientAssetR2Key,
  storageForBankFile,
  validateBankUpload,
} from './client-asset-bank'

describe('banco del cliente — tipos', () => {
  it('solo admite logo, b-roll, foto y otro', () => {
    expect(BANK_KINDS).toEqual(['logo', 'broll', 'photo', 'other'])
    expect(BANK_KIND_LABELS).toEqual({
      logo: 'Logo',
      broll: 'B-roll',
      photo: 'Foto',
      other: 'Otro',
    })
    expect(isBankAssetKind('logo')).toBe(true)
    expect(isBankAssetKind('broll')).toBe(true)
    expect(isBankAssetKind('photo')).toBe(true)
    expect(isBankAssetKind('other')).toBe(true)
    expect(isBankAssetKind('color_guide')).toBe(false)
    expect(isBankAssetKind('raw')).toBe(false)
  })

  it('deja fuera contratos y guías de marca; el banco es additive', () => {
    const assets = [
      { id: '1', client_id: 'c1', kind: 'logo' as const },
      { id: '2', client_id: 'c1', kind: 'contract' as const },
      { id: '3', client_id: 'c1', kind: 'photo' as const },
      { id: '4', client_id: 'c1', kind: 'broll' as const },
      { id: '5', client_id: 'c1', kind: 'legal' as const },
    ]
    expect(filterBankAssets(assets).map((a) => a.id)).toEqual(['1', '3', '4'])
  })
})

describe('banco del cliente — almacenamiento', () => {
  it('el B-roll y cualquier video van a R2 bajo client-assets/, nunca ideas/', () => {
    expect(storageForBankFile('broll', 'video/mp4', true)).toBe('r2')
    expect(storageForBankFile('other', 'video/quicktime', true)).toBe('r2')
    expect(storageForBankFile('photo', 'image/jpeg', true)).toBe('r2')
    expect(storageForBankFile('logo', 'image/png', true)).toBe('r2')
    expect(storageForBankFile('photo', 'image/jpeg', false)).toBe('supabase')
  })

  it('la clave R2 vive por cliente y no se parece a un crudo del pipeline', () => {
    const key = clientAssetR2Key('c1', 'broll', 'Patio.mov', 1_700_000_000_000)
    expect(key).toBe('client-assets/c1/broll/1700000000000-patio.mov')
    expect(key.startsWith('ideas/')).toBe(false)
    expect(isClientAssetR2Key(key, 'c1')).toBe(true)
    expect(isClientAssetR2Key('ideas/idea-1/raw/clip.mp4', 'c1')).toBe(false)
    expect(isClientAssetR2Key('client-assets/other-client/broll/x.mp4', 'c1')).toBe(false)
    expect(isClientAssetR2Key('client-assets/c1/../ideas/x.mp4', 'c1')).toBe(false)
  })

  it('codifica R2 en storage_path sin tocar content_idea_videos', () => {
    expect(encodeR2StoragePath('client-assets/c1/photo/1-x.jpg')).toBe('r2:client-assets/c1/photo/1-x.jpg')
    expect(decodeR2StoragePath('r2:client-assets/c1/photo/1-x.jpg')).toBe('client-assets/c1/photo/1-x.jpg')
    expect(decodeR2StoragePath('client-assets/c1/logo-1.png')).toBeNull()
  })

  it('el tope de 50 MB solo aplica al bucket de Supabase, no a R2', () => {
    expect(SUPABASE_ASSET_MAX_BYTES).toBe(50 * 1024 * 1024)
    expect(validateBankUpload({
      clientId: 'c1',
      kind: 'photo',
      fileName: 'local.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: SUPABASE_ASSET_MAX_BYTES + 1,
      storage: 'supabase',
    })).toMatch(/50 MB/)
    expect(validateBankUpload({
      clientId: 'c1',
      kind: 'broll',
      fileName: 'patio.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 800 * 1024 * 1024,
      storage: 'r2',
    })).toBeNull()
  })
})

describe('validateBankUpload', () => {
  it('exige cliente, archivo y una etiqueta del banco', () => {
    expect(validateBankUpload({
      clientId: '',
      kind: 'photo',
      fileName: 'a.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 10,
      storage: 'r2',
    })).toMatch(/cliente/i)
    expect(validateBankUpload({
      clientId: 'c1',
      kind: 'raw',
      fileName: 'a.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 10,
      storage: 'r2',
    })).toMatch(/categoría/i)
    expect(validateBankUpload({
      clientId: 'c1',
      kind: 'photo',
      fileName: '',
      mimeType: 'image/jpeg',
      sizeBytes: 10,
      storage: 'r2',
    })).toMatch(/archivo/i)
  })

  it('logo y foto son imagen; b-roll es video', () => {
    expect(validateBankUpload({
      clientId: 'c1',
      kind: 'logo',
      fileName: 'marca.png',
      mimeType: 'image/png',
      sizeBytes: 20,
      storage: 'r2',
    })).toBeNull()
    expect(validateBankUpload({
      clientId: 'c1',
      kind: 'photo',
      fileName: 'sala.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 20,
      storage: 'r2',
    })).toMatch(/imágenes/i)
    expect(validateBankUpload({
      clientId: 'c1',
      kind: 'broll',
      fileName: 'sala.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 20,
      storage: 'r2',
    })).toMatch(/video/i)
  })
})

describe('groupBankAssetsByClient', () => {
  it('agrupa el banco por cliente y descarta lo que no es del banco', () => {
    const grouped = groupBankAssetsByClient([
      { id: 'a', client_id: 'c1', kind: 'logo', name: 'Logo.png', url: 'https://x/logo.png', storage_path: 'client-assets/c1/logo.png', size_bytes: 10, mime_type: 'image/png' },
      { id: 'b', client_id: 'c1', kind: 'contract', name: 'Contrato.pdf', url: 'x', storage_path: 'x', size_bytes: 10, mime_type: 'application/pdf' },
      { id: 'c', client_id: 'c2', kind: 'broll', name: 'Patio.mp4', url: 'r2:client-assets/c2/broll/1.mp4', storage_path: 'r2:client-assets/c2/broll/1.mp4', size_bytes: 99, mime_type: 'video/mp4' },
    ])
    expect(Object.keys(grouped)).toEqual(['c1', 'c2'])
    expect(grouped.c1).toHaveLength(1)
    expect(grouped.c1[0]?.kind).toBe('logo')
    expect(grouped.c2[0]?.kind).toBe('broll')
  })
})
