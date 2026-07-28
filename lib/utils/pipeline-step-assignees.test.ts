import { describe, it, expect } from 'vitest'
import { parsePipelineStepAssignees, resolveStepAssignee } from './pipeline-step-assignees'

describe('parsePipelineStepAssignees', () => {
  it('keeps valid stage keys only', () => {
    // 'video' is no longer a stage — it must be dropped like any bogus key.
    expect(parsePipelineStepAssignees({ video: 'u1', bogus: 'x', edited: 'u2', copy: 'u3' })).toEqual({
      edited: 'u2',
      copy: 'u3',
    })
  })

  it('returns {} for invalid input', () => {
    expect(parsePipelineStepAssignees(null)).toEqual({})
    expect(parsePipelineStepAssignees([])).toEqual({})
  })
})

describe('resolveStepAssignee', () => {
  it('resolves a configured owner', () => {
    expect(
      resolveStepAssignee('edited', { edited: 'u1' }, { u1: 'Ana Torres' }),
    ).toEqual({ id: 'u1', name: 'Ana Torres' })
  })

  it('returns null when unassigned or profile missing', () => {
    expect(resolveStepAssignee('edited', {}, { u1: 'Ana' })).toBeNull()
    expect(resolveStepAssignee('edited', { edited: 'u9' }, { u1: 'Ana' })).toBeNull()
  })
})
