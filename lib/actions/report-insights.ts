import 'server-only'
import { unstable_cache } from 'next/cache'
import { generateCaptionText } from '@/lib/llm/caption-llm'
import { buildInsightPrompt, fallbackInsight, type InsightFacts } from '@/lib/utils/report-insights-core'

// AI executive summary for the client report. Falls back to a deterministic
// summary if the LLM isn't configured or errors — the report never breaks.
async function compute(facts: InsightFacts): Promise<string> {
  try {
    const text = await generateCaptionText(buildInsightPrompt(facts), { maxTokens: 500 })
    const t = (text ?? '').trim()
    return t.length > 30 ? t : fallbackInsight(facts)
  } catch {
    return fallbackInsight(facts)
  }
}

// Cached by the facts (args are part of the key) for a day so re-opening or
// printing the report doesn't re-hit the LLM for the same data.
const cached = unstable_cache(compute, ['report-insights-v1'], { revalidate: 86400 })

export async function getReportInsights(facts: InsightFacts): Promise<string> {
  return cached(facts)
}
