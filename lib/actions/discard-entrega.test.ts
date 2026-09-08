import { hasPermission, type Permission } from '@/lib/auth/permissions'
import type { UserRole } from '@/lib/supabase/types'
import { beforeEach, expect, it, vi } from 'vitest'
const h = vi.hoisted(() => ({ rows: [] as any[], role: 'supervisor' as UserRole }))
vi.mock('@/lib/auth/server', () => ({ requirePermission: async (permission: Permission) => { if (!hasPermission(h.role, permission)) throw Error('No autorizado') }, currentUserHas: async () => false }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from: () => {
  const filters: ((r: any) => boolean)[] = []
  let patch: any
  const execute = () => {
    const rows = h.rows.filter(r => filters.every(f => f(r)))
    rows.forEach(r => Object.assign(r, patch))
    return { data: rows.map(r => ({ id: r.id })), error: null }
  }
  const q: any = {
    update: (p: any) => { patch = p; return q },
    in: (k: string, v: any[]) => { filters.push(r => v.includes(r[k])); return q },
    is: (k: string, v: any) => { filters.push(r => r[k] === v); return q },
    not: (k: string, _op: string, v: string) => { filters.push(r => !v.slice(1,-1).split(',').includes(r[k])); return q },
    select: () => q,
    then: (resolve: any) => resolve(execute()),
  }
  return q
} }) }))
import { discardEntregaVideos } from './pipeline-submit'
const idea = (id: string) => ({ id, status: 'producida', metricool_post_id: null, posting_started_at: null, posted_at: null, published_at: null })
beforeEach(() => { h.role = 'supervisor'; h.rows = [idea('a')] })
it.each(['metricool_post_id','posting_started_at','posted_at','published_at'])('preserves a video with %s', async field => {
  h.rows[0][field] = 'present'
  expect(await discardEntregaVideos(['a'])).toMatchObject({ count: 0, error: expect.any(String) })
  expect(h.rows[0].status).toBe('producida')
})
it('reports the actual count for a mixed batch and preserves scheduled work', async () => {
  h.rows.push({ ...idea('b'), metricool_post_id: 'remote' })
  expect(await discardEntregaVideos(['a','b'])).toMatchObject({ count: 1, error: expect.any(String) })
  expect(h.rows.map(r => r.status)).toEqual(['descartada','producida'])
})
it('counts duplicate ids once', async () => {
  expect(await discardEntregaVideos(['a','a'])).toEqual({ ok: true, count: 1 })
})
it('does not count missing records as discarded', async () => {
  expect(await discardEntregaVideos(['missing'])).toMatchObject({ count: 0, error: expect.any(String) })
})
it('does not count previously discarded or published work', async () => {
  h.rows = [{ ...idea('a'), status: 'descartada' }, { ...idea('b'), status: 'publicada' }]
  expect(await discardEntregaVideos(['a','b'])).toMatchObject({ count: 0, error: expect.any(String) })
})

it.each(['editor','video','disenador','copy','team_member'] as const)('denies discard to %s even through a direct action call', async role => {
  h.role = role
  expect(await discardEntregaVideos(['a'])).toHaveProperty('error')
  expect(h.rows[0].status).toBe('producida')
})
it.each(['owner','supervisor'] as const)('allows discard to %s', async role => {
  h.role = role
  expect(await discardEntregaVideos(['a'])).toEqual({ ok: true, count: 1 })
})
