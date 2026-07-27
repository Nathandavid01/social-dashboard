import { describe, it, expect } from 'vitest'
import type { IdeaWithPipeline } from '@/lib/supabase/types'
import {
  ideaStage, batchStage, groupIntoBatches, bucketBatches, adjacentBatchStage, batchProgress, buildClientPipelineIndex, batchBreakdown, splitBatchesByStage, BATCH_STAGES,
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
  it('collapses everything before review into the first Editado column', () => {
    expect(ideaStage(idea())).toBe('edited')
    expect(ideaStage(idea({ hook: 'h' }))).toBe('edited')
    expect(ideaStage(idea({ hook: 'h', visual_brief: 'v' }))).toBe('edited')
    expect(ideaStage(idea({ generated_caption: 'c' }))).toBe('edited')
    expect(ideaStage(idea({ status: 'grabada' }))).toBe('edited')
    expect(ideaStage(idea({ status: 'producida' }))).toBe('edited')
    expect(ideaStage(idea({ status: 'publicada' }))).toBe('publication')
  })

  it('routes the internal-review states through Revisión → Copy → Publicación', () => {
    expect(ideaStage(idea({ status: 'producida', approval_status: 'submitted' }))).toBe('approval')
    // Sent back for changes → the editor's column, not the reviewer's.
    expect(ideaStage(idea({ status: 'producida', approval_status: 'revision_needed' }))).toBe('edited')
    // Approved with no copy yet parks the video in the Copy column.
    expect(ideaStage(idea({ status: 'producida', approval_status: 'approved' }))).toBe('copy')
    expect(
      ideaStage(idea({ status: 'producida', approval_status: 'approved', generated_caption: 'c' })),
    ).toBe('publication')
  })
})

describe('batchStage — moves together (least advanced active video)', () => {
  it('sits at the least-advanced video', () => {
    expect(batchStage([idea({ status: 'producida', approval_status: 'approved' }), idea({ hook: 'h' })])).toBe('edited')
  })
  it('is publication only when every active video is published', () => {
    expect(batchStage([idea({ status: 'publicada' }), idea({ status: 'publicada' })])).toBe('publication')
    expect(batchStage([idea({ status: 'publicada' }), idea({ status: 'grabada' })])).toBe('edited')
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
    expect(nora.stage).toBe('edited') // nothing sent to review yet
    expect(batches.find((b) => b.clientId === 'c2')!.stage).toBe('publication')
  })
  it('excludes clients whose videos are all discarded', () => {
    const batches = groupIntoBatches([idea({ status: 'descartada' })] as IdeaWithPipeline[])
    expect(batches).toHaveLength(0)
  })
  it('counts videos the reviewer sent back, so the card can flag them', () => {
    const batches = groupIntoBatches([
      idea({ id: '1', approval_status: 'revision_needed' }),
      idea({ id: '2', approval_status: 'revision_needed' }),
      idea({ id: '3', approval_status: 'submitted' }),
    ] as IdeaWithPipeline[])
    expect(batches[0].revisionNeeded).toBe(2)
  })
  it('is zero when nothing came back', () => {
    const batches = groupIntoBatches([idea({ approval_status: 'submitted' })] as IdeaWithPipeline[])
    expect(batches[0].revisionNeeded).toBe(0)
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
    expect(index.c1.batchStageLabel).toBe('Editado')
    expect(index.c1.videos.map((v) => v.title)).toEqual(['Reel A', 'Reel B'])
    expect(index.c1.videos[0].stageLabel).toBe('Editado')
    expect(index.c1.videos[1].stageLabel).toBe('Editado')
    expect(index.c1.metricoolScheduled).toBe(0)
    expect(index.c1.nextNewVideo).toBeNull()
  })

  it('omits clients with only discarded videos', () => {
    const index = buildClientPipelineIndex([idea({ status: 'descartada' })] as IdeaWithPipeline[])
    expect(index).toEqual({})
  })
})

describe('splitBatchesByStage — un cliente puede estar en varias columnas', () => {
  const build = (...ideas: Partial<IdeaWithPipeline>[]) =>
    splitBatchesByStage(groupIntoBatches(ideas.map((o) => idea(o)) as IdeaWithPipeline[]))

  it('deja una sola tarjeta cuando todo está en la misma columna', () => {
    const cards = build({ id: '1' }, { id: '2' })
    expect(cards).toHaveLength(1)
    expect(cards[0].stage).toBe('edited')
    expect(cards[0].total).toBe(2)
  })

  it('parte el cliente en una tarjeta por columna con videos', () => {
    const cards = build(
      { id: '1' },                                   // edited
      { id: '2', approval_status: 'submitted' },     // approval
      { id: '3', approval_status: 'approved' },      // copy
    )
    expect(cards.map((c) => c.stage)).toEqual(['edited', 'approval', 'copy'])
    expect(cards.map((c) => c.total)).toEqual([1, 1, 1])
  })

  it('cada tarjeta cuenta SOLO sus videos', () => {
    const cards = build(
      { id: '1' }, { id: '2' },                      // 2 en edited
      { id: '3', approval_status: 'submitted' },     // 1 en approval
    )
    const edited = cards.find((c) => c.stage === 'edited')!
    const approval = cards.find((c) => c.stage === 'approval')!
    expect(edited.total).toBe(2)
    expect(approval.total).toBe(1)
    expect(edited.ideas.map((i) => i.id)).toEqual(['1', '2'])
    expect(approval.ideas.map((i) => i.id)).toEqual(['3'])
  })

  it('no deja columnas vacías', () => {
    const cards = build({ id: '1', approval_status: 'submitted' })
    expect(cards).toHaveLength(1)
    expect(cards[0].stage).toBe('approval')
  })

  it('los cambios pedidos se cuentan en la tarjeta de Editado', () => {
    const cards = build(
      { id: '1', approval_status: 'revision_needed' },
      { id: '2', approval_status: 'submitted' },
    )
    const edited = cards.find((c) => c.stage === 'edited')!
    const approval = cards.find((c) => c.stage === 'approval')!
    expect(edited.revisionNeeded).toBe(1)
    expect(approval.revisionNeeded).toBe(0)
  })

  it('ya no hay desglose que mostrar: cada tarjeta es de una sola columna', () => {
    const cards = build({ id: '1' }, { id: '2', approval_status: 'approved' })
    for (const c of cards) expect(batchBreakdown(c)).toEqual([])
  })

  it('mantiene cliente y asignado en cada tarjeta', () => {
    const ana = { id: 'a', full_name: 'Ana' }
    const cards = build(
      { id: '1', assignee: ana },
      { id: '2', assignee: ana, approval_status: 'submitted' },
    )
    for (const c of cards) {
      expect(c.clientName).toBe('Nora')
      expect(c.assignee).toEqual({ id: 'a', name: 'Ana' })
    }
  })
})

describe('batchBreakdown — what the card says when a batch is split', () => {
  const build = (...ideas: Partial<IdeaWithPipeline>[]) =>
    groupIntoBatches(ideas.map((o) => idea(o)) as IdeaWithPipeline[])[0]

  it('says nothing when every video sits in the same stage', () => {
    expect(batchBreakdown(build({ id: '1' }, { id: '2' }))).toEqual([])
  })
  it('calls out videos the reviewer sent back', () => {
    const b = build({ id: '1', approval_status: 'revision_needed' }, { id: '2', approval_status: 'revision_needed' })
    expect(batchBreakdown(b)).toEqual(['2 con cambios'])
  })
  it('lists the stages the rest of the batch has moved on to', () => {
    const b = build(
      { id: '1', approval_status: 'revision_needed' },
      { id: '2', approval_status: 'approved' },
      { id: '3', approval_status: 'approved' },
    )
    // batch sits at edited (least advanced) → that column is implied, not listed
    expect(batchBreakdown(b)).toEqual(['1 con cambios', '2 en Copy'])
  })
  it('uses the singular for one video', () => {
    const b = build({ id: '1' }, { id: '2', approval_status: 'approved' })
    expect(batchBreakdown(b)).toEqual(['1 en Copy'])
  })
})

describe('bucketBatches / adjacentBatchStage / batchProgress', () => {
  it('buckets batches into the 4 columns, Editado first', () => {
    const b = bucketBatches(groupIntoBatches([idea({ status: 'grabada' })] as IdeaWithPipeline[]))
    expect(b.edited).toHaveLength(1)
    expect(Object.keys(b)).toEqual(BATCH_STAGES.map((s) => s.key))
    expect(Object.keys(b)).not.toContain('video')
  })
  it('moves a batch forward and back, Editado first', () => {
    expect(adjacentBatchStage('edited', 1)).toBe('approval')
    expect(adjacentBatchStage('approval', -1)).toBe('edited')
    expect(adjacentBatchStage('edited', -1)).toBeNull()
    expect(adjacentBatchStage('publication', 1)).toBeNull()
  })
  it('progress grows along the pipeline', () => {
    expect(batchProgress('edited')).toBe(0)
    expect(batchProgress('publication')).toBe(1)
  })
  it('counts every stage, including copy (a missing key would count NaN)', () => {
    const batches = groupIntoBatches([
      idea({ status: 'producida', approval_status: 'approved' }),
    ] as IdeaWithPipeline[])
    expect(batches[0].stageCounts.copy).toBe(1)
    expect(Object.keys(batches[0].stageCounts)).toEqual(BATCH_STAGES.map((s) => s.key))
  })
})
