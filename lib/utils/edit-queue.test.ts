import { describe, it, expect } from 'vitest'
import { activeVideoCount, isReadyToEdit } from './edit-queue'
import type { PipelineVideo } from '@/lib/actions/video-pipeline'
import type { ContentIdeaVideo } from '@/lib/supabase/types'

const vid = (status: ContentIdeaVideo['status'] = 'uploaded') => ({ status }) as ContentIdeaVideo

function pv(over: Partial<PipelineVideo['videos']> = {}, status = 'grabada'): PipelineVideo {
  return { status, videos: { raw: [], broll: [], edited: [], ...over } } as unknown as PipelineVideo
}

describe('edit-queue', () => {
  it('activeVideoCount ignores archived/failed', () => {
    expect(activeVideoCount([vid('uploaded'), vid('archived'), vid('failed'), vid('processing')])).toBe(2)
  })

  it('ready when raw>=1 active and edited==0 active', () => {
    expect(isReadyToEdit(pv({ raw: [vid()] }))).toBe(true)
  })

  it('not ready when there is no raw', () => {
    expect(isReadyToEdit(pv({ broll: [vid()] }))).toBe(false)
  })

  it('not ready when an active edited already exists', () => {
    expect(isReadyToEdit(pv({ raw: [vid()], edited: [vid()] }))).toBe(false)
  })

  it('ready when the only edited is archived', () => {
    expect(isReadyToEdit(pv({ raw: [vid()], edited: [vid('archived')] }))).toBe(true)
  })

  it('not ready when the raw is archived (no active source)', () => {
    expect(isReadyToEdit(pv({ raw: [vid('archived')] }))).toBe(false)
  })

  it('excludes descartada ideas', () => {
    expect(isReadyToEdit(pv({ raw: [vid()] }, 'descartada'))).toBe(false)
  })
})
