import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ENTREGAS_PROVIDER } from '@/lib/integrations/entregas-r2'
import {
  ENTREGAS_STORAGE_PROVIDER,
  PIPELINE_STORAGE_PROVIDER,
  filterEntregasDeliveredIdeas,
  ideaHasEntregasEditedVideo,
} from './entregas-delivery'

describe('dual-R2 transition wiring (shipped code)', () => {
  it('keeps Entregas and pipeline provider constants distinct', () => {
    expect(ENTREGAS_PROVIDER).toBe('entregas-r2')
    expect(ENTREGAS_STORAGE_PROVIDER).toBe('entregas-r2')
    expect(PIPELINE_STORAGE_PROVIDER).toBe('r2')
    expect(ENTREGAS_STORAGE_PROVIDER).not.toBe(PIPELINE_STORAGE_PROVIDER)
  })

  it('registers Entregas uploads under entregas-r2 (not pipeline r2)', () => {
    const src = readFileSync(resolve(process.cwd(), 'lib/actions/entregas-r2.ts'), 'utf8')
    expect(src).toMatch(/storage_provider:\s*ENTREGAS_PROVIDER/)
    expect(src).toMatch(/from '@\/lib\/integrations\/entregas-r2'/)
    // Must not hardcode the wrong bucket label on register
    expect(src).not.toMatch(/storage_provider:\s*'r2'/)
  })

  it('registers pipeline idea-videos under r2 only', () => {
    const src = readFileSync(resolve(process.cwd(), 'lib/actions/idea-videos-r2.ts'), 'utf8')
    expect(src).toMatch(/storage_provider:\s*'r2'/)
    expect(src).not.toMatch(/storage_provider:\s*'entregas-r2'/)
  })

  it('revision page uses filterEntregasDeliveredIdeas (or equivalent entregas-r2 edited filter)', () => {
    const src = readFileSync(resolve(process.cwd(), 'app/(dashboard)/revision/page.tsx'), 'utf8')
    const usesHelper = src.includes('filterEntregasDeliveredIdeas') || src.includes('ideaHasEntregasEditedVideo')
    const usesInline =
      src.includes("storage_provider === 'entregas-r2'") && src.includes("kind === 'edited'")
    expect(usesHelper || usesInline).toBe(true)
  })
})

describe('ideaHasEntregasEditedVideo / filterEntregasDeliveredIdeas', () => {
  it('accepts ideas with an edited file on entregas-r2', () => {
    expect(
      ideaHasEntregasEditedVideo({
        videos: [{ kind: 'edited', storage_provider: 'entregas-r2', status: 'uploaded' }],
      }),
    ).toBe(true)
  })

  it('rejects legacy pipeline-r2 edited files (transition must not conflate buckets)', () => {
    expect(
      ideaHasEntregasEditedVideo({
        videos: [{ kind: 'edited', storage_provider: 'r2', status: 'uploaded' }],
      }),
    ).toBe(false)
  })

  it('rejects raw-only uploads and archived/failed edited rows', () => {
    expect(
      ideaHasEntregasEditedVideo({
        videos: [
          { kind: 'raw', storage_provider: 'entregas-r2', status: 'uploaded' },
          { kind: 'edited', storage_provider: 'entregas-r2', status: 'archived' },
        ],
      }),
    ).toBe(false)
  })

  it('filters a mixed list the way /revision must', () => {
    const ideas = [
      { id: 'a', videos: [{ kind: 'edited', storage_provider: 'entregas-r2', status: 'uploaded' }] },
      { id: 'b', videos: [{ kind: 'edited', storage_provider: 'r2', status: 'uploaded' }] },
      { id: 'c', videos: [] },
      { id: 'd', videos: [{ kind: 'edited', storage_provider: 'entregas-r2', status: 'failed' }] },
    ]
    expect(filterEntregasDeliveredIdeas(ideas).map((i) => i.id)).toEqual(['a'])
  })
})
