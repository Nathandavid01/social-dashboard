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
