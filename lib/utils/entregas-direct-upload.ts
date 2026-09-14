import { isAllowedVideoUploadType } from '@/lib/utils/video-upload-guard'
import { primerRoundUploadContentType } from '@/lib/primer-round/studio'

/** Reels de Primer Round caben; no bufferizamos películas de 1 GB en Next. */
export const ENTREGAS_DIRECT_MAX_BYTES = 200 * 1024 * 1024

const IDEA_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isEntregasIdeaId(id: string): boolean {
  return IDEA_ID.test(id.trim())
}

export function slugifyEntregasFileName(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9.]+/g, '-')
    .toLowerCase()
  return slug.replace(/^-+|-+$/g, '') || 'video'
}

export function buildEntregasEditedKey(
  ideaId: string,
  fileName: string,
  now = Date.now(),
): string | null {
  if (!isEntregasIdeaId(ideaId)) return null
  return `entregas/${ideaId.trim()}/edited/${now}-${slugifyEntregasFileName(fileName)}`
}

export function assertEntregasDirectUpload(input: {
  ideaId?: string | null
  fileName?: string | null
  contentType?: string | null
  contentLength?: number | null
}): string | null {
  const ideaId = (input.ideaId ?? '').trim()
  const fileName = (input.fileName ?? '').trim()
  const contentType = primerRoundUploadContentType({
    fileName,
    contentType: input.contentType,
  })
  if (!isEntregasIdeaId(ideaId)) return 'Falta la idea'
  if (!fileName) return 'Falta el nombre del archivo'
  if (!isAllowedVideoUploadType(contentType)) {
    return 'Tipo de archivo no permitido. Solo se aceptan videos (mp4, mov, webm, etc.).'
  }
  const len = input.contentLength
  if (len != null && (Number.isNaN(len) || len < 1)) return 'Falta el archivo de video.'
  if (len != null && len > ENTREGAS_DIRECT_MAX_BYTES) {
    return 'El video pesa demasiado para subirlo por aquí (máx. 200 MB).'
  }
  return null
}

export function entregasDirectContentType(fileName: string, rawType: string | null | undefined): string {
  return primerRoundUploadContentType({ fileName, contentType: rawType })
}
