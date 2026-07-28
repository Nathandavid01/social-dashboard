import { describe, it, expect } from 'vitest'
import { parsePipelineStepAssignees, resolveStepAssignee } from './pipeline-step-assignees'

describe('parsePipelineStepAssignees', () => {
  it('keeps valid stage keys only', () => {
    expect(parsePipelineStepAssignees({ video: 'u1', bogus: 'x', edited: 'u2' })).toEqual({
      video: 'u1',
      edited: 'u2',
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
      resolveStepAssignee('video', { video: 'u1' }, { u1: 'Ana Torres' }),
    ).toEqual({ id: 'u1', name: 'Ana Torres' })
  })

  it('returns null when unassigned or profile missing', () => {
    expect(resolveStepAssignee('video', {}, { u1: 'Ana' })).toBeNull()
    expect(resolveStepAssignee('video', { video: 'u9' }, { u1: 'Ana' })).toBeNull()
  })
})
