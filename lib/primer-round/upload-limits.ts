/**
 * Primer Round upload path: browser → R2 presign / multipart (`uploadEntregasFileFast`).
 * Bytes never go through Next/Vercel, so the ~4.5 MB serverless body cap does not apply.
 *
 * Hard platform caps still in play (document in the PR):
 * - Vercel serverless request body ~4.5 MB if a client PUTs through Next.
 *   `/api/entregas-upload` still buffers the file and is coded at
 *   `ENTREGAS_DIRECT_MAX_BYTES` (200 MB), but Vercel 413s first.
 * - Presigned PUT URLs expire in 1 hour (`getEntregasUploadUrl` / multipart parts).
 * - R2 max object is 5 TB; multipart here is 8 MB parts (10 000 × 8 MB ≫ 500 MB).
 * - Metricool fetches the public R2 URL; their ingest limit is not documented here.
 * - Grok vision analyzes frames extracted in the browser, not the 500 MB file.
 */

export const PRIMER_ROUND_UPLOAD_MAX_BYTES = 500 * 1024 * 1024

export function formatPrimerRoundUploadBytes(n: number): string {
  if (n >= 1024 ** 3) return `${Math.round((n / 1024 ** 3) * 10) / 10} GB`
  if (n >= 1024 ** 2) return `${Math.round(n / 1024 ** 2)} MB`
  if (n >= 1024) return `${Math.round(n / 1024)} KB`
  return `${n} B`
}

export function assertPrimerRoundUploadSize(sizeBytes: number | null | undefined): string | null {
  if (sizeBytes == null || Number.isNaN(sizeBytes) || sizeBytes < 1) {
    return 'Falta el archivo de video.'
  }
  if (sizeBytes > PRIMER_ROUND_UPLOAD_MAX_BYTES) {
    return `El video pesa demasiado (máx. ${formatPrimerRoundUploadBytes(PRIMER_ROUND_UPLOAD_MAX_BYTES)}).`
  }
  return null
}
