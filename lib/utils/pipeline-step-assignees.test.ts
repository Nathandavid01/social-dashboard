import { describe, it, expect } from 'vitest'
import { parsePipelineStepAssignees, resolveStepAssignee } from './pipeline-step-assignees'

describe('parsePipelineStepAssignees', () => {
  it('keeps valid stage keys only', () => {
    expect(parsePipelineStepAssignees({ idea: 'u1', bogus: 'x', title: 'u2' })).toEqual({
      idea: 'u1',
      title: 'u2',
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
      resolveStepAssignee('idea', { idea: 'u1' }, { u1: 'Ana Torres' }),
    ).toEqual({ id: 'u1', name: 'Ana Torres' })
  })

  it('returns null when unassigned or profile missing', () => {
    expect(resolveStepAssignee('idea', {}, { u1: 'Ana' })).toBeNull()
    expect(resolveStepAssignee('idea', { idea: 'u9' }, { u1: 'Ana' })).toBeNull()
  })
})
