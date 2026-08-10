import { describe, expect, it, vi } from 'vitest'
import {
  probeIdeaVideoRelationshipSchema,
  probeRevisionPipelineSelect,
} from './check-content-idea-video-schema.mjs'

describe('live schema probe (mocked network)', () => {
  it('reports dual_relationship on PGRST201', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 300,
      text: async () =>
        JSON.stringify({
          code: 'PGRST201',
          message:
            "Could not embed because more than one relationship was found for 'content_ideas' and 'content_idea_videos'",
        }),
    })) as unknown as typeof fetch

    // Ensure env so it does not skip
    const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'

    try {
      const result = await probeIdeaVideoRelationshipSchema(fetchImpl)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.kind).toBe('dual_relationship')
        expect(result.detail).toMatch(/content_ideas/)
      }
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl
      process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey
    }
  })

  it('ok when bare embed returns 200', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => '[]',
    })) as unknown as typeof fetch

    const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'

    try {
      const result = await probeIdeaVideoRelationshipSchema(fetchImpl)
      expect(result).toEqual({ ok: true, status: 200 })
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl
      process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey
    }
  })

  it('revision select fails loudly on HTTP error', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 400,
      text: async () => '{"message":"bad"}',
    })) as unknown as typeof fetch

    const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'

    try {
      const result = await probeRevisionPipelineSelect(fetchImpl)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.kind).toBe('revision_select_failed')
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl
      process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey
    }
  })
})
