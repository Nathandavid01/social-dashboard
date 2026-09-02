import type { DuplicateVideo } from '@/lib/actions/video-dedupe'
import { duplicateVideoMessage } from './duplicate-video-message'

/**
 * The submit chain for one video: create the idea → presign → PUT the file to
 * R2 → register it. Order matters: getR2UploadUrl keys the object under the
 * idea id, so the row has to exist first.
 *
 * Dependencies are injected so the whole sequence — including every failure
 * point — is testable without network or Supabase.
 */

export interface SubmitDeps {
  /** Huella del archivo (lib/utils/video-fingerprint). Opcional: sin ella no se deduplica. */
  fingerprint?: (file: File) => Promise<string>
  /** ¿Ya se subió esta huella? Devuelve el video existente o null. */
  findDuplicate?: (fingerprint: string) => Promise<DuplicateVideo | null>
  createIdea: (input: {
    clientId: string
    title: string
    hook: string | null
    driveLink: string | null
    publishDate: string | null
  }) => Promise<{ idea?: { id: string }; error?: string }>
  getUploadUrl: (input: {
    ideaId: string
    kind: 'edited'
    fileName: string
    contentType: string
  }) => Promise<{ url?: string; key?: string; error?: string }>
  putFile: (url: string, file: File, onProgress: (pct: number) => void) => Promise<void>
  registerVideo: (input: {
    ideaId: string
    kind: 'edited'
    key: string
    name: string
    sizeBytes: number
    mimeType: string
    /** El File subido, para poder disparar el QC IA tras registrar. */
    file: File
    /** Huella calculada antes de subir, para anotarla junto al video. */
    fingerprint?: string
  }) => Promise<{ ok?: true; id?: string; error?: string }>
}

export interface SubmitInput {
  clientId: string
  title: string
  hook: string | null
  driveLink: string | null
  /** YYYY-MM-DD del día de entrega. */
  publishDate: string | null
  file: File
}

export type SubmitStage = 'comprobando' | 'duplicado' | 'creando' | 'subiendo' | 'registrando' | 'listo' | 'error'

export interface SubmitResult {
  ok: boolean
  ideaId?: string
  videoId?: string
  stage: SubmitStage
  error?: string
  /** Cuando stage === 'duplicado': el video que ya existe. */
  duplicateOf?: DuplicateVideo
}

/**
 * Run one video through the chain. Never throws — a failure comes back as
 * `{ ok: false, stage }` so the caller can show WHERE it broke and leave the
 * other videos of the batch alone.
 */
export async function submitOneVideo(
  deps: SubmitDeps,
  input: SubmitInput,
  onProgress: (stage: SubmitStage, pct: number) => void = () => {},
): Promise<SubmitResult> {
  // Antes de crear nada: si este archivo ya se subió, se para aquí y no queda
  // ni una idea huérfana. Un fallo de la comprobación nunca bloquea la subida.
  let fingerprint: string | undefined
  if (deps.fingerprint) {
    onProgress('comprobando', 0)
    try {
      fingerprint = await deps.fingerprint(input.file)
      const dup = deps.findDuplicate ? await deps.findDuplicate(fingerprint) : null
      if (dup) return { ok: false, stage: 'duplicado', error: duplicateVideoMessage(dup), duplicateOf: dup }
    } catch {
      fingerprint = undefined
    }
  }

  onProgress('creando', 0)
  let ideaId: string
  try {
    const created = await deps.createIdea({
      clientId: input.clientId,
      title: input.title,
      hook: input.hook,
      driveLink: input.driveLink,
      publishDate: input.publishDate,
    })
    if (created.error || !created.idea?.id) {
      return { ok: false, stage: 'creando', error: created.error ?? 'No se pudo crear el video' }
    }
    ideaId = created.idea.id
  } catch (err) {
    return { ok: false, stage: 'creando', error: msg(err) }
  }

  let key: string
  try {
    const slot = await deps.getUploadUrl({
      ideaId,
      kind: 'edited',
      fileName: input.file.name,
      contentType: input.file.type || 'video/mp4',
    })
    if (slot.error || !slot.url || !slot.key) {
      return { ok: false, ideaId, stage: 'subiendo', error: slot.error ?? 'No se pudo preparar la subida' }
    }
    key = slot.key
    onProgress('subiendo', 0)
    await deps.putFile(slot.url, input.file, (pct) => onProgress('subiendo', pct))
  } catch (err) {
    // The idea row stays behind on purpose: the editor sees the card and can
    // retry the upload instead of re-typing everything.
    return { ok: false, ideaId, stage: 'subiendo', error: msg(err) }
  }

  try {
    onProgress('registrando', 100)
    const reg = await deps.registerVideo({
      ideaId,
      kind: 'edited',
      key,
      name: input.file.name,
      sizeBytes: input.file.size,
      mimeType: input.file.type || 'video/mp4',
      file: input.file,
      fingerprint,
    })
    if (reg.error) return { ok: false, ideaId, stage: 'registrando', error: reg.error }
    onProgress('listo', 100)
    return { ok: true, ideaId, videoId: reg.id, stage: 'listo' }
  } catch (err) {
    return { ok: false, ideaId, stage: 'registrando', error: msg(err) }
  }
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : 'Error inesperado'
}
