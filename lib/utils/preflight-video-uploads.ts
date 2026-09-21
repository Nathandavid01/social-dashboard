import type { DuplicateVideo } from '@/lib/actions/video-dedupe'

export interface PreflightVideoUploadDeps {
  fingerprint?: (file: File) => Promise<string>
  findDuplicate?: (fingerprint: string) => Promise<DuplicateVideo | null>
}

export interface BlockedVideoUpload {
  file: File
  duplicate: DuplicateVideo
}

/**
 * Antes de crear idea o sesión: qué archivos son nuevos y cuáles ya estaban.
 * Un fallo de huella/consulta deja el archivo en `fresh` — nunca bloquea
 * una subida legítima.
 */
export async function preflightVideoUploads(
  files: File[],
  deps: PreflightVideoUploadDeps = {},
): Promise<{ fresh: File[]; blocked: BlockedVideoUpload[] }> {
  const fresh: File[] = []
  const blocked: BlockedVideoUpload[] = []
  for (const file of files) {
    try {
      if (!deps.fingerprint || !deps.findDuplicate) {
        fresh.push(file)
        continue
      }
      const fingerprint = await deps.fingerprint(file)
      const duplicate = await deps.findDuplicate(fingerprint)
      if (duplicate) blocked.push({ file, duplicate })
      else fresh.push(file)
    } catch {
      fresh.push(file)
    }
  }
  return { fresh, blocked }
}
