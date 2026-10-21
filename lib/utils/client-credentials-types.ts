/** Tipos compartidos (cliente y servidor) de los accesos de redes del cliente. */

export const CREDENTIAL_PLATFORMS = [
  'instagram',
  'facebook',
  'tiktok',
  'youtube',
  'linkedin',
  'x',
  'google',
  'otra',
] as const

export type CredentialPlatform = (typeof CREDENTIAL_PLATFORMS)[number]

export const CREDENTIAL_PLATFORM_LABEL: Record<CredentialPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  x: 'X (Twitter)',
  google: 'Google Business',
  otra: 'Otra',
}

export function isCredentialPlatform(v: unknown): v is CredentialPlatform {
  return typeof v === 'string' && (CREDENTIAL_PLATFORMS as readonly string[]).includes(v)
}

/** Lo que llega al navegador: nunca la contraseña, solo si hay una guardada. */
export interface ClientCredentialSummary {
  id: string
  platform: CredentialPlatform
  username: string
  notes: string | null
  updated_at: string
  has_password: boolean
}
