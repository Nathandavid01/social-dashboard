import { describe, expect, it } from 'vitest'
import { buildClientVideoInventory } from './client-video-inventory'
import { hasPermission } from '@/lib/auth/permissions'

const clients = [{ id: 'c1', name: 'Bosque', status: 'active', assigned_to: 'editor', edit_mode: 'human', metricool_blog_id: '1' }]
const video = (kind: string, extra = {}) => ({ kind, status: 'uploaded', drive_file_id: 'file.mp4', mime_type: 'video/mp4', ...extra })
const idea = (id: string, extra = {}) => ({ id, client_id: 'c1', status: 'grabada', videos: [video('raw')], ...extra })
const post = (id: number, extra = {}) => ({ id, draft: false, autoPublish: true, media: ['https://cdn/file.mp4'], providers: [{ status: 'PENDING' }], ...extra })
const build = (ideas: ReturnType<typeof idea>[], posts: ReturnType<typeof post>[] = []) => buildClientVideoInventory({ clients, ideas, profiles: [{ id: 'editor', full_name: 'Nathan' }], assignments: [], calendar: { c1: posts } })[0]

describe('unpublished client video inventory', () => {
  it('counts pieces, not raw takes or edited revisions, and excludes graphics and broken uploads', () => {
    const row = build([
      idea('raw', { videos: [video('raw'), video('raw')] }),
      idea('edited', { videos: [video('raw'), video('edited'), video('edited')] }),
      idea('graphic', { videos: [video('edited', { mime_type: 'image/png', drive_file_id: 'image.png' })] }),
      idea('broken', { videos: [video('edited', { status: 'uploading' }), video('raw', { status: 'failed' })] }),
    ])
    expect(row).toMatchObject({ edited: 1, raw: 1, scheduled: 0, editors: ['Nathan'] })
  })
  it('excludes every recorded publication signal and discarded ideas', () => {
    const rows = [idea('status', { status: 'publicada' }), idea('stamp', { published_at: '2026-10-01' }), idea('manual', { manual_posted_status: 'posted' }), idea('discarded', { status: 'descartada' }), idea('live', { metricool_post_id: 1 })]
    expect(build(rows, [post(1, { providers: [{ status: 'PUBLISHED' }, { status: 'PENDING' }] })])).toMatchObject({ edited: 0, raw: 0, scheduled: 0 })
  })
  it('deduplicates scheduled posts across linked ideas and networks; includes unlinked videos', () => {
    const row = build([idea('a', { metricool_post_id: 1, videos: [video('edited')] }), idea('b', { metricool_post_id: 1, videos: [video('edited')] })], [post(1), post(1), post(2), post(3, { media: ['photo.jpg'] })])
    expect(row).toMatchObject({ edited: 2, raw: 0, scheduled: 2 })
  })
  it('excludes scheduled posts when any linked idea records publication, even if Metricool is stale', () => {
    const row = build([
      idea('published', { published_at: '2026-10-01', metricool_post_id: 1 }),
      idea('manual', { manual_posted_status: 'posted', metricool_post_id: 2 }),
      idea('status', { status: 'publicada', metricool_post_id: 3 }),
      idea('duplicate', { metricool_post_id: 1, videos: [video('edited')] }),
    ], [post(1), post(2), post(3), post(4)])
    expect(row).toMatchObject({ edited: 0, raw: 0, scheduled: 1 })
  })
  it('drafts and errored posts are not scheduled, and a planned date alone is not a schedule', () => {
    expect(build([idea('planned', { publish_date: '2026-10-14' }), idea('draft', { metricool_post_id: 1, videos: [video('edited')] })], [post(1, { draft: true }), post(2, { providers: [{ status: 'ERROR' }] })])).toMatchObject({ edited: 1, raw: 1, scheduled: 0 })
  })
  it('reports missing/deleted/unverifiable linked posts instead of counting them as unpublished', () => {
    expect(build([idea('missing', { metricool_post_id: 99 })])).toMatchObject({ raw: 0, edited: 0, unverified: 1 })
    const row = buildClientVideoInventory({ clients, ideas: [idea('linked', { metricool_post_id: 1 })], profiles: [], assignments: [], calendar: { c1: null } })[0]
    expect(row).toMatchObject({ scheduled: null, unverified: 1 })
  })
  it('keeps client isolation, zero rows, and all assigned editors without duplicating the primary', () => {
    const rows = buildClientVideoInventory({ clients: [...clients, { ...clients[0], id: 'c2', name: 'Otro', edit_mode: 'ai', assigned_to: null }], ideas: [idea('foreign', { client_id: 'outside' })], profiles: [{ id: 'editor', full_name: 'Nathan' }, { id: 'other', full_name: 'Eric' }], assignments: [{ client_id: 'c1', editor_id: 'editor' }, { client_id: 'c1', editor_id: 'other' }], calendar: { c1: [], c2: [] } })
    expect(rows[0]).toMatchObject({ editors: ['Nathan', 'Eric'], edited: 0, raw: 0 })
    expect(rows[1].editors).toEqual(['IA'])
  })
  it('restricts the cross-client inventory to management', () => {
    expect(hasPermission('owner', 'inventory.read')).toBe(true)
    expect(hasPermission('supervisor', 'inventory.read')).toBe(false)
    expect(hasPermission('editor', 'inventory.read')).toBe(false)
    expect(hasPermission('video', 'inventory.read')).toBe(false)
  })
})
