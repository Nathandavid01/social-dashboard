/**
 * Red de seguridad del QC IA: si el editor cerró el tab antes de mandar los
 * frames, la fila queda pending (o ni existe). Pasados 30 min ya no van a
 * llegar — el cron los marca 'error' para que el reporte no diga "Analizando…"
 * para siempre. No hay reintento server-side: sin el File local no hay frames.
 */

const STALE_MS = 30 * 60 * 1000

export function staleAnalysisCandidates(
  videos: { id: string; idea_id: string; uploaded_at: string }[],
  analyses: { video_id: string; status: string; updated_at: string }[],
  now: Date,
): { videoId: string; ideaId: string }[] {
  const byVideo = new Map(analyses.map((a) => [a.video_id, a]))
  const isOld = (iso: string) => now.getTime() - new Date(iso).getTime() > STALE_MS
  return videos
    .filter((v) => {
      if (!isOld(v.uploaded_at)) return false
      const row = byVideo.get(v.id)
      if (!row) return true
      return row.status === 'pending' && isOld(row.updated_at)
    })
    .map((v) => ({ videoId: v.id, ideaId: v.idea_id }))
}
