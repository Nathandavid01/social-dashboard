import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/**
 * Cifrado de contraseñas de redes de clientes (AES-256-GCM).
 *
 * La llave vive solo en el servidor (`CLIENT_CREDENTIALS_KEY`, 32 bytes en
 * base64). La base guarda `v1:<iv>:<tag>:<ciphertext>`, así que un dump de la
 * tabla, o una lectura vía PostgREST, nunca expone la contraseña.
 * Generar: `openssl rand -base64 32`.
 */

const VERSION = 'v1'

function loadKey(): Buffer | null {
  const raw = process.env.CLIENT_CREDENTIALS_KEY
  if (!raw) return null
  const key = Buffer.from(raw, 'base64')
  return key.length === 32 ? key : null
}

export function credentialKeyConfigured(): boolean {
  return loadKey() !== null
}

function requireKey(): Buffer {
  const key = loadKey()
  if (!key) throw new Error('Falta CLIENT_CREDENTIALS_KEY (32 bytes en base64) en el servidor.')
  return key
}

export function encryptSecret(plain: string): string {
  const key = requireKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':')
}

export function decryptSecret(sealed: string): string {
  const key = requireKey()
  const [version, iv, tag, ct] = sealed.split(':')
  if (version !== VERSION || !iv || !tag || ct === undefined) throw new Error('Formato de contraseña cifrada no reconocido.')
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64')), decipher.final()]).toString('utf8')
}
