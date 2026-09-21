import { describe, expect, it } from 'vitest'
import { hasPermission } from './permissions'

describe('pipeline.claim', () => {
  it('owner, supervisor y editor pueden reclamar un corte en Pipeline', () => {
    expect(hasPermission('owner', 'pipeline.claim')).toBe(true)
    expect(hasPermission('supervisor', 'pipeline.claim')).toBe(true)
    expect(hasPermission('editor', 'pipeline.claim')).toBe(true)
    expect(hasPermission('team_member', 'pipeline.claim')).toBe(true)
  })

  it('videógrafo, copy y diseñador no reclaman desde Pipeline', () => {
    expect(hasPermission('video', 'pipeline.claim')).toBe(false)
    expect(hasPermission('copy', 'pipeline.claim')).toBe(false)
    expect(hasPermission('disenador', 'pipeline.claim')).toBe(false)
    expect(hasPermission(null, 'pipeline.claim')).toBe(false)
  })
})
