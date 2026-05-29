import { describe, it, expect } from 'vitest'
import { nextAction } from './next-action'
import { computeIdeaPipeline } from './idea-pipeline-stages'

function pipe(over: Record<string, unknown> = {}) {
  return computeIdeaPipeline({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    idea: {
      hook: 'h', visual_brief: 'b', generated_caption: null, status: 'idea',
      approval_status: 'pending', published_at: null, recording_session_id: null, recording_date: null,
      ...over,
    } as any,
    videos: [],
    recordingScheduled: false,
  })
}

describe('nextAction', () => {
  it('points to generating the caption when the idea is defined but has no caption', () => {
    const a = nextAction(pipe())
    expect(a.stage).toBe('caption')
    expect(a.label).toMatch(/caption/i)
    expect(a.done).toBe(false)
  })

  it('points to scheduling once the caption exists', () => {
    const a = nextAction(pipe({ generated_caption: 'listo' }))
    expect(a.stage).toBe('scheduled')
    expect(a.label).toMatch(/agendar/i)
  })

  it('is done (no actions) when the video is fully published', () => {
    const a = nextAction(pipe({
      generated_caption: 'c', recording_session_id: 's', recording_date: '2026-01-01',
      status: 'producida', approval_status: 'approved', published_at: '2026-01-02',
    }))
    expect(a.done).toBe(true)
    expect(a.stage).toBeNull()
  })
})
