export interface EditableCalendarPost extends Record<string, unknown> {
  id: number
  uuid: string
  text: string
  draft: boolean
  providers: { network: string; status?: string }[]
  publicationDate: { dateTime: string; timezone: string }
}
export function buildCalendarStateUpdate(post: EditableCalendarPost, action: 'draft' | 'schedule', dateTime?: string, now = new Date()): Record<string, unknown> {
  if (!post.providers?.length) throw new Error('Verifica las redes de la publicación antes de modificarla.')
  if (post.providers.some(p => p.status === 'PUBLISHED')) throw new Error('Una publicación que ya salió no puede volver a borrador ni reprogramarse.')
  if (!post.draft && post.providers.some(p => !['PENDING', 'ERROR'].includes(p.status ?? ''))) throw new Error('Metricool no confirma que este post se pueda modificar; puede estar publicándose.')
  if (action === 'draft') return { ...post, draft: true, autoPublish: false }
  if (!dateTime || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateTime)) throw new Error('Elige una fecha y hora válidas.')
  const utc = new Date(`${dateTime}:00Z`)
  if (!Number.isFinite(utc.getTime()) || utc.toISOString().slice(0, 16) !== dateTime) throw new Error('La fecha y hora no son válidas.')
  const instant = new Date(`${dateTime}:00-04:00`)
  if (instant <= now) throw new Error('La fecha y hora deben estar en el futuro.')
  return { ...post, draft: false, autoPublish: true, publicationDate: { dateTime: `${dateTime}:00`, timezone: 'America/Puerto_Rico' } }
}
