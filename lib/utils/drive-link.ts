/**
 * Google Drive share-link parsing. Pure and client-safe on purpose: the submit
 * form validates as the editor pastes, and the server action re-validates the
 * same way before writing. Was private to lib/actions/idea-videos.ts, which a
 * client component cannot import ('use server' exports must be server actions).
 */

/**
 * Accepts:
 *   - https://drive.google.com/file/d/<ID>/view?usp=sharing
 *   - https://drive.google.com/open?id=<ID>
 *   - https://drive.google.com/uc?id=<ID>&export=download
 *   - the bare 15+ char file ID
 */
export function parseDriveFileId(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  // file/d/<id>/
  const m1 = trimmed.match(/\/file\/d\/([A-Za-z0-9_-]{15,})/)
  if (m1) return m1[1]
  // ?id=<id>
  const m2 = trimmed.match(/[?&]id=([A-Za-z0-9_-]{15,})/)
  if (m2) return m2[1]
  // Bare ID (no slashes, plausible length)
  if (/^[A-Za-z0-9_-]{15,}$/.test(trimmed) && !trimmed.includes('/')) return trimmed
  return null
}

export function driveViewLink(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`
}

export function driveThumbUrl(fileId: string): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`
}

export interface DriveLinkFeedback {
  state: 'empty' | 'valid' | 'invalid'
  message: string | null
  fileId?: string
}

/** Inline feedback for the paste box — say what's wrong, not just that it is. */
export function describeDriveLink(raw: string): DriveLinkFeedback {
  if (!raw.trim()) return { state: 'empty', message: null }
  const fileId = parseDriveFileId(raw)
  if (fileId) return { state: 'valid', message: 'Link de Drive válido', fileId }
  return {
    state: 'invalid',
    message: 'No parece un link de Google Drive. Pega el link completo del archivo (Compartir → Copiar vínculo).',
  }
}
