import { describe, it, expect } from 'vitest'
import type { IdeaWithPipeline } from '@/lib/supabase/types'
import {
  ideaStage, batchStage, groupIntoBatches, bucketBatches, adjacentBatchStage, batchProgress, buildClientPipelineIndex, BATCH_STAGES,
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
  it('collapses everything pre-edit into the first Video column', () => {
    expect(ideaStage(idea())).toBe('video')
    expect(ideaStage(idea({ hook: 'h' }))).toBe('video')
    expect(ideaStage(idea({ hook: 'h', visual_brief: 'v' }))).toBe('video')
    expect(ideaStage(idea({ generated_caption: 'c' }))).toBe('video')
    expect(ideaStage(idea({ status: 'grabada' }))).toBe('video')
    expect(ideaStage(idea({ status: 'producida' }))).toBe('edited')
    expect(ideaStage(idea({ status: 'publicada' }))).toBe('publication')
  })

  it('routes the internal-review states through Revisión → Copy → Publicación', () => {
    expect(ideaStage(idea({ status: 'producida', approval_status: 'submitted' }))).toBe('approval')
    expect(ideaStage(idea({ status: 'producida', approval_status: 'revision_needed' }))).toBe('approval')
    // Approved with no copy yet parks the video in the Copy column.
    expect(ideaStage(idea({ status: 'producida', approval_status: 'approved' }))).toBe('copy')
    expect(
      ideaStage(idea({ status: 'producida', approval_status: 'approved', generated_caption: 'c' })),
    ).toBe('publication')
  })
})

describe('batchStage — moves together (least advanced active video)', () => {
  it('sits at the least-advanced video', () => {
    expect(batchStage([idea({ status: 'producida' }), idea({ hook: 'h' }), idea({ status: 'grabada' })])).toBe('video')
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
    expect(nora.stage).toBe('video') // both pre-edit videos collapse to Video
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

describe('buildClientPipelineIndex', () => {
  it('summarizes active videos per client for the Nuevo video picker', () => {
    const index = buildClientPipelineIndex([
      idea({ id: '1', client_id: 'c1', title: 'Reel A', hook: 'h' }),
      idea({ id: '2', client_id: 'c1', title: 'Reel B', status: 'grabada' }),
    ] as IdeaWithPipeline[])
    expect(index.c1.total).toBe(2)
    expect(index.c1.batchStageLabel).toBe('Video')
    expect(index.c1.videos.map((v) => v.title)).toEqual(['Reel A', 'Reel B'])
    expect(index.c1.videos[0].stageLabel).toBe('Video')
    expect(index.c1.videos[1].stageLabel).toBe('Video')
    expect(index.c1.metricoolScheduled).toBe(0)
    expect(index.c1.nextNewVideo).toBeNull()
  })

  it('omits clients with only discarded videos', () => {
    const index = buildClientPipelineIndex([idea({ status: 'descartada' })] as IdeaWithPipeline[])
    expect(index).toEqual({})
  })
})

describe('bucketBatches / adjacentBatchStage / batchProgress', () => {
  it('buckets batches into the 4 columns', () => {
    const b = bucketBatches(groupIntoBatches([idea({ status: 'grabada' })] as IdeaWithPipeline[]))
    expect(b.video).toHaveLength(1)
    expect(Object.keys(b)).toEqual(BATCH_STAGES.map((s) => s.key))
  })
  it('moves a batch forward and back, video first', () => {
    expect(adjacentBatchStage('video', 1)).toBe('edited')
    expect(adjacentBatchStage('edited', -1)).toBe('video')
    expect(adjacentBatchStage('video', -1)).toBeNull()
    expect(adjacentBatchStage('publication', 1)).toBeNull()
  })
  it('progress grows along the pipeline', () => {
    expect(batchProgress('video')).toBe(0)
    expect(batchProgress('publication')).toBe(1)
  })
})
