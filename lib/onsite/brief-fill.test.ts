import { describe, it, expect } from 'vitest'
import { planOnsiteBriefFill } from './brief-fill'

describe('planOnsiteBriefFill', () => {
  it('usa primero las ideas del Lab / pipeline, y la IA solo llena lo que falta', () => {
    const plan = planOnsiteBriefFill({
      need: 4,
      addable: [
        { id: 'lab-1', source: 'lab', title: 'Hook clínica' },
        { id: 'p-1', source: 'pipeline', title: 'Reel recepción' },
      ],
      generated: [
        { title: 'IA 1', hook: 'h1', visual_brief: 'v1', content_type: 'R' },
        { title: 'IA 2', hook: 'h2', visual_brief: 'v2', content_type: 'R' },
        { title: 'IA 3', hook: 'h3', visual_brief: 'v3', content_type: 'R' },
      ],
    })
    expect(plan.attach).toEqual([
      { id: 'lab-1', source: 'lab' },
      { id: 'p-1', source: 'pipeline' },
    ])
    expect(plan.create.map((c) => c.title)).toEqual(['IA 1', 'IA 2'])
  })

  it('si el Lab cubre el cupo, no pide crear ideas vacías', () => {
    const plan = planOnsiteBriefFill({
      need: 1,
      addable: [{ id: 'lab-1', source: 'lab', title: 'Ya aprobada' }],
      generated: [{ title: 'IA 1', hook: 'h', visual_brief: 'v', content_type: 'R' }],
    })
    expect(plan.attach).toHaveLength(1)
    expect(plan.create).toEqual([])
  })
})
