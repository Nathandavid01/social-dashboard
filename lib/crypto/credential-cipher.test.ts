import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { randomBytes } from 'node:crypto'
import { encryptSecret, decryptSecret, credentialKeyConfigured } from './credential-cipher'

const KEY = randomBytes(32).toString('base64')
let saved: string | undefined

beforeEach(() => {
  saved = process.env.CLIENT_CREDENTIALS_KEY
  process.env.CLIENT_CREDENTIALS_KEY = KEY
})
afterEach(() => {
  if (saved === undefined) delete process.env.CLIENT_CREDENTIALS_KEY
  else process.env.CLIENT_CREDENTIALS_KEY = saved
})

describe('credential-cipher', () => {
  it('cifra y descifra (incluye acentos y emojis)', () => {
    const plain = 'Güira#2026 🔐'
    const sealed = encryptSecret(plain)
    expect(sealed).not.toContain(plain)
    expect(sealed.startsWith('v1:')).toBe(true)
    expect(decryptSecret(sealed)).toBe(plain)
  })

  it('usa un IV distinto en cada cifrado', () => {
    expect(encryptSecret('misma')).not.toBe(encryptSecret('misma'))
  })

  it('rechaza un texto cifrado alterado', () => {
    const sealed = encryptSecret('secreto')
    const parts = sealed.split(':')
    const ct = Buffer.from(parts[3], 'base64')
    ct[0] ^= 0xff
    parts[3] = ct.toString('base64')
    expect(() => decryptSecret(parts.join(':'))).toThrow()
  })

  it('no descifra con otra llave', () => {
    const sealed = encryptSecret('secreto')
    process.env.CLIENT_CREDENTIALS_KEY = randomBytes(32).toString('base64')
    expect(() => decryptSecret(sealed)).toThrow()
  })

  it('sin llave válida no cifra y lo reporta', () => {
    delete process.env.CLIENT_CREDENTIALS_KEY
    expect(credentialKeyConfigured()).toBe(false)
    expect(() => encryptSecret('x')).toThrow(/CLIENT_CREDENTIALS_KEY/)
    process.env.CLIENT_CREDENTIALS_KEY = 'corta'
    expect(credentialKeyConfigured()).toBe(false)
  })
})
