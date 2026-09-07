export interface PublicationAuditPost {
  publicationDate: { dateTime: string }
  draft?: boolean
  autoPublish?: boolean
  providers?: { status?: string | null }[] | null
}
export function summarizePublicationWindow(posts: PublicationAuditPost[], start: string, end: string) {
  const result = { drafts: 0, scheduled: 0, failed: 0, manual: 0, published: 0 }
  for (const p of posts) {
    const date = p.publicationDate?.dateTime?.slice(0, 10)
    if (!date || date < start || date > end) continue
    const networks = p.providers ?? []
    if (p.draft) result.drafts++
    else if (networks.some(n => n.status === 'ERROR')) result.failed++
    else if (networks.length && networks.every(n => n.status === 'PUBLISHED')) result.published++
    else if (!p.autoPublish || !networks.length) result.manual++
    else result.scheduled++
  }
  return result
}
export interface PublicationAuditRow {
  id: string
  name: string
  planned: number
  drafts: number
  scheduled: number
  failed: number
  manual: number
  published: number
  error?: string
}
export interface PublicationAuditReport {
  start: string
  end: string
  checkedAt: string
  rows: PublicationAuditRow[]
}
