import 'server-only'
import { S3Client } from '@aws-sdk/client-s3'

/**
 * R2 for Entregas — its own account, bucket and public domain, separate from
 * the original pipeline's.
 *
 * Same shape as lib/integrations/r2.ts on purpose, but reading ENTREGAS_R2_*.
 * Sharing one config would mean one board's credentials silently deciding where
 * the other board's videos live.
 */

export const ENTREGAS_PROVIDER = 'entregas-r2' as const

export function getEntregasR2Config() {
  const accountId = process.env.ENTREGAS_R2_ACCOUNT_ID
  const accessKeyId = process.env.ENTREGAS_R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.ENTREGAS_R2_SECRET_ACCESS_KEY
  const bucket = process.env.ENTREGAS_R2_BUCKET
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null
  return { accountId, accessKeyId, secretAccessKey, bucket }
}

export function isEntregasR2Configured(): boolean {
  return getEntregasR2Config() !== null
}

let _client: S3Client | null = null

export function entregasR2Client(): S3Client | null {
  const cfg = getEntregasR2Config()
  if (!cfg) return null
  if (!_client) {
    _client = new S3Client({
      region: 'auto',
      endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    })
  }
  return _client
}

export function entregasR2Bucket(): string {
  return getEntregasR2Config()?.bucket ?? ''
}

/** Permanent public URL — what Metricool fetches. Null if not configured. */
export function entregasR2PublicUrl(key: string): string | null {
  const base = process.env.ENTREGAS_R2_PUBLIC_BASE_URL?.trim()
  if (!base) return null
  return `${base.replace(/\/+$/, '')}/${key}`
}
