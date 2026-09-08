import type { OverviewItem } from './operations-overview'
import type { OperationalPublicationReport } from './operational-publications'

/** A verified external post can fulfill an unlinked daily commitment, but
 * cannot approve or publish a different internal video by association. */
export function reconcileTodayChecklist(items: OverviewItem[], day: string, report: OperationalPublicationReport | null): OverviewItem[] {
  if (!report || report.today !== day) return items
  return items.map(item => {
    if (!item.missing) return item
    const client = report.clients.find(client => item.id === `missing-${client.id}`)
    const today = client?.days.find(entry => entry.date === day)
    if (!client || client.error || !today?.covered || today.published < 1) return item
    return { ...item, done: true, missing: false, title: 'Publicación De Hoy Confirmada En Metricool', state: 'Publicado En Metricool · Sin Pieza Vinculada', checks: [{label:'Publicado',done:true}] }
  })
}
