import type { StyleExample } from '@/lib/utils/idea-caption-prompt'

/**
 * Pull a client's recently PUBLISHED captions from Metricool to use as style
 * references when generating new captions. Server-only (reads METRICOOL_* env
 * secrets). Best-effort: any failure (missing config, network, bad response)
 * returns [] so caption generation degrades gracefully instead of throwing.
 *
 * `blogId` is the client's `metricool_blog_id`; when absent it falls back to
 * the global METRICOOL_BLOG_ID so a single-account setup still gets examples.
 */
export async function fetchClientStyleExamples(blogId?: string): Promise<StyleExample[]> {
  try {
    const token = process.env.METRICOOL_TOKEN
    const userId = process.env.METRICOOL_USER_ID
    const effectiveBlogId = blogId || process.env.METRICOOL_BLOG_ID
    if (!token || !userId || !effectiveBlogId) return []

    const url = `https://app.metricool.com/api/v2/scheduler/posts?userId=${userId}&blogId=${effectiveBlogId}&start=2025-01-01T00:00:00&end=2026-12-31T23:59:59`
    const res = await fetch(url, { headers: { 'X-Mc-Auth': token } })
    if (!res.ok) return []

    const json = (await res.json()) as {
      data?: { text: string; providers?: { network: string }[]; draft?: boolean }[]
    }
    const posts = json.data || []
    return posts
      .filter((p) => p.text?.trim().length > 20 && !p.draft)
      .map((p) => ({ text: p.text, provider: p.providers?.[0]?.network || 'instagram' }))
      .slice(0, 12)
  } catch {
    return []
  }
}
