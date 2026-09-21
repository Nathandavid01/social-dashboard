export type VideoLinkKind = 'linked' | 'extra'

export function classifyVideoLink(input: {
  hasRecordingSession: boolean
  isBrollLibrary?: boolean
}): VideoLinkKind {
  if (input.isBrollLibrary || !input.hasRecordingSession) return 'extra'
  return 'linked'
}

export function videoLinkLabel(kind: VideoLinkKind): 'De la idea' | 'Extra' {
  return kind === 'linked' ? 'De la idea' : 'Extra'
}

/** True when the idea row already has editing_started_* (migración 0088). */
export function hasEditingClaimColumns(row: object | null | undefined): boolean {
  if (!row || typeof row !== 'object') return false
  return Object.prototype.hasOwnProperty.call(row, 'editing_started_at')
    || Object.prototype.hasOwnProperty.call(row, 'editing_started_by')
}
