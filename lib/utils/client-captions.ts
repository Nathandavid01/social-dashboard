import type { SavedCaption } from '@/components/captions/saved-captions-view'

const PLATFORM_LABEL: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  twitter: 'Twitter/X',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  pinterest: 'Pinterest',
  threads: 'Threads',
}

interface MetricoolPostsResponse {
  data?: {
    id: number
    uuid: string
    text: string
    publicationDate?: { dateTime: string }
    providers?: { network: string }[]
    draft?: boolean
  }[]
}

export type CaptionsResult =
  | { ok: true; captions: SavedCaption[] }
  | { ok: false; error: string }

/** Published captions for a client, pulled from Metricool (last 90 days). */
export async function fetchClientCaptions(blogId: string, clientName: string): Promise<CaptionsResult> {
  const token = process.env.METRICOOL_TOKEN
  const userId = process.env.METRICOOL_USER_ID
  if (!token || !userId) {
    return { ok: false, error: 'Metricool credentials no están configuradas en el servidor' }
  }

  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 90)
  const startStr = start.toISOString().slice(0, 19)
  const endStr = end.toISOString().slice(0, 19)

  const url = `https://app.metricool.com/api/v2/scheduler/posts?userId=${userId}&blogId=${blogId}&start=${startStr}&end=${endStr}`
  try {
    const res = await fetch(url, { headers: { 'X-Mc-Auth': token }, next: { revalidate: 60 } })
    if (!res.ok) {
      return { ok: false, error: `Metricool respondió ${res.status} — verifica que el blog ID exista` }
    }
    const json = (await res.json()) as MetricoolPostsResponse
    const captions = (json.data ?? [])
      .filter((p) => !p.draft && p.text)
      .map((p) => ({
        id: p.uuid || p.id,
        client: clientName,
        platform:
          (p.providers ?? [])
            .map((x) => PLATFORM_LABEL[x.network?.toLowerCase()] ?? x.network)
            .join(', ') || '—',
        date: p.publicationDate?.dateTime?.replace('T', ' ') ?? '',
        caption: p.text,
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
    return { ok: true, captions }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return { ok: false, error: `No se pudo contactar a Metricool: ${message}` }
  }
}
