import { describe, it, expect } from 'vitest'
import type { IdeaWithPipeline } from '@/lib/supabase/types'
import {
  ideaStage, batchStage, groupIntoBatches, bucketBatches, bucketIdeasByStage, adjacentBatchStage, batchProgress, BATCH_STAGES,
} from './content-batches'

function idea(over: Partial<IdeaWithPipeline> = {}): IdeaWithPipeline {
  return {
    id: 'i', client_id: 'c1', content_type: 'R', title: 't',
    hook: null, visual_brief: null, caption_angle: null, hashtags_suggestion: null, rationale: null,
    status: 'idea', production_task_id: null, recording_session_id: null, theme: null,
    generation_prompt: null, model: null, generated_caption: null, caption_platform: null, caption_generated_at: null,
    published_at: null, approval_status: 'pending', approved_by: null, approved_at: null, submitted_at: null,
    recording_date: null, publish_date: null, created_by: null,
    created_at: '2026-06-01', updated_at: '2026-06-01',
    recordingScheduled: false, videos: [], assignee: null,
    client: { id: 'c1', name: 'Nora', industry: null },
    ...over,
  } as IdeaWithPipeline
}

describe('ideaStage', () => {
  it('maps data to a pipeline stage (idea → publication)', () => {
    expect(ideaStage(idea())).toBe('idea')
    expect(ideaStage(idea({ hook: 'h' }))).toBe('title')
    expect(ideaStage(idea({ generated_caption: 'c' }))).toBe('caption')
    expect(ideaStage(idea({ status: 'grabada' }))).toBe('video')
    expect(ideaStage(idea({ status: 'producida' }))).toBe('edited')
    expect(ideaStage(idea({ status: 'producida', approval_status: 'approved' }))).toBe('approval')
    expect(ideaStage(idea({ status: 'publicada' }))).toBe('publication')
  })
})

describe('batchStage — moves together (least advanced active video)', () => {
  it('sits at the least-advanced video', () => {
    expect(batchStage([idea({ status: 'producida' }), idea({ hook: 'h' }), idea({ status: 'grabada' })])).toBe('title')
  })
  it('is publication only when every active video is published', () => {
    expect(batchStage([idea({ status: 'publicada' }), idea({ status: 'publicada' })])).toBe('publication')
    expect(batchStage([idea({ status: 'publicada' }), idea({ status: 'grabada' })])).toBe('video')
  })
})

describe('groupIntoBatches', () => {
  it('produces one batch per client with totals and dominant assignee', () => {
    const ann = { id: 'a', full_name: 'Ana' }
    const batches = groupIntoBatches([
      idea({ id: '1', client_id: 'c1', assignee: ann, hook: 'h' }),
      idea({ id: '2', client_id: 'c1', assignee: ann, status: 'grabada' }),
      idea({ id: '3', client_id: 'c2', client: { id: 'c2', name: 'Lumen', industry: null }, status: 'publicada' }),
    ] as IdeaWithPipeline[])
    expect(batches).toHaveLength(2)
    const nora = batches.find((b) => b.clientId === 'c1')!
    expect(nora.total).toBe(2)
    expect(nora.assignee).toEqual({ id: 'a', name: 'Ana' })
    expect(nora.stage).toBe('title') // least advanced of {title, video}
    expect(batches.find((b) => b.clientId === 'c2')!.stage).toBe('publication')
  })
  it('excludes clients whose videos are all discarded', () => {
    const batches = groupIntoBatches([idea({ status: 'descartada' })] as IdeaWithPipeline[])
    expect(batches).toHaveLength(0)
  })
  it('unassigned batch has a null assignee', () => {
    const batches = groupIntoBatches([idea()] as IdeaWithPipeline[])
    expect(batches[0].assignee).toBeNull()
  })
})

describe('bucketIdeasByStage — one card per video (not per client)', () => {
  it('buckets each active video into its own stage column', () => {
    const out = bucketIdeasByStage([
      idea({ id: '1', client_id: 'c1', hook: 'h' }),           // title
      idea({ id: '2', client_id: 'c1', status: 'grabada' }),   // video (same client, separate card)
      idea({ id: '3', client_id: 'c2', status: 'publicada' }), // publication
    ] as IdeaWithPipeline[])
    expect(out.title.map((i) => i.id)).toEqual(['1'])
    expect(out.video.map((i) => i.id)).toEqual(['2'])
    expect(out.publication.map((i) => i.id)).toEqual(['3'])
    expect(Object.keys(out)).toEqual(BATCH_STAGES.map((s) => s.key))
  })
  it('excludes discarded videos', () => {
    const out = bucketIdeasByStage([idea({ status: 'descartada' })] as IdeaWithPipeline[])
    expect(Object.values(out).flat()).toHaveLength(0)
  })
})

describe('bucketBatches / adjacentBatchStage / batchProgress', () => {
  it('buckets batches into the 7 columns', () => {
    const b = bucketBatches(groupIntoBatches([idea({ status: 'grabada' })] as IdeaWithPipeline[]))
    expect(b.video).toHaveLength(1)
    expect(Object.keys(b)).toEqual(BATCH_STAGES.map((s) => s.key))
  })
  it('moves a batch forward and back, idea first then title', () => {
    expect(adjacentBatchStage('idea', 1)).toBe('title')
    expect(adjacentBatchStage('title', -1)).toBe('idea')
    expect(adjacentBatchStage('idea', -1)).toBeNull()
    expect(adjacentBatchStage('publication', 1)).toBeNull()
  })
  it('progress grows along the pipeline', () => {
    expect(batchProgress('idea')).toBe(0)
    expect(batchProgress('publication')).toBe(1)
  })
})
