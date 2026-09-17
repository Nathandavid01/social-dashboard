/**
 * Metricool DRAFT gate for /estudio.
 * Unlike ideaPostReadiness this does NOT require approval or review_verified:
 * editors push a draft; live publish stays a human step (Eric).
 */

export interface EditorStudioDraftIdea {
  status: string | null
  published_at?: string | null
  metricool_post_id?: number | null
  posted_at?: string | null
  caption?: string | null
}

export interface EditorStudioDraftReadiness {
  ready: boolean
  reason?: string
}

export function editorStudioDraftReadiness(
  idea: EditorStudioDraftIdea,
  hasEditedVideo: boolean,
  metricoolBlogId: string | null | undefined,
): EditorStudioDraftReadiness {
  if (idea.metricool_post_id != null) {
    return { ready: false, reason: 'Ya hay un post en Metricool para esta pieza' }
  }
  if (idea.posted_at) {
    return { ready: false, reason: 'Ya hay un post en Metricool para esta pieza' }
  }
  if (idea.published_at || idea.status === 'publicada') {
    return { ready: false, reason: 'El video ya está publicado' }
  }
  if (idea.status === 'descartada') {
    return { ready: false, reason: 'El video está descartado' }
  }
  if (!idea.caption?.trim()) {
    return { ready: false, reason: 'Falta el caption' }
  }
  if (!hasEditedVideo) {
    return { ready: false, reason: 'Falta el video editado' }
  }
  if (!metricoolBlogId?.trim()) {
    return { ready: false, reason: 'El cliente no tiene Metricool configurado (falta blog_id)' }
  }
  return { ready: true }
}

export function pickStudioCaption(
  generatedCaption?: string | null,
  captionDraft?: string | null,
  override?: string | null,
): string {
  const over = (override ?? '').trim()
  if (over) return over
  return ((generatedCaption ?? captionDraft) ?? '').trim()
}
