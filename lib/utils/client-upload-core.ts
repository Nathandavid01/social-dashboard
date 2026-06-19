/**
 * Pure helpers for the client-facing upload flow (the magic-link page where a
 * client uploads raw footage and picks what content they want). No Supabase / R2
 * here so it's unit-testable — the API routes call buildIdeaInsert to create the
 * content_ideas row that lands on the team's pipeline.
 */

export type ContentFormat = 'R' | 'P'

export const CONTENT_FORMATS: { value: ContentFormat; label: string; hint: string }[] = [
  { value: 'R', label: 'Reel', hint: 'Video vertical (Reels / TikTok)' },
  { value: 'P', label: 'Post', hint: 'Publicación en el feed' },
]

export const CONTENT_THEMES: { value: string; label: string }[] = [
  { value: 'promocion', label: 'Promoción u oferta' },
  { value: 'testimonio', label: 'Testimonio de cliente' },
  { value: 'detras', label: 'Detrás de cámara' },
  { value: 'educativo', label: 'Educativo / Tips' },
  { value: 'producto', label: 'Producto o servicio' },
  { value: 'evento', label: 'Evento' },
  { value: 'otro', label: 'Otro' },
]

/** Max upload size — matches the team uploader (R2 single PUT). */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024 // 5 GB

export interface ClientUploadForm {
  format: string
  theme: string
  brief: string
  /** Desired publish date as "YYYY-MM-DD", or '' for none. */
  desiredDate: string
}

export function isValidFormat(f: string): f is ContentFormat {
  return f === 'R' || f === 'P'
}

export function isValidTheme(t: string): boolean {
  return CONTENT_THEMES.some((x) => x.value === t)
}

export function themeLabel(t: string): string {
  return CONTENT_THEMES.find((x) => x.value === t)?.label ?? t
}

export function formatLabel(f: string): string {
  return CONTENT_FORMATS.find((x) => x.value === f)?.label ?? f
}

/** Upper bound on the free-text brief, enforced client- and server-side. */
export const MAX_BRIEF_LENGTH = 2000

/** Validate the client's selections before we touch the network. */
export function validateClientUpload(form: ClientUploadForm): { ok: boolean; error?: string } {
  if (!isValidFormat(form.format)) return { ok: false, error: 'Escoge un formato (Reel o Post).' }
  if (!isValidTheme(form.theme)) return { ok: false, error: 'Escoge el tipo de contenido.' }
  if (form.desiredDate && !/^\d{4}-\d{2}-\d{2}$/.test(form.desiredDate)) {
    return { ok: false, error: 'La fecha deseada no es válida.' }
  }
  if (form.brief.length > MAX_BRIEF_LENGTH) {
    return { ok: false, error: 'El mensaje es demasiado largo.' }
  }
  return { ok: true }
}

export interface IdeaInsert {
  client_id: string
  content_type: ContentFormat
  title: string
  theme: string
  visual_brief: string | null
  generation_prompt: string | null
  deadline: string | null
  status: 'idea'
}

/**
 * Build the content_ideas row for a client submission. Title is prefixed so the
 * team instantly sees it came from the client; the brief lands in visual_brief
 * (the editor-facing field) and the desired date in deadline.
 */
export function buildIdeaInsert(clientId: string, form: ClientUploadForm): IdeaInsert {
  const brief = form.brief.trim()
  return {
    client_id: clientId,
    content_type: form.format as ContentFormat,
    title: `Material del cliente · ${themeLabel(form.theme)}`,
    theme: form.theme,
    visual_brief: brief || null,
    generation_prompt: brief || null,
    deadline: form.desiredDate || null,
    status: 'idea',
  }
}
