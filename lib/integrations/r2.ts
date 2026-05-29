import 'server-only'
import { S3Client } from '@aws-sdk/client-s3'

/**
 * Cloudflare R2 — S3-compatible client.
 * Used server-side only to mint presigned URLs; the browser uploads/downloads
 * directly to/from R2 so our server never touches the video bytes.
 */

export function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucket = process.env.R2_BUCKET || 'nmedia-videos'
  if (!accountId || !accessKeyId || !secretAccessKey) return null
  return { accountId, accessKeyId, secretAccessKey, bucket }
}

export function isR2Configured(): boolean {
  return getR2Config() !== null
}

let _client: S3Client | null = null

export function r2Client(): S3Client | null {
  const cfg = getR2Config()
  if (!cfg) return null
  if (_client) return _client
  _client = new S3Client({
    region: 'auto',
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
  })
  return _client
}

export function r2Bucket(): string {
  return getR2Config()?.bucket ?? 'nmedia-videos'
}

/**
 * Public, non-expiring base URL for the bucket — only set when public access
 * is enabled in Cloudflare (a connected custom domain, or the managed
 * `https://pub-<hash>.r2.dev` domain). No trailing slash.
 *
 * Presigned GET URLs expire (1h) and are rejected by consumers that need a
 * permanent link (e.g. Metricool's media normalize step). When this is
 * configured, `r2PublicUrl(key)` yields such a permanent link.
 */
export function r2PublicBaseUrl(): string | null {
  const base = process.env.R2_PUBLIC_BASE_URL?.trim()
  return base ? base.replace(/\/+$/, '') : null
}

/** Permanent public URL for an object key, or null if public access isn't configured. */
export function r2PublicUrl(key: string): string | null {
  const base = r2PublicBaseUrl()
  if (!base || !key) return null
  return `${base}/${key.replace(/^\/+/, '')}`
}
