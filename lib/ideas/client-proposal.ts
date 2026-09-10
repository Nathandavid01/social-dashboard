export interface ProposalIdea {
  id: string
  title: string
  objective?: string | null
  funnelStage?: string | null
  hook: string | null
  visualBrief?: string | null
  referenceUrl: string | null
}
export type ClientDecision = 'approved' | 'rejected'
export function proposalSnapshot(ideas: ProposalIdea[]): ProposalIdea[] {
  return ideas.map(({ id, title, objective, funnelStage, hook, visualBrief, referenceUrl }) => ({
    id, title, objective: objective ?? null, funnelStage: funnelStage ?? null,
    hook, visualBrief: visualBrief ?? null, referenceUrl,
  }))
}
export function validateDecision(decision: unknown, comment: unknown): decision is ClientDecision {
  return (decision === 'approved' || decision === 'rejected') && typeof comment === 'string' && comment.length <= 3000
}
