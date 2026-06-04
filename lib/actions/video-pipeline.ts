'use server'

import { createClient } from '@/lib/supabase/server'
import type {
  Client,
  ClientAsset,
  ContentIdea,
  ContentIdeaVideo,
  ContentIdeaVideoKind,
} from '@/lib/supabase/types'

// ── Return types (consumed by the /video-reviews pipeline UI) ──────────────────

/** Per-kind rollup of the videos uploaded against a single idea. */
export interface PipelineVideoSlots {
  raw: ContentIdeaVideo[]
  broll: ContentIdeaVideo[]
  edited: ContentIdeaVideo[]
}

/** One "video" card = a content_idea plus its uploaded media, grouped by kind. */
export interface PipelineVideo extends ContentIdea {
  videos: PipelineVideoSlots
}

/** A client with its pipeline videos and read-only brand-kit assets. */
export interface ClientVideoPipeline {
  client: Pick<
    Client,
    | 'id'
    | 'name'
    | 'industry'
    | 'status'
    | 'platforms'
    | 'logo_url'
    | 'logo_dark_url'
    | 'brand_colors'
    | 'metricool_blog_id'
  >
  videos: PipelineVideo[]
  assets: ClientAsset[]
}

function emptySlots(): PipelineVideoSlots {
  return { raw: [], broll: [], edited: [] }
}

/**
 * Loads every client with their idea-based "videos" (content_ideas) — approval
 * fields, caption fields, status, recording/publish dates — each joined with its
 * content_idea_videos grouped by kind (raw/broll/edited), plus the client's
 * read-only brand-kit assets (client_assets).
 *
 * Mirrors the supabase query style in lib/actions/clients.ts and
 * lib/actions/content-ideas.ts. Returns [] on any read failure (logged) so the
 * pipeline view degrades gracefully rather than throwing.
 */
export async function getClientVideoPipeline(): Promise<ClientVideoPipeline[]> {
  const supabase = await createClient()

  const [clientsRes, ideasRes, assetsRes] = await Promise.all([
    supabase
      .from('clients')
      .select(
        'id, name, industry, status, platforms, logo_url, logo_dark_url, brand_colors, metricool_blog_id',
      )
      .order('name', { ascending: true }),
    supabase
      .from('content_ideas')
      .select(
        `
        *,
        videos:content_idea_videos!content_idea_videos_idea_id_fkey(*)
      `,
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('client_assets')
      .select('*')
      .order('uploaded_at', { ascending: false }),
  ])

  if (clientsRes.error) {
    console.warn('[video-pipeline] clients fetch failed:', clientsRes.error.message)
    return []
  }
  if (ideasRes.error) {
    console.warn('[video-pipeline] ideas fetch failed:', ideasRes.error.message)
  }
  if (assetsRes.error) {
    console.warn('[video-pipeline] assets fetch failed:', assetsRes.error.message)
  }

  const clients = (clientsRes.data ?? []) as ClientVideoPipeline['client'][]

  // Group ideas (with their joined videos) by client.
  const ideasByClient = new Map<string, PipelineVideo[]>()
  for (const raw of ideasRes.data ?? []) {
    const row = raw as unknown as ContentIdea & { videos?: ContentIdeaVideo[] | null }
    const slots = emptySlots()

    for (const v of row.videos ?? []) {
      const kind = v.kind as ContentIdeaVideoKind
      if (!(kind in slots)) continue
      slots[kind].push(v)
    }

    // Drop the transient join key off the idea object.
    const { videos: _joined, ...idea } = row

    const pipelineVideo: PipelineVideo = {
      ...(idea as ContentIdea),
      videos: slots,
    }

    const list = ideasByClient.get(row.client_id) ?? []
    list.push(pipelineVideo)
    ideasByClient.set(row.client_id, list)
  }

  // Group assets by client.
  const assetsByClient = new Map<string, ClientAsset[]>()
  for (const asset of (assetsRes.data ?? []) as ClientAsset[]) {
    const list = assetsByClient.get(asset.client_id) ?? []
    list.push(asset)
    assetsByClient.set(asset.client_id, list)
  }

  return clients.map((client) => ({
    client,
    videos: ideasByClient.get(client.id) ?? [],
    assets: assetsByClient.get(client.id) ?? [],
  }))
}

/**
 * Single-client variant of getClientVideoPipeline, used by the full-screen
 * Client Batch view (clients/[id]/batch). Same idea+videos shape, scoped to one
 * client. Returns null when the client doesn't exist; degrades to an empty
 * videos/assets list on a read failure rather than throwing.
 */
export async function getClientVideoBatch(clientId: string): Promise<ClientVideoPipeline | null> {
  const supabase = await createClient()

  const [clientRes, ideasRes, assetsRes] = await Promise.all([
    supabase
      .from('clients')
      .select(
        'id, name, industry, status, platforms, logo_url, logo_dark_url, brand_colors, metricool_blog_id',
      )
      .eq('id', clientId)
      .maybeSingle(),
    supabase
      .from('content_ideas')
      .select(
        `
        *,
        videos:content_idea_videos!content_idea_videos_idea_id_fkey(*)
      `,
      )
      .eq('client_id', clientId)
      .neq('status', 'descartada')
      .order('created_at', { ascending: false }),
    supabase
      .from('client_assets')
      .select('*')
      .eq('client_id', clientId)
      .order('uploaded_at', { ascending: false }),
  ])

  if (clientRes.error) {
    console.warn('[video-pipeline] client fetch failed:', clientRes.error.message)
    return null
  }
  if (!clientRes.data) return null
  if (ideasRes.error) {
    console.warn('[video-pipeline] ideas fetch failed:', ideasRes.error.message)
  }
  if (assetsRes.error) {
    console.warn('[video-pipeline] assets fetch failed:', assetsRes.error.message)
  }

  const videos: PipelineVideo[] = []
  for (const raw of ideasRes.data ?? []) {
    const row = raw as unknown as ContentIdea & { videos?: ContentIdeaVideo[] | null }
    const slots = emptySlots()
    for (const v of row.videos ?? []) {
      const kind = v.kind as ContentIdeaVideoKind
      if (!(kind in slots)) continue
      slots[kind].push(v)
    }
    const { videos: _joined, ...idea } = row
    videos.push({ ...(idea as ContentIdea), videos: slots })
  }

  return {
    client: clientRes.data as ClientVideoPipeline['client'],
    videos,
    assets: (assetsRes.data ?? []) as ClientAsset[],
  }
}
