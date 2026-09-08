import type { ScheduledPost } from './scheduler'
import { isScheduledPostPublished } from '@/lib/utils/metricool-sync-core'

const TIMEZONE = 'America/Puerto_Rico'

/** Read-only chat evidence. A scheduled time is never proof of publication. */
export async function getTodayBriefing(
  clients: Array<{ name: string; metricool_blog_id: string | number | null }>,
  fetchPosts: (blogId: string, start: string, end: string) => Promise<ScheduledPost[]>,
  now = new Date(),
): Promise<string> {
  const day = new Intl.DateTimeFormat('sv-SE', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  const results = await Promise.allSettled(clients.map(async client => {
    if (client.metricool_blog_id == null) throw Error('Missing blog')
    const posts = await fetchPosts(String(client.metricool_blog_id), `${day}T00:00:00`, `${day}T23:59:59`)
    return posts.map(post => ({ client: client.name, post }))
  }))
  const failed = results.filter(result => result.status === 'rejected').length
  const posts = results.flatMap(result => result.status === 'fulfilled' ? result.value : [])
  const lines = [
    `Agenda ${day} · ${TIMEZONE}. Consultada: ${now.toLocaleString('es-PR', { timeZone: TIMEZONE })}.`,
    'Una fecha pasada no confirma publicación. No marques como atrasado un post cuya hora aún no ha llegado; los estados pendientes requieren verificación, no prueban un fallo.',
  ]
  if (failed) lines.push(`Consulta Incompleta: no se pudieron consultar ${failed} de ${clients.length} clientes. No inferir ausencia de publicaciones en esas cuentas.`)
  if (!posts.length && !failed) lines.push('Sin publicaciones devueltas por Metricool para los clientes consultados hoy.')
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
