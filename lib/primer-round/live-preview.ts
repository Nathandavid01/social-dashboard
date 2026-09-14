/**
 * The file Eric just picked. Survives a remount after a server action
 * so the player does not fall back to last night's promo.
 */
export type PrimerRoundLivePreview = {
  file: File
  url: string
}

let live: PrimerRoundLivePreview | null = null

export function getPrimerRoundLivePreview(): PrimerRoundLivePreview | null {
  return live
}

export function setPrimerRoundLivePreview(file: File): PrimerRoundLivePreview {
  if (live?.url && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(live.url)
  live = { file, url: URL.createObjectURL(file) }
  return live
}

export function clearPrimerRoundLivePreview(): void {
  if (live?.url && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(live.url)
  live = null
}

export function livePreviewKey(preview: PrimerRoundLivePreview | null): string {
  if (!preview) return 'empty'
  return `${preview.file.name}-${preview.file.size}-${preview.file.lastModified}`
}
