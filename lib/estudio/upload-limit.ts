/**
 * Product cap for /estudio: 500 MB on the Entregas presign / multipart path.
 *
 * Platform caps this screen does NOT try to exceed:
 *   - Vercel serverless request body ≈ 4.5 MB (this flow never PUTs bytes through Next)
 *   - Same-origin /api/entregas-upload buffers in the function → 200 MB (not used here)
 *   - R2 single presigned PUT ≈ 5 GB; multipart (8 MB parts) is the large-file path
 */

export const EDITOR_STUDIO_MAX_BYTES = 500 * 1024 * 1024

export const EDITOR_STUDIO_UPLOAD_LIMITS = {
  productMaxBytes: EDITOR_STUDIO_MAX_BYTES,
  productLabel: '500 MB',
  path: 'PUT presignado / multipart directo a R2 Entregas (el archivo no pasa por Vercel)',
  vercelBody: '~4.5 MB — body de la función Next/Vercel; no se usa en /estudio',
  sameOriginProxy: '200 MB en /api/entregas-upload (bufferiza el video en la función)',
  r2SinglePut: 'hasta ~5 GB por un PUT presignado',
  r2Multipart: 'partes de 8 MB en paralelo; tope práctico del producto: 500 MB',
} as const

export function formatEditorStudioBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0 B'
  if (n >= 1024 * 1024 * 1024) {
    const gb = n / (1024 * 1024 * 1024)
    return Number.isInteger(gb) ? `${gb} GB` : `${gb.toFixed(1)} GB`
  }
  if (n >= 1024 * 1024) {
    const mb = n / (1024 * 1024)
    return Number.isInteger(mb) ? `${mb} MB` : `${mb.toFixed(1)} MB`
  }
  if (n >= 1024) return `${Math.round(n / 1024)} KB`
  return `${Math.round(n)} B`
}

export function assertEditorStudioFileSize(bytes: number): string | null {
  if (!Number.isFinite(bytes) || bytes < 1) return 'Falta el archivo de video.'
  if (bytes > EDITOR_STUDIO_MAX_BYTES) {
    return `El video pesa demasiado (máx. ${formatEditorStudioBytes(EDITOR_STUDIO_MAX_BYTES)}).`
  }
  return null
}
