# Ideación Client Rows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Ideación shows clients as rows; each client lists its videos with both dates and a 7-segment status bar (Idea→Caption→Agendada→Grabación→Edición→Aprobación→Publicado).

**Architecture:** A pure `computeIdeaPipeline()` derives the 7 stages from existing data + a `recordingScheduled` flag. `getIdeacionPipeline()` returns the enriched flat idea list (joins recording_session + videos); the board groups by client client-side (preserving its filters/stats/modals) and renders rows with a segmented status bar.

**Tech Stack:** Next.js 14, Supabase, TypeScript, Tailwind, Vitest + RTL.

> **Refinement vs spec:** the loader returns an enriched **flat** `IdeaWithPipeline[]` (not pre-grouped) so the board keeps its existing flat `ideas` state (filters, stats, generate/assign modals, optimistic updates); the board groups by client at render. Same user-facing behavior.

---

### Task 1: Pipeline stage helper

**Files:** Create `lib/utils/idea-pipeline-stages.ts`; Test `lib/utils/idea-pipeline-stages.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { computeIdeaPipeline } from './idea-pipeline-stages'
import type { ContentIdea, ContentIdeaVideo } from '@/lib/supabase/types'

const base = {
  hook: 'h', visual_brief: 'b', generated_caption: 'c', status: 'idea',
  approval_status: 'pending', published_at: null, recording_session_id: null, recording_date: null,
} as Pick<ContentIdea, 'hook'|'visual_brief'|'generated_caption'|'status'|'approval_status'|'published_at'|'recording_session_id'|'recording_date'>

const raw = { kind: 'raw', status: 'uploaded' } as ContentIdeaVideo
const edited = { kind: 'edited', status: 'uploaded' } as ContentIdeaVideo

describe('computeIdeaPipeline', () => {
  it('returns the 7 stages in order', () => {
    const p = computeIdeaPipeline({ idea: base, videos: [], recordingScheduled: false })
    expect(p.stages.map((s) => s.key)).toEqual(['idea','caption','scheduled','recorded','edited','approval','published'])
    expect(p.stages.length).toBe(7)
  })
  it('idea done needs hook + visual_brief', () => {
    expect(computeIdeaPipeline({ idea: base, videos: [], recordingScheduled: false }).stages[0].done).toBe(true)
    expect(computeIdeaPipeline({ idea: { ...base, visual_brief: null }, videos: [], recordingScheduled: false }).stages[0].done).toBe(false)
  })
  it('scheduled reflects recordingScheduled', () => {
    expect(computeIdeaPipeline({ idea: base, videos: [], recordingScheduled: true }).stages[2].done).toBe(true)
    expect(computeIdeaPipeline({ idea: base, videos: [], recordingScheduled: false }).stages[2].done).toBe(false)
  })
  it('recorded done via status, recording_date, or active raw', () => {
    expect(computeIdeaPipeline({ idea: { ...base, status: 'grabada' }, videos: [], recordingScheduled: false }).stages[3].done).toBe(true)
    expect(computeIdeaPipeline({ idea: { ...base, recording_date: '2026-05-01' }, videos: [], recordingScheduled: false }).stages[3].done).toBe(true)
    expect(computeIdeaPipeline({ idea: base, videos: [raw], recordingScheduled: false }).stages[3].done).toBe(true)
    expect(computeIdeaPipeline({ idea: base, videos: [{ ...raw, status: 'archived' }], recordingScheduled: false }).stages[3].done).toBe(false)
  })
  it('edited done via active edited or producida', () => {
    expect(computeIdeaPipeline({ idea: base, videos: [edited], recordingScheduled: false }).stages[4].done).toBe(true)
    expect(computeIdeaPipeline({ idea: { ...base, status: 'producida' }, videos: [], recordingScheduled: false }).stages[4].done).toBe(true)
  })
  it('approval + published', () => {
    expect(computeIdeaPipeline({ idea: { ...base, approval_status: 'approved' }, videos: [], recordingScheduled: false }).stages[5].done).toBe(true)
    expect(computeIdeaPipeline({ idea: { ...base, published_at: '2026-05-01' }, videos: [], recordingScheduled: false }).stages[6].done).toBe(true)
    expect(computeIdeaPipeline({ idea: { ...base, status: 'publicada' }, videos: [], recordingScheduled: false }).stages[6].done).toBe(true)
  })
  it('currentIndex is the first not-done; percent reflects completed', () => {
    const p = computeIdeaPipeline({ idea: base, videos: [], recordingScheduled: false }) // only idea+caption done
    expect(p.currentIndex).toBe(2)
    expect(p.completed).toBe(2)
    expect(p.percent).toBe(Math.round((2/7)*100))
  })
})
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run lib/utils/idea-pipeline-stages.test.ts` → FAIL.

- [ ] **Step 3: Implement `lib/utils/idea-pipeline-stages.ts`**

```ts
import type { ContentIdea, ContentIdeaVideo } from '@/lib/supabase/types'

export type PipelineStageKey =
  | 'idea' | 'caption' | 'scheduled' | 'recorded' | 'edited' | 'approval' | 'published'

export interface PipelineStage { key: PipelineStageKey; label: string; done: boolean }

export interface IdeaPipeline {
  stages: PipelineStage[]
  currentIndex: number
  completed: number
  percent: number
}

const ACTIVE: ReadonlySet<ContentIdeaVideo['status']> = new Set<ContentIdeaVideo['status']>([
  'uploading', 'uploaded', 'processing',
])

type PipelineIdea = Pick<
  ContentIdea,
  'hook' | 'visual_brief' | 'generated_caption' | 'status' | 'approval_status'
  | 'published_at' | 'recording_session_id' | 'recording_date'
>

export function computeIdeaPipeline(input: {
  idea: PipelineIdea
  videos: ContentIdeaVideo[]
  recordingScheduled: boolean
}): IdeaPipeline {
  const { idea, videos, recordingScheduled } = input
  const filled = (s?: string | null) => !!s && s.trim().length > 0
  const activeOf = (kind: ContentIdeaVideo['kind']) =>
    videos.some((v) => v.kind === kind && ACTIVE.has(v.status))

  const stages: PipelineStage[] = [
    { key: 'idea', label: 'Idea', done: filled(idea.hook) && filled(idea.visual_brief) },
    { key: 'caption', label: 'Caption', done: filled(idea.generated_caption) },
    { key: 'scheduled', label: 'Agendada', done: recordingScheduled || idea.recording_session_id != null },
    { key: 'recorded', label: 'Grabación', done: idea.status === 'grabada' || idea.recording_date != null || activeOf('raw') },
    { key: 'edited', label: 'Edición', done: activeOf('edited') || idea.status === 'producida' },
    { key: 'approval', label: 'Aprobación', done: idea.approval_status === 'approved' },
    { key: 'published', label: 'Publicado', done: idea.published_at != null || idea.status === 'publicada' },
  ]

  const completed = stages.filter((s) => s.done).length
  const firstNotDone = stages.findIndex((s) => !s.done)
  return {
    stages,
    currentIndex: firstNotDone === -1 ? stages.length : firstNotDone,
    completed,
    percent: Math.round((completed / stages.length) * 100),
  }
}
```

- [ ] **Step 4: Run, verify pass** — `npx vitest run lib/utils/idea-pipeline-stages.test.ts` → PASS.

- [ ] **Step 5: Commit** — `git add lib/utils/idea-pipeline-stages.ts lib/utils/idea-pipeline-stages.test.ts && git commit -m "feat: idea pipeline stage helper (7 stages incl. agendada)"`

---

### Task 2: Enriched loader

**Files:** Modify `lib/actions/content-ideas.ts`; Modify `lib/supabase/types.ts`

- [ ] **Step 1: Add the enriched type** to `lib/supabase/types.ts`:

```ts
export interface IdeaWithPipeline extends ContentIdea {
  recordingScheduled: boolean
  videos: ContentIdeaVideo[]
}
```

- [ ] **Step 2: Add `getIdeacionPipeline`** to `lib/actions/content-ideas.ts` (after `getContentIdeas`):

```ts
import type { ContentIdeaVideo, IdeaWithPipeline } from '@/lib/supabase/types'

export async function getIdeacionPipeline(filter?: {
  clientId?: string
  limit?: number
}): Promise<IdeaWithPipeline[]> {
  const supabase = await createClient()
  let query = supabase
    .from('content_ideas')
    .select(`
      *,
      client:clients!content_ideas_client_id_fkey(id, name, industry, logo_url, platforms),
      recording_session:recording_sessions!content_ideas_recording_session_id_fkey(status),
      videos:content_idea_videos!content_idea_videos_idea_id_fkey(*)
    `)
    .order('created_at', { ascending: false })
    .limit(filter?.limit ?? 300)
  if (filter?.clientId) query = query.eq('client_id', filter.clientId)

  const { data, error } = await query
  if (error) {
    console.warn('[content-ideas] pipeline fetch failed:', error.message)
    return []
  }
  return (data ?? []).map((row) => {
    const r = row as unknown as ContentIdea & {
      recording_session?: { status?: string } | null
      videos?: ContentIdeaVideo[] | null
    }
    const sessionStatus = r.recording_session?.status
    return {
      ...(r as ContentIdea),
      recordingScheduled:
        r.recording_session_id != null && (sessionStatus === 'scheduled' || sessionStatus === 'completed'),
      videos: (r.videos ?? []) as ContentIdeaVideo[],
    }
  })
}
```

- [ ] **Step 3: Verify** — `npx tsc --noEmit` → clean.

- [ ] **Step 4: Commit** — `git add lib/actions/content-ideas.ts lib/supabase/types.ts && git commit -m "feat: getIdeacionPipeline loader (recording session + videos) + IdeaWithPipeline type"`

> Note: confirm the FK constraint name `content_ideas_recording_session_id_fkey` during Step 3; if the embed errors at runtime, adjust the alias. `recordingScheduled` already falls back to the `recording_session_id != null` check in the helper.

---

### Task 3: Segmented status bar

**Files:** Create `components/ideas/idea-status-bar.tsx`; Test `components/ideas/idea-status-bar.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IdeaStatusBar } from './idea-status-bar'
import type { IdeaPipeline } from '@/lib/utils/idea-pipeline-stages'

const pipeline: IdeaPipeline = {
  stages: [
    { key: 'idea', label: 'Idea', done: true },
    { key: 'caption', label: 'Caption', done: true },
    { key: 'scheduled', label: 'Agendada', done: false },
    { key: 'recorded', label: 'Grabación', done: false },
    { key: 'edited', label: 'Edición', done: false },
    { key: 'approval', label: 'Aprobación', done: false },
    { key: 'published', label: 'Publicado', done: false },
  ],
  currentIndex: 2, completed: 2, percent: 29,
}

describe('IdeaStatusBar', () => {
  it('renders a segment per stage and names the current stage', () => {
    render(<IdeaStatusBar pipeline={pipeline} />)
    const segs = screen.getAllByTestId('stage-segment')
    expect(segs).toHaveLength(7)
    expect(screen.getByText('Agendada')).toBeInTheDocument() // current stage label
  })
  it('shows "Publicado" as current label when complete', () => {
    const done = { ...pipeline, stages: pipeline.stages.map((s) => ({ ...s, done: true })), currentIndex: 7, completed: 7, percent: 100 }
    render(<IdeaStatusBar pipeline={done} />)
    expect(screen.getByText(/Publicado|Completado/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run components/ideas/idea-status-bar.test.tsx` → FAIL.

- [ ] **Step 3: Implement `components/ideas/idea-status-bar.tsx`**

```tsx
import { cn } from '@/lib/utils'
import type { IdeaPipeline } from '@/lib/utils/idea-pipeline-stages'

export function IdeaStatusBar({ pipeline }: { pipeline: IdeaPipeline }) {
  const { stages, currentIndex, completed } = pipeline
  const current = currentIndex < stages.length ? stages[currentIndex] : null
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1">
        {stages.map((s, i) => (
          <span
            key={s.key}
            data-testid="stage-segment"
            title={s.label}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors',
              s.done ? 'bg-emerald-500' : i === currentIndex ? 'bg-primary animate-pulse' : 'bg-muted',
            )}
          />
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {current ? <>En <span className="font-medium text-foreground">{current.label}</span></> : 'Completado'}
        <span className="tabular-nums"> · {completed}/{stages.length}</span>
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Run, verify pass** — `npx vitest run components/ideas/idea-status-bar.test.tsx` → PASS.

- [ ] **Step 5: Commit** — `git add components/ideas/idea-status-bar.tsx components/ideas/idea-status-bar.test.tsx && git commit -m "feat: segmented idea status bar"`

---

### Task 4: Client rows layout

**Files:** Create `components/ideas/client-ideas-rows.tsx`; Test `components/ideas/client-ideas-rows.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ClientIdeasRows } from './client-ideas-rows'
import type { IdeaWithPipeline } from '@/lib/supabase/types'

function idea(over: Partial<IdeaWithPipeline> = {}): IdeaWithPipeline {
  return {
    id: 'i1', client_id: 'c1', content_type: 'R', title: 'Reel 1', hook: 'h', visual_brief: 'b',
    caption_angle: null, hashtags_suggestion: null, rationale: null, status: 'idea',
    production_task_id: null, recording_session_id: null, theme: null, generation_prompt: null,
    model: null, generated_caption: null, caption_platform: null, caption_generated_at: null,
    published_at: null, approval_status: 'pending', approved_by: null, approved_at: null,
    submitted_at: null, recording_date: '2026-05-10', publish_date: '2026-05-15',
    created_by: null, created_at: '', updated_at: '',
    client: { id: 'c1', name: 'Acme', industry: null } as any,
    recordingScheduled: false, videos: [],
    ...over,
  } as IdeaWithPipeline
}

describe('ClientIdeasRows', () => {
  it('groups ideas by client and renders a row per video', () => {
    render(<ClientIdeasRows ideas={[idea(), idea({ id: 'i2', title: 'Reel 2' })]} />)
    expect(screen.getByText('Acme')).toBeInTheDocument()
    expect(screen.getByText('Reel 1')).toBeInTheDocument()
    expect(screen.getByText('Reel 2')).toBeInTheDocument()
  })
  it('shows both dates per video', () => {
    render(<ClientIdeasRows ideas={[idea()]} />)
    expect(screen.getByText(/10/)).toBeInTheDocument()  // recording date day
    expect(screen.getByText(/15/)).toBeInTheDocument()  // publish date day
  })
})
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run components/ideas/client-ideas-rows.test.tsx` → FAIL.

- [ ] **Step 3: Implement `components/ideas/client-ideas-rows.tsx`** — a client component. Group `ideas` by `client_id` (preserve order; client meta from `idea.client` + `idea.client.logo_url`). Render each client as a section: header (`ClientLogo` from `@/components/clients/client-logo` + name + count). Inside, one row per idea: type badge (R/P/C/S), `<Link href={\`/produccion/idea/${idea.id}\`}>` title, both dates (recording 🎥 + publish 📅, "—" when null, parse date-only as local via `new Date(d + 'T00:00:00')`), and `<IdeaStatusBar pipeline={computeIdeaPipeline({ idea, videos: idea.videos, recordingScheduled: idea.recordingScheduled })} />`. Follow the responsive row pattern (flex-wrap, min-w-0, truncate title). Empty per-client message when a client has no ideas (not expected from grouping, but guard).

- [ ] **Step 4: Run, verify pass** — `npx vitest run components/ideas/client-ideas-rows.test.tsx` → PASS.

- [ ] **Step 5: Commit** — `git add components/ideas/client-ideas-rows.tsx components/ideas/client-ideas-rows.test.tsx && git commit -m "feat: client-grouped idea rows with status bar"`

---

### Task 5: Wire into the board + page

**Files:** Modify `components/ideas/ideacion-board.tsx`; Modify `app/(dashboard)/ideacion/page.tsx`

- [ ] **Step 1: Page loads the enriched list.** In `app/(dashboard)/ideacion/page.tsx`, replace `getContentIdeas({ limit: 200 })` with `getIdeacionPipeline({ limit: 300 })`; pass as `initialIdeas`. Import from `@/lib/actions/content-ideas`.

- [ ] **Step 2: Board uses `IdeaWithPipeline` + rows.** In `components/ideas/ideacion-board.tsx`:
  - Change `Props.initialIdeas` and `ideas` state type to `IdeaWithPipeline[]`.
  - `handleIdeasGenerated`: map new `ContentIdea`s to `IdeaWithPipeline` with `{ recordingScheduled: false, videos: [] }` before prepending.
  - Replace the `<div className="grid ...">{filtered.map(IdeaCard)}</div>` block with `<ClientIdeasRows ideas={filtered} />` (keep the `filtered.length === 0` EmptyState branch and the header/filters/modals exactly as they are).
  - Keep `IdeaCard` import only if still used elsewhere; otherwise remove it. The `AssignToProductionModal`/`GenerateIdeasModal` and `onUpdate/onDelete/onAssign` paths stay; `ClientIdeasRows` links to the workspace for editing (no per-row assign modal in this version — note for follow-up).

- [ ] **Step 3: Verify** — `npx tsc --noEmit` → clean.

- [ ] **Step 4: Commit** — `git add "app/(dashboard)/ideacion/page.tsx" components/ideas/ideacion-board.tsx && git commit -m "feat: Ideación as client rows with per-video status bar"`

---

### Task 6: Full verification

- [ ] `npx tsc --noEmit` → exit 0
- [ ] `npx vitest run` → all pass
- [ ] Stop any dev server on this worktree, then `npm run build` → exit 0
- [ ] Commit any fixes.
