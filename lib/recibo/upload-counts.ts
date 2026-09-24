export type UploadSide = 'nathan' | 'eric' | 'otro'

export type CountedVideo = {
  id?: string
  kind: string
  storage_provider: string
  status: string
  drive_file_id?: string | null
  uploaded_at?: string | null
  uploaded_by?: string | null
  uploader?: { full_name?: string | null } | null
}

/** The cut Recibo plays: newest usable edited file in Entregas. */
export function currentEntregasEdit<T extends CountedVideo>(videos: T[] | null | undefined): T | null {
  const usable = (videos ?? []).filter(
    (video) =>
      video.kind === 'edited' &&
      video.storage_provider === 'entregas-r2' &&
      video.status !== 'failed' &&
      video.status !== 'archived' &&
      !!video.drive_file_id,
  )
  usable.sort((a, b) => (b.uploaded_at ?? '').localeCompare(a.uploaded_at ?? ''))
  return usable[0] ?? null
}

export function uploaderSide(name: string | null | undefined): UploadSide {
  const first = (name ?? '').trim().toLowerCase().split(/\s+/)[0] ?? ''
  if (first === 'nathan') return 'nathan'
  if (first === 'eric') return 'eric'
  return 'otro'
}

export function reciboUploadCounts(ideas: { videos?: CountedVideo[] | null }[]): {
  nathan: number
  eric: number
  otro: number
  total: number
} {
  const counts = { nathan: 0, eric: 0, otro: 0, total: 0 }
  for (const idea of ideas) {
    const video = currentEntregasEdit(idea.videos)
    if (!video) continue
    counts[uploaderSide(video.uploader?.full_name)] += 1
    counts.total += 1
  }
  return counts
}

export function uploaderLabel(side: UploadSide): string {
  if (side === 'nathan') return 'Subió Nathan'
  if (side === 'eric') return 'Subió Eric'
  return 'Sin autor'
}

export function formatUploadCounts(counts: { nathan: number; eric: number; otro: number; total: number }): string {
  return `Total ${counts.total} · Nathan ${counts.nathan} · Eric ${counts.eric} · Sin autor ${counts.otro}`
}

/** Eric's real accounts. Cuts he uploads enter Recibo whatever the client's edit_mode (board-ideas.ts). */
export const ERIC_IDS: ReadonlySet<string> = new Set([
  '2ec6c260-4ed5-4c4b-8f85-8b76353532cb', // Eric Perez
  'f27c2a4c-fda8-49d9-9a59-da9777556144', // Eric
])

/** Real accounts that may see who uploaded each Recibo cut. Not view-as. */
const RECIBO_COUNT_VIEWER_IDS = new Set([
  ...ERIC_IDS,
  'a16752e4-05d1-42e3-812c-28a1afb5752c', // Denisha Matos
  '165e5259-8f69-4ff4-b0f0-f790cba77b80', // Nathan Torres
])

const RECIBO_COUNT_VIEWER_NAMES = new Set(['eric', 'eric perez', 'denisha', 'denisha matos', 'nathan torres'])

export function canSeeReciboUploadCounts(viewer: { id?: string | null; fullName?: string | null } | null): boolean {
  if (!viewer) return false
  if (viewer.id && RECIBO_COUNT_VIEWER_IDS.has(viewer.id)) return true
  const name = (viewer.fullName ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLowerCase()
  return RECIBO_COUNT_VIEWER_NAMES.has(name)
}
