import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IdeaWithPipeline } from '@/lib/supabase/types'

const mocks = vi.hoisted(() => ({
  role: vi.fn(),
  userId: vi.fn(),
  ideas: vi.fn(),
  pipelineTotals: vi.fn(),
  contentBoard: vi.fn(() => null),
}))

const clients = [
  { id: 'c1', name: 'Cliente mío', logo_url: null, brand_colors: null, created_at: '2026-01-01', updated_at: '2026-01-01', platforms: [], status: 'active', posting_days: [], posting_time: null, metricool_blog_id: null },
  { id: 'c2', name: 'Cliente ajeno', logo_url: null, brand_colors: null, created_at: '2026-01-01', updated_at: '2026-01-01', platforms: [], status: 'active', posting_days: [], posting_time: null, metricool_blog_id: null },
]

const profiles = [
  { id: 'ed-1', full_name: 'Editora Uno', email: 'uno@example.com', role: 'editor', status: 'active' },
  { id: 'ed-2', full_name: 'Editor Dos', email: 'dos@example.com', role: 'editor', status: 'active' },
  { id: 'own-1', full_name: 'Owner', email: 'owner@example.com', role: 'owner', status: 'active' },
]

function idea(id: string, clientId: string, editorId: string): IdeaWithPipeline {
  return {
    id,
    client_id: clientId,
    title: id,
    created_at: '2026-08-01',
    status: 'grabada',
    assignee: { id: editorId, full_name: editorId },
    client: { id: clientId, name: clientId, industry: null },
    videos: [],
  } as unknown as IdeaWithPipeline
}

vi.mock('@/lib/auth/server', () => ({
  requirePermission: vi.fn(async () => undefined),
  // false → la autoasignación no corre en estos tests de scope de lectura.
  currentUserHas: vi.fn(async () => false),
  getEffectiveRole: () => mocks.role(),
  getEffectiveUserId: () => mocks.userId(),
}))
vi.mock('@/lib/actions/content-ideas', () => ({ getIdeacionPipeline: () => mocks.ideas() }))
vi.mock('@/lib/utils/content-pipeline', () => ({ getPipelineTotals: () => mocks.pipelineTotals() }))
vi.mock('@/lib/actions/client-pictures', () => ({ getMetricoolPicturesByBlogId: vi.fn(async () => ({})) }))
vi.mock('@/lib/utils/workflow-progress', () => ({ getWorkflowSettings: vi.fn(async () => ({ pipeline_step_assignees: {} })) }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => table === 'clients'
          ? { order: async () => ({ data: clients, error: null }) }
          : Promise.resolve({ data: profiles, error: null }),
        // client_assets (enlaces del banco): sin activos en este test.
        in: async () => ({ data: [], error: null }),
      }),
    }),
  })),
}))
vi.mock('@/components/pipeline/content-pipeline-board', () => ({
  ContentPipelineBoard: mocks.contentBoard,
}))

import PipelinePage from './page'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.role.mockResolvedValue('editor')
  mocks.userId.mockResolvedValue('ed-1')
  mocks.ideas.mockResolvedValue([
    idea('mia', 'c1', 'ed-1'),
    idea('ajena', 'c2', 'ed-2'),
  ])
  mocks.pipelineTotals.mockResolvedValue({
    totals: {},
    perClient: [
      { clientId: 'c1', ideas: 12, porEditar: 12, porPublicar: 12, targetSemana: 3 },
      { clientId: 'c2', ideas: 3, porEditar: 1, porPublicar: 2, targetSemana: 3 },
    ],
  })
})

describe('PipelinePage access scope', () => {
  it('el editor recibe solo sus ideas, clientes y perfil; sin datos globales', async () => {
    const result = await PipelinePage()

    expect(result.props.ideas.map((item: IdeaWithPipeline) => item.id)).toEqual(['mia'])
    expect(result.props.allClients).toEqual([{ id: 'c1', name: 'Cliente mío' }])
    expect(result.props.teamMembers).toEqual([{ id: 'ed-1', name: 'Editora Uno' }])
    expect(result.props.bankAdmins).toEqual([])
    expect(result.props.plannedClients).toEqual([])
    expect(Object.keys(result.props.clientRunway)).toEqual(['c1'])
    expect(result.props.clientRunway.c1).toMatchObject({ status: 'ok', minWeeks: 4 })
    expect(result.props.canSeeAll).toBe(false)
  })

  it('owner y supervisor reciben el pipeline completo', async () => {
    mocks.role.mockResolvedValue('supervisor')
    mocks.userId.mockResolvedValue('sup-1')

    const result = await PipelinePage()

    expect(result.props.ideas.map((item: IdeaWithPipeline) => item.id).sort()).toEqual(['ajena', 'mia'])
    expect(result.props.allClients).toHaveLength(2)
    expect(result.props.teamMembers).toHaveLength(3)
    expect(result.props.bankAdmins.map((admin: { id: string }) => admin.id)).toEqual(['own-1'])
    expect(Object.keys(result.props.clientRunway).sort()).toEqual(['c1', 'c2'])
    expect(result.props.canSeeAll).toBe(true)
  })
})
