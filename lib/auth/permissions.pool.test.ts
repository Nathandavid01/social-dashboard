import { describe, expect, it } from 'vitest'
import { hasPermission } from './permissions'
import { AREAS } from './areas'

describe('panel /pool', () => {
  it('/pool es área de Publicación con posting.read', () => {
    const area = AREAS.find((a) => a.href === '/pool')
    expect(area).toBeDefined()
    expect(area?.permission).toBe('posting.read')
    expect(area?.group).toBe('Publicación')
    expect(area?.nav).not.toBe(false)
  })

  it('owner, supervisor y copy ven el panel; editor y video no', () => {
    expect(hasPermission('owner', 'posting.read')).toBe(true)
    expect(hasPermission('supervisor', 'posting.read')).toBe(true)
    expect(hasPermission('copy', 'posting.read')).toBe(true)
    expect(hasPermission('editor', 'posting.read')).toBe(false)
    expect(hasPermission('video', 'posting.read')).toBe(false)
  })

  it('solo owner y supervisor agendan (posting.publish)', () => {
    expect(hasPermission('owner', 'posting.publish')).toBe(true)
    expect(hasPermission('supervisor', 'posting.publish')).toBe(true)
    expect(hasPermission('copy', 'posting.publish')).toBe(false)
    expect(hasPermission('editor', 'posting.publish')).toBe(false)
  })
})
