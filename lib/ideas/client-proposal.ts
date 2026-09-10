export interface ProposalIdea {
  id: string
  title: string
  hook: string | null
  visualBrief?: string | null
  referenceUrl: string | null
}
export type ClientDecision = 'approved' | 'rejected'
export function proposalSnapshot(ideas: ProposalIdea[]): ProposalIdea[] {
  return ideas.map(({ id, title, hook, visualBrief, referenceUrl }) => ({ id, title, hook, visualBrief: visualBrief ?? null, referenceUrl }))
}
export function validateDecision(decision: unknown, comment: unknown): decision is ClientDecision {
  return (decision === 'approved' || decision === 'rejected') && typeof comment === 'string' && comment.length <= 3000
}
