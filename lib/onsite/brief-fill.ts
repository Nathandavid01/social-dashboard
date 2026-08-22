export type BriefAddable = {
  id: string
  source: 'lab' | 'pipeline'
  title: string
}

export type BriefGenerated = {
  title: string
  hook: string
  visual_brief: string
  content_type: string
  rationale?: string | null
  virality_score?: number | null
}

/**
 * El call sheet se llena con ideas de verdad: primero Lab/pipeline, luego IA.
 * Nunca inventa "Idea 1" vacía.
 */
export function planOnsiteBriefFill(input: {
  need: number
  addable: BriefAddable[]
  generated: BriefGenerated[]
}): {
  attach: { id: string; source: 'lab' | 'pipeline' }[]
  create: BriefGenerated[]
} {
  const need = Math.max(0, Math.floor(input.need))
  const attach = input.addable.slice(0, need).map((a) => ({ id: a.id, source: a.source }))
  const leftover = need - attach.length
  return {
    attach,
    create: leftover > 0 ? input.generated.slice(0, leftover) : [],
  }
}
