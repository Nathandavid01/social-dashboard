import type { ContentIdeaVideo, IdeaWithPipeline } from '@/lib/supabase/types'

/**
 * Calendario por cliente (sección Clientes del Banco): los videos crudos y
 * editados del cliente puestos en su fecha de subida, con los días de posteo
 * marcados para ver dónde caería lo aprobado.
 *
 * PURO — sin imports de servidor; lo consume el panel cliente de /banco.
 */

const LIVE = new Set<ContentIdeaVideo['status']>(['uploading', 'uploaded', 'processing'])
const KINDS = new Set<ContentIdeaVideo['kind']>(['raw', 'edited'])

export interface ClientCalendarVideo {
  videoId: string
  ideaId: string
  ideaTitle: string
  kind: 'raw' | 'edited'
  name: string
}

export interface ClientCalendarDay {
  /** YYYY-MM-DD local */
  date: string
  dayOfWeek: number
  isPostingDay: boolean
  videos: ClientCalendarVideo[]
}

function localISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function buildClientCalendar(
  ideas: IdeaWithPipeline[],
  clientId: string,
  opts: { from: Date; days?: number; postingDays?: number[] },
): ClientCalendarDay[] {
  const total = opts.days ?? 14
  const posting = new Set(opts.postingDays ?? [])

  const byDate = new Map<string, ClientCalendarVideo[]>()
  for (const idea of ideas) {
    if ((idea.client?.id ?? idea.client_id) !== clientId) continue
    if (idea.status === 'descartada') continue
    for (const v of idea.videos ?? []) {
      if (!KINDS.has(v.kind) || !LIVE.has(v.status) || !v.uploaded_at) continue
      const date = localISO(new Date(v.uploaded_at))
      const list = byDate.get(date) ?? []
      list.push({
        videoId: v.id,
        ideaId: idea.id,
        ideaTitle: idea.title?.trim() || idea.hook?.trim() || 'Sin título',
        kind: v.kind as 'raw' | 'edited',
        name: v.name?.trim() || 'video.mp4',
      })
      byDate.set(date, list)
    }
  }

  const days: ClientCalendarDay[] = []
  for (let i = 0; i < total; i++) {
    const d = new Date(opts.from.getFullYear(), opts.from.getMonth(), opts.from.getDate() + i)
    const date = localISO(d)
    days.push({
      date,
      dayOfWeek: d.getDay(),
      isPostingDay: posting.has(d.getDay()),
      videos: byDate.get(date) ?? [],
    })
  }
  return days
}
