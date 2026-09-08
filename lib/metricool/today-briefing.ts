import type { ScheduledPost } from './scheduler'
import { isScheduledPostPublished } from '@/lib/utils/metricool-sync-core'

const TIMEZONE = 'America/Puerto_Rico'

function puertoRicoDay(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

/** Metricool sends either an absolute ISO timestamp or wall time + IANA zone. */
function publicationDay(value: ScheduledPost['publicationDate']): string | null {
  const raw = value?.dateTime
  if (!raw) return null
  try {
    if (/(Z|[+-]\d{2}:?\d{2})$/i.test(raw)) {
      const instant = new Date(raw)
      return Number.isFinite(instant.getTime()) ? puertoRicoDay(instant) : null
    }
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(raw)
    if (!match) return null
    const parts = match.slice(1).map(part => Number(part || 0))
    const wall = Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5])
    const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: value.timezone || TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    const localEpoch = (instant: number) => {
      const p = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(part => [part.type, part.value]))
      return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second))
    }
    // Resolve the zone offset without depending on the server's own timezone.
    let instant = wall
    for (let n = 0; n < 4; n++) {
      const difference = wall - localEpoch(instant)
      if (!difference) break
      instant += difference
    }
    // Reject impossible wall times (e.g. a daylight-saving gap).
    if (localEpoch(instant) !== wall || new Date(wall).toISOString().slice(0, 16) !== raw.slice(0, 16)) return null
    return puertoRicoDay(new Date(instant))
  } catch { return null }
}

/** Read-only chat evidence. A scheduled time is never proof of publication. */
export async function getTodayBriefing(
  clients: Array<{ name: string; metricool_blog_id: string | number | null }>,
  fetchPosts: (blogId: string, start: string, end: string) => Promise<ScheduledPost[]>,
  now = new Date(),
): Promise<string> {
  const day = puertoRicoDay(now)
  const results = await Promise.allSettled(clients.map(async client => {
    if (client.metricool_blog_id == null) throw Error('Missing blog')
    const posts = await fetchPosts(String(client.metricool_blog_id), `${day}T00:00:00`, `${day}T23:59:59`)
    return posts.map(post => ({ client: client.name, post }))
  }))
  const failed = results.filter(result => result.status === 'rejected').length
  const received = results.flatMap(result => result.status === 'fulfilled' ? result.value : [])
  const unknownDates = received.filter(({ post }) => publicationDay(post.publicationDate) === null).length
  const posts = received.filter(({ post }) => publicationDay(post.publicationDate) === day)
  const lines = [
    `Agenda ${day} · ${TIMEZONE}. Consultada: ${now.toLocaleString('es-PR', { timeZone: TIMEZONE })}.`,
    'Una fecha pasada no confirma publicación. No marques como atrasado un post cuya hora aún no ha llegado; los estados pendientes requieren verificación, no prueban un fallo.',
  ]
  if (failed) lines.push(`Consulta Incompleta: no se pudieron consultar ${failed} de ${clients.length} clientes. No inferir ausencia de publicaciones en esas cuentas.`)
  if (unknownDates) lines.push(`Fecha Sin Verificar: ${unknownDates} publicaciones no se pudieron ubicar en un día. No se incluyen en el resumen de hoy; verifica sus fechas en Metricool.`)
  if (!posts.length && !failed && !unknownDates) lines.push('Sin publicaciones devueltas por Metricool para los clientes consultados hoy.')
  for (const { client, post } of posts) {
    const providers = post.providers ?? []
    const status = post.draft ? 'Borrador'
      : isScheduledPostPublished(post) ? 'Publicado Confirmado'
      : providers.some(provider => provider.status === 'ERROR') ? 'Error En Una O Más Redes'
      : 'Programado / Publicación Sin Confirmar'
    const providerDetails = providers.map(provider => `${provider.network}: ${provider.status || 'DESCONOCIDO'}`).join(', ') || 'Sin estado de redes'
    lines.push(`• ${client} — ${status} — ${post.publicationDate?.dateTime || 'Sin fecha'} (${post.publicationDate?.timezone || TIMEZONE})\n  ${providerDetails}\n  ${post.text?.trim().slice(0, 100) || 'Sin texto'}`)
  }
  return lines.join('\n\n')
}
