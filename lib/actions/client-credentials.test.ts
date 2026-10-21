import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { randomBytes } from 'node:crypto'

const requirePermission = vi.fn(async (_perm: string) => {})
vi.mock('@/lib/auth/server', () => ({ requirePermission: (p: string) => requirePermission(p) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

type Call = { table: string; op: string; payload?: Record<string, unknown>; filters: [string, unknown][] }
let calls: Call[] = []
let result: { data: unknown; error: { message: string } | null } = { data: [], error: null }

function builder(table: string) {
  const call: Call = { table, op: 'select', filters: [] }
  calls.push(call)
  const b: Record<string, unknown> = {
    select: () => b,
    insert: (p: Record<string, unknown>) => { call.op = 'insert'; call.payload = p; return b },
    update: (p: Record<string, unknown>) => { call.op = 'update'; call.payload = p; return b },
    delete: () => { call.op = 'delete'; return b },
    eq: (k: string, v: unknown) => { call.filters.push([k, v]); return b },
    order: () => b,
    maybeSingle: async () => ({ data: Array.isArray(result.data) ? result.data[0] ?? null : result.data, error: result.error }),
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(result).then(res, rej),
  }
  return b
}

const supa = {
  auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'actor-1' } } })) },
  from: vi.fn((t: string) => builder(t)),
}
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => supa }))

import {
  listClientCredentials,
  saveClientCredential,
  revealClientCredentialPassword,
  deleteClientCredential,
} from './client-credentials'
import { encryptSecret } from '@/lib/crypto/credential-cipher'

let savedKey: string | undefined
beforeEach(() => {
  savedKey = process.env.CLIENT_CREDENTIALS_KEY
  process.env.CLIENT_CREDENTIALS_KEY = randomBytes(32).toString('base64')
  calls = []
  result = { data: [], error: null }
  requirePermission.mockReset().mockResolvedValue(undefined)
})
afterEach(() => {
  if (savedKey === undefined) delete process.env.CLIENT_CREDENTIALS_KEY
  else process.env.CLIENT_CREDENTIALS_KEY = savedKey
})

describe('listClientCredentials', () => {
  it('exige clients.credentials.read y nunca devuelve la contraseña cifrada', async () => {
    result = {
      data: [{ id: 'k1', platform: 'instagram', username: '@cafe', notes: null, updated_at: '2026-10-20', password_encrypted: 'v1:a:b:c' }],
      error: null,
    }
    const res = await listClientCredentials('c1')
    expect(requirePermission).toHaveBeenCalledWith('clients.credentials.read')
    expect(res.credentials).toEqual([
      { id: 'k1', platform: 'instagram', username: '@cafe', notes: null, updated_at: '2026-10-20', has_password: true },
    ])
    expect(JSON.stringify(res)).not.toContain('v1:a:b:c')
    expect(calls[0].filters).toContainEqual(['client_id', 'c1'])
  })

  it('sin la tabla (migración 0092 pendiente) lo dice claro', async () => {
    result = { data: null, error: { message: 'Could not find the table', code: 'PGRST205' } as never }
    const res = await listClientCredentials('c1')
    expect(res.error).toMatch(/0092/)
  })

  it('sin permiso devuelve error y no consulta', async () => {
    requirePermission.mockRejectedValue(new Error('Acceso denegado'))
    const res = await listClientCredentials('c1')
    expect(res.error).toMatch(/Acceso denegado/)
    expect(calls).toHaveLength(0)
  })
})

describe('saveClientCredential', () => {
  it('crea con la contraseña cifrada, nunca en texto plano', async () => {
    result = { data: [{ id: 'k1' }], error: null }
    const res = await saveClientCredential({ clientId: 'c1', platform: 'instagram', username: ' @cafe ', password: 'S3creta!' })
    expect(requirePermission).toHaveBeenCalledWith('clients.credentials.edit')
    expect(res.ok).toBe(true)
    const insert = calls.find((c) => c.op === 'insert')!
    expect(insert.payload!.username).toBe('@cafe')
    expect(insert.payload!.client_id).toBe('c1')
    expect(String(insert.payload!.password_encrypted)).toMatch(/^v1:/)
    expect(JSON.stringify(insert.payload)).not.toContain('S3creta!')
  })

  it('al editar sin contraseña nueva conserva la guardada', async () => {
    result = { data: [{ id: 'k1' }], error: null }
    await saveClientCredential({ id: 'k1', clientId: 'c1', platform: 'facebook', username: 'cafe' })
    const update = calls.find((c) => c.op === 'update')!
    expect(update.payload).not.toHaveProperty('password_encrypted')
    expect(update.filters).toEqual(expect.arrayContaining([['id', 'k1'], ['client_id', 'c1']]))
  })

  it('si RLS no actualizó ninguna fila, no dice que guardó', async () => {
    result = { data: [], error: null }
    const res = await saveClientCredential({ id: 'k1', clientId: 'c1', platform: 'facebook', username: 'cafe' })
    expect(res.ok).toBeUndefined()
    expect(res.error).toBeTruthy()
  })

  it('valida red y usuario', async () => {
    expect((await saveClientCredential({ clientId: 'c1', platform: 'myspace' as never, username: 'x' })).error).toBeTruthy()
    expect((await saveClientCredential({ clientId: 'c1', platform: 'tiktok', username: '  ' })).error).toBeTruthy()
    expect(calls).toHaveLength(0)
  })

  it('sin llave configurada no guarda contraseñas', async () => {
    delete process.env.CLIENT_CREDENTIALS_KEY
    const res = await saveClientCredential({ clientId: 'c1', platform: 'tiktok', username: 'cafe', password: 'x' })
    expect(res.error).toMatch(/CLIENT_CREDENTIALS_KEY/)
    expect(calls).toHaveLength(0)
  })
})

describe('revealClientCredentialPassword', () => {
  it('exige permiso de lectura y descifra', async () => {
    result = { data: { password_encrypted: encryptSecret('Güira#1') }, error: null }
    const res = await revealClientCredentialPassword('k1')
    expect(requirePermission).toHaveBeenCalledWith('clients.credentials.read')
    expect(res.password).toBe('Güira#1')
  })

  it('sin permiso no lee nada', async () => {
    requirePermission.mockRejectedValue(new Error('Acceso denegado'))
    const res = await revealClientCredentialPassword('k1')
    expect(res.password).toBeUndefined()
    expect(calls).toHaveLength(0)
  })
})

describe('deleteClientCredential', () => {
  it('exige permiso de edición', async () => {
    result = { data: [{ id: 'k1' }], error: null }
    const res = await deleteClientCredential('k1')
    expect(requirePermission).toHaveBeenCalledWith('clients.credentials.edit')
    expect(res.ok).toBe(true)
    expect(calls[0].op).toBe('delete')
  })
})
