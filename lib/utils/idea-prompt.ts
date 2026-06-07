/**
 * The Idea Lab's "marketing brain" — pure prompt construction for the AI idea
 * generator. Kept free of network/server imports so it can be unit tested and
 * reused. The route (app/api/generate-ideas) supplies live data (client profile,
 * top-performing posts, trends) and runs a two-pass generate → critique pipeline
 * built from the prompts below.
 */

/** A published post with whatever engagement signal Metricool returned. */
export interface PerfPost {
  text: string
  likes?: number
  comments?: number
  shares?: number
  reach?: number
  engagement?: number
}

/** A post chosen as a "winner" to learn from, with a computed score. */
export interface WinnerPost {
  text: string
  score: number
  likes?: number
  comments?: number
}

export interface IdeaGenInput {
  count: number
  /** No specific client — general agency brainstorming. */
  general: boolean
  clientName?: string
  industry?: string
  /** Pre-joined brand-profile lines (voice, CTA, hashtags, rules). */
  clientProfile?: string
  theme?: string
  trends: string[]
  /** Human labels for the allowed content types, e.g. ['Reel', 'Static Post']. */
  typeLabels: string[]
  /** Top-performing posts to learn from (already selected + ranked). */
  winners: WinnerPost[]
  /** Recent post texts, used only to avoid repeating themes. */
  recentTexts: string[]
  /** Idea titles/hooks the team has APPROVED — the model leans toward these. */
  approvedExamples?: string[]
  /** Idea titles/hooks the team has REJECTED — the model steers away from these. */
  rejectedExamples?: string[]
}

/** Senior-strategist playbook baked into every generation. */
export const MARKETING_FRAMEWORKS = `MARKETING PLAYBOOK (apply like a senior strategist):
- Lead with a SCROLL-STOPPING hook in the first 1-2 seconds / first line. Use proven hook shapes: bold claim, curiosity gap, relatable callout, "stop doing X", before/after, or a question that hits a real pain.
- Structure copy with a framework: AIDA (Attention-Interest-Desire-Action) or PAS (Problem-Agitate-Solve). Never bury the value.
- Every idea must serve ONE clear objective and funnel stage:
  · Awareness (reach new people — trend-jacking, relatable/shareable)
  · Engagement (saves/comments/shares — value, education, "send this to…")
  · Conversion (DMs/clicks/bookings — offer, proof, clear CTA).
- Reels: hook in frame 1, fast pacing, on-trend audio, a reason to rewatch. Carousels: a swipe-worthy cover + one idea per slide + a payoff at the end. Static: a single sharp message.
- End with ONE specific, low-friction CTA — never a vague "link in bio" without a reason to click.`

/** Puerto Rico cultural lens so ideas feel native, not translated. */
export const PR_CULTURAL_LENS = `PUERTO RICAN CULTURAL LENS (make ideas feel local and native, never generic or translated):
- Write in natural Puerto Rican Spanish (warm, expressive), code-switching to English only where it reads authentic.
- Tap local rhythm: holidays and seasons (Navidades that run Nov–Jan & Reyes/octavitas, Cuaresma & Semana Santa, verano/playa, regreso a clases, temporada navideña), paydays (la quincena), and weekend culture.
- Lean on shared references where they fit the brand: música (reggaetón, salsa, Bad Bunny), comida (mofongo, lechón, café, frituras), lugares (El Yunque, Viejo San Juan, la playa), and everyday "boricua" humor and pride.
- Mind the realities: weather/heat, hurricane-season preparedness, and a tight-knit community that rewards authenticity over corporate polish.
- Don't force it — a reference must earn its place by making the idea sharper, funnier, or more relatable.`

function engagementScore(p: PerfPost): number {
  const interactions = (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0)
  if (p.engagement && p.engagement > 0) return p.engagement
  if (interactions > 0) return interactions
  return p.reach ?? 0
}

/**
 * Rank published posts by engagement and return the top `n` with non-trivial
 * copy. This is what makes ideas "performance-aware": the model learns from what
 * actually resonated instead of guessing.
 */
export function selectTopPosts(posts: PerfPost[], n: number): WinnerPost[] {
  if (!Array.isArray(posts)) return []
  return posts
    .filter((p) => typeof p.text === 'string' && p.text.trim().length > 20)
    .map((p) => ({
      text: p.text.trim().slice(0, 220),
      score: engagementScore(p),
      likes: p.likes,
      comments: p.comments,
    }))
    .filter((w) => w.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
}

export function formatWinnersForPrompt(winners: WinnerPost[]): string {
  if (!winners || winners.length === 0) return ''
  const lines = winners
    .map((w, i) => {
      const stats = [
        w.likes != null ? `❤ ${w.likes}` : null,
        w.comments != null ? `💬 ${w.comments}` : null,
      ]
        .filter(Boolean)
        .join(' ')
      return `${i + 1}. ${w.text}${stats ? ` (${stats})` : ''}`
    })
    .join('\n')
  return `TOP-PERFORMING POSTS (these resonated most with this audience — study WHY they worked, then beat them):\n${lines}`
}

/**
 * The learning loop: render the team's past approvals/rejections so the model
 * self-educates on the agency's taste over time. Returns '' when there's no
 * feedback yet.
 */
export function formatFeedbackForPrompt(approved: string[], rejected: string[]): string {
  const parts: string[] = []
  if (approved && approved.length > 0) {
    parts.push(
      `IDEAS THE TEAM APPROVED (this is the taste to match — generate MORE in this spirit):\n${approved.map((t) => `- ${t}`).join('\n')}`
    )
  }
  if (rejected && rejected.length > 0) {
    parts.push(
      `IDEAS THE TEAM REJECTED (learn from these — do NOT repeat this style or angle):\n${rejected.map((t) => `- ${t}`).join('\n')}`
    )
  }
  return parts.join('\n\n')
}

const JSON_SCHEMA = `Output STRICT JSON — an array, no markdown, no commentary, no code fence:
[
  {
    "content_type": "R" | "P" | "C" | "S",
    "objective": "Awareness" | "Engagement" | "Conversion",
    "funnel_stage": "TOFU" | "MOFU" | "BOFU",
    "title": "Short 6-8 word title in Spanish",
    "hook": "Scroll-stopping first 1-2 sentences in Puerto Rican Spanish",
    "visual_brief": "Concrete visual direction for the designer/editor: shots, composition, colors, lighting, mood, on-screen text. 2-4 sentences in Spanish.",
    "caption_angle": "Tone, copy framework (AIDA/PAS), and CTA direction for the copywriter. 1-2 sentences in Spanish.",
    "hashtags_suggestion": "5-8 hashtags relevant to this idea + audience",
    "rationale": "Why this idea works and why now — tie to the objective. 1 sentence in Spanish."
  }
]`

/** Build the first-pass generation prompt from live inputs. */
export function buildGenerationPrompt(input: IdeaGenInput): string {
  const { count, general, clientName, industry, clientProfile, theme, trends, typeLabels, winners, recentTexts } = input

  const trendsBlock = trends.length > 0
    ? `TRENDS TO RIDE (work these current trends in where natural — don't force them):\n${trends.map((t) => `- ${t}`).join('\n')}`
    : ''
  const winnersBlock = formatWinnersForPrompt(winners)
  const feedbackBlock = formatFeedbackForPrompt(input.approvedExamples ?? [], input.rejectedExamples ?? [])
  const recentBlock = recentTexts.length > 0
    ? `RECENT POSTS (avoid repeating these themes — bring fresh angles):\n${recentTexts.map((p, i) => `${i + 1}. ${p}`).join('\n')}`
    : 'No recent post history available.'

  return `You are a creative director at NMedia PR, an elite Puerto Rican social media agency. Generate ${count} content ideas ${general ? 'for a marketing brainstorming session' : 'for this client'}.

${general
    ? 'MODE: General marketing brainstorming (not tied to a specific client).'
    : `CLIENT: ${clientName}\nINDUSTRY: ${industry || 'Business'}`}
${clientProfile ? `\nCLIENT PROFILE:\n${clientProfile}\n` : ''}${theme ? `\nBRIEF / THEME: ${theme}\n` : ''}${trendsBlock ? `\n${trendsBlock}\n` : ''}${winnersBlock ? `\n${winnersBlock}\n` : ''}${feedbackBlock ? `\n${feedbackBlock}\n` : ''}
ALLOWED CONTENT TYPES: ${typeLabels.join(', ')}

${recentBlock}

${MARKETING_FRAMEWORKS}

${PR_CULTURAL_LENS}

TASK: Generate ${count} DIFFERENT, specific, executable content ideas. Mix the allowed content types. Each must have a clear objective and funnel stage, a scroll-stopping hook, and a concrete visual brief${general ? '' : " tailored to this client's voice and industry"}.

${JSON_SCHEMA}

Rules:
- Each idea UNIQUE in concept (don't suggest 3 reels on the same topic).
- The hook must stop the scroll — no generic openers.
- visual_brief must give the designer something concrete: colors, shots, composition, props, on-screen text.
- Output ONLY the JSON array. No prose, no \`\`\`json fence, nothing else.`
}

/**
 * Build the second-pass critique prompt. A skeptical creative director scores
 * the first-pass ideas and rewrites the weak ones — this is the step that
 * separates "AI slop" from genuinely sharp work.
 */
export function buildCritiquePrompt(ideasJson: string, input: IdeaGenInput): string {
  return `You are a SKEPTICAL, world-class creative director reviewing a first draft of ${input.count} content ideas for ${input.general ? 'a brainstorming session' : input.clientName}. Be demanding.

FIRST DRAFT:
${ideasJson}

For EACH idea, silently judge:
- Hook: does it actually stop the scroll, or is it generic? (rewrite if weak)
- Objective fit: is the objective + funnel_stage right and is the CTA aligned to it?
- Distinctiveness: would a competitor post the same thing? Make it sharper and more specific.
- Local resonance: does it feel authentically Puerto Rican where relevant (without forcing it)?
- Executability: is the visual_brief concrete enough to shoot/design today?

Then RETURN the improved set — same JSON schema, same number of ideas — rewriting hooks, briefs, and CTAs wherever they fall short. Keep the strong ones, sharpen the rest.

${JSON_SCHEMA}

Output ONLY the JSON array. No prose, no code fence.`
}
