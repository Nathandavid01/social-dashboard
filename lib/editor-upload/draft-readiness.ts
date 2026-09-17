/**
 * A Metricool DRAFT is allowed without approval / live publish.
 * Idempotency still blocks a second post for the same idea.
 */

export type EditorDraftIdea = {
  caption: string | null | undefined
  hasVideo: boolean
  publicUrl: string | null | undefined
  blogId: string | null | undefined
  metricoolPostId: number | null | undefined
  postedAt: string | null | undefined
  status?: string | null
}

export type EditorDraftReadiness = { ready: true } | { ready: false; reason: string }

export function editorDraftReadiness(idea: EditorDraftIdea): EditorDraftReadiness {
  if (idea.metricoolPostId != null) {
    return { ready: false, reason: 'Ya hay un post en Metricool para este video' }
  }
  if (idea.postedAt) {
    return { ready: false, reason: 'Ya hay un post en Metricool para este video' }
  }
  if (idea.status === 'descartada') {
    return { ready: false, reason: 'El video está descartado' }
  }
  if (!idea.caption?.trim()) {
    return { ready: false, reason: 'Falta el caption' }
  }
  if (!idea.hasVideo) {
    return { ready: false, reason: 'Falta el video editado' }
  }
  if (!idea.publicUrl?.trim()) {
    return { ready: false, reason: 'No se pudo obtener la URL pública del video (¿falta ENTREGAS_R2_PUBLIC_BASE_URL?)' }
  }
  if (!idea.blogId?.trim()) {
    return { ready: false, reason: 'El cliente no tiene Metricool configurado (falta blog_id)' }
  }
  return { ready: true }
}
