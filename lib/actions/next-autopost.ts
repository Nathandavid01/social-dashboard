'use server'

import { unstable_cache } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { resolvePlatforms } from '@/lib/utils/idea-posting-core'
import { todayISOInTimeZone } from '@/lib/utils/deadlines'
import { POST_TZ } from '@/lib/utils/idea-lab-send-core'
import { generateCaptionText } from '@/lib/llm/caption-llm'
import {
  nextCadencePost,
  buildNextAutopostFacts,
  buildNextAutopostPrompt,
  deterministicNotice,
  type CadenceRow,
  type CadenceType,
  type NextAutopostFacts,
} from '@/lib/utils/next-autopost-core'

/** What the UI needs to show "when/where this video will publish" + default the date. */
export interface NextAutopostNotice {
  notice: string
  dateISO: string
  typeLabels: string[]
  platformLabels: string[]
}

/**
 * Generate the one-sentence notice with the configured AI provider (Grok),
 * cached for a day keyed by the facts (client + cadence date + types +
 * platforms) so we never call the API twice for the same upcoming post. Falls
 * back to the deterministic sentence if the provider is unset or errors.
 */
const cachedNotice = unstable_cache(
  async (facts: NextAutopostFacts): Promise<string> => {
    try {
      const text = (await generateCaptionText(buildNextAutopostPrompt(facts), { maxTokens: 120 })).trim()
      return text || deterministicNotice(facts)
    } catch {
      return deterministicNotice(facts)
    }
  },
  ['next-autopost-notice-v1'],
  { revalidate: 60 * 60 * 24 },
)

/**
 * For each given client, compute "when/where their next post is scheduled" from
 * their weekly cadence (production_schedules) + platforms, and phrase it with AI.
 * Clients with no cadence are omitted. Batched DB reads; AI is cached per post.
 * Degrades to {} on any error so the calling page never breaks.
 */
export async function getNextAutopostNotices(
  clientIds: (string | null | undefined)[],
): Promise<Record<string, NextAutopostNotice>> {
  const ids = Array.from(new Set(clientIds.filter((id): id is string => !!id)))
  const out: Record<string, NextAutopostNotice> = {}
  if (ids.length === 0) return out

  try {
    const supabase = await createClient()
    const today = todayISOInTimeZone(POST_TZ)

    const [clientsRes, schedulesRes] = await Promise.all([
      supabase.from('clients').select('id, name, platforms, default_platforms').in('id', ids),
      supabase.from('production_schedules').select('client_id, day_of_week, content_type').in('client_id', ids),
    ])
    const clients = clientsRes.data
    if (!clients) return out

    const rowsByClient = new Map<string, CadenceRow[]>()
    for (const s of schedulesRes.data ?? []) {
      const arr = rowsByClient.get(s.client_id) ?? []
      arr.push({ day_of_week: s.day_of_week as number, content_type: s.content_type as CadenceType })
      rowsByClient.set(s.client_id, arr)
    }

    await Promise.all(
      clients.map(async (c) => {
        const next = nextCadencePost(rowsByClient.get(c.id) ?? [], today)
        if (!next) return
        const platforms = resolvePlatforms(
          c.platforms as string[] | null,
          c.default_platforms as string[] | null,
        )
        const facts = buildNextAutopostFacts(c.name, next, platforms, today)
        out[c.id] = {
          notice: await cachedNotice(facts),
          dateISO: facts.dateISO,
          typeLabels: facts.typeLabels,
          platformLabels: facts.platformLabels,
        }
      }),
    )
  } catch {
    return out
  }
  return out
}
