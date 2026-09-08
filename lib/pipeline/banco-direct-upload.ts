import type { ContentIdeaStatus, IdeaApprovalStatus } from '@/lib/supabase/types'
import { isAllowedVideoUploadType } from '@/lib/utils/video-upload-guard'
import { isIdeaApproved } from './editor-video-bank'

export type BancoUploadKind = 'raw' | 'broll'
export type BancoUploadMode = 'new' | 'existing'

export interface BancoUploadFile {
  name: string
  type: string
  size: number
}

export interface BancoDirectUploadDraft {
  clientId: string
  mode: BancoUploadMode
  ideaId?: string | null
  title?: string | null
  kind: BancoUploadKind
  files: BancoUploadFile[]
}

export interface AttachableBankIdea {
  id: string
  title: string
  clientId: string
  status: ContentIdeaStatus
  approval_status?: IdeaApprovalStatus | null
  published_at?: string | null
  theme?: string | null
}

/** Idea sentinela: el B-roll del cliente vive aquí y no sale al aprobar un video. */
export const CLIENT_BROLL_THEME = 'client-broll-library'

export function isClientBrollLibrary(idea: { theme?: string | null }): boolean {
  return idea.theme === CLIENT_BROLL_THEME
}

export function clientBrollLibraryTitle(clientName: string): string {
  const name = clientName.trim() || 'cliente'
  return `B-roll de ${name}`
}

/** Título de la idea: lo escrito, o el primer archivo sin extensión. */
export function ideaTitleFromUpload(
  title: string | null | undefined,
  files: Array<{ name: string }>,
): string {
  const written = (title ?? '').trim()
  if (written) return written
  const first = files[0]?.name ?? ''
  return first.replace(/\.[A-Za-z0-9]{1,8}$/, '').trim()
}

export function validateBancoDirectUpload(draft: BancoDirectUploadDraft): string | null {
  if (!draft.clientId.trim()) return 'Elige un cliente'
  if (draft.files.length === 0) return 'Elige al menos un video'
  if (draft.files.some((f) => !isAllowedVideoUploadType(f.type))) {
    return 'Solo se aceptan videos (mp4, mov, webm…)'
  }
  if (draft.kind === 'broll') return null
  if (draft.mode === 'existing' && !draft.ideaId) return 'Elige una idea'
  if (draft.mode === 'new' && !ideaTitleFromUpload(draft.title, draft.files)) {
    return 'Ponle un título a la idea'
  }
  return null
}

/** Ideas a las que se puede pegar un crudo desde Banco: vivas, del cliente, no salidas del banco. */
export function attachableBankIdeas(
  ideas: AttachableBankIdea[],
  clientId: string,
): AttachableBankIdea[] {
  if (!clientId) return []
  return ideas.filter((idea) => {
    if (idea.clientId !== clientId) return false
    if (idea.status === 'descartada') return false
    if (isClientBrollLibrary(idea)) return false
    return !isIdeaApproved({
      approval_status: idea.approval_status ?? 'pending',
      status: idea.status,
      published_at: idea.published_at ?? null,
    })
  })
}
