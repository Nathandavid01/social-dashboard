# Idea Stage Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make per-idea pipeline progress quantitative and visible — counts on timeline pills, a global progress bar with "what's missing", and stage chips on the `/video-reviews` cards.

**Architecture:** A single pure helper `computeIdeaProgress()` derives 7 stages + an overall summary from existing data (no migration). It feeds three surfaces: the timeline, a new progress bar, and the video cards.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind, Vitest + RTL.

---

### Task 1: Pure progress helper

**Files:**
- Create: `lib/utils/idea-progress.ts`
- Test: `lib/utils/idea-progress.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { computeIdeaProgress } from './idea-progress'
import type { ContentIdea, ContentIdeaVideo } from '@/lib/supabase/types'

const baseIdea = {
  hook: 'h', visual_brief: 'b', generated_caption: 'c',
  approval_status: 'approved', published_at: '2026-05-01T00:00:00Z',
} as Pick<ContentIdea, 'hook' | 'visual_brief' | 'generated_caption' | 'approval_status' | 'published_at'>

function vid(kind: ContentIdeaVideo['kind'], status: ContentIdeaVideo['status'] = 'uploaded') {
  return { kind, status } as ContentIdeaVideo
}

describe('computeIdeaProgress', () => {
  it('marks all 7 stages done when everything is complete', () => {
    const p = computeIdeaProgress({ idea: baseIdea, videos: [vid('raw'), vid('edited')], assetCount: 1 })
    expect(p.total).toBe(7)
    expect(p.completed).toBe(7)
    expect(p.percent).toBe(100)
    expect(p.missing).toEqual([])
    expect(p.stages.map((s) => s.key)).toEqual(['idea','caption','material','edited','assets','approval','published'])
  })

  it('idea stage needs both hook and visual_brief', () => {
    const p = computeIdeaProgress({ idea: { ...baseIdea, visual_brief: null }, videos: [], assetCount: 0 })
    expect(p.stages.find((s) => s.key === 'idea')!.done).toBe(false)
  })

  it('treats whitespace-only caption as not done', () => {
    const p = computeIdeaProgress({ idea: { ...baseIdea, generated_caption: '   ' }, videos: [], assetCount: 0 })
    expect(p.stages.find((s) => s.key === 'caption')!.done).toBe(false)
  })

  it('material done at >=1 active raw; archived/failed do not count', () => {
    const done = computeIdeaProgress({ idea: baseIdea, videos: [vid('raw')], assetCount: 0 })
    expect(done.stages.find((s) => s.key === 'material')!.done).toBe(true)
    const archived = computeIdeaProgress({ idea: baseIdea, videos: [vid('raw', 'archived')], assetCount: 0 })
    const mat = archived.stages.find((s) => s.key === 'material')!
    expect(mat.done).toBe(false)
    expect(mat.count).toEqual({ current: 0, total: 4 })
  })

  it('edited stage counts active edited n/2', () => {
    const p = computeIdeaProgress({ idea: baseIdea, videos: [vid('edited'), vid('edited')], assetCount: 0 })
    expect(p.stages.find((s) => s.key === 'edited')!.count).toEqual({ current: 2, total: 2 })
  })

  it('assets done when assetCount >= 1', () => {
    expect(computeIdeaProgress({ idea: baseIdea, videos: [], assetCount: 0 }).stages.find((s) => s.key === 'assets')!.done).toBe(false)
    expect(computeIdeaProgress({ idea: baseIdea, videos: [], assetCount: 3 }).stages.find((s) => s.key === 'assets')!.done).toBe(true)
  })

  it('approval reflects sub-state and is done only when approved', () => {
    const rev = computeIdeaProgress({ idea: { ...baseIdea, approval_status: 'revision_needed' }, videos: [], assetCount: 0 })
    const a = rev.stages.find((s) => s.key === 'approval')!
    expect(a.done).toBe(false)
    expect(a.detail).toBe('Cambios pedidos')
  })

  it('published done by published_at independent of earlier stages', () => {
    const p = computeIdeaProgress({ idea: { hook: null, visual_brief: null, generated_caption: null, approval_status: 'pending', published_at: '2026-05-01' }, videos: [], assetCount: 0 })
    expect(p.stages.find((s) => s.key === 'published')!.done).toBe(true)
    expect(p.missing).toContain('Idea')
  })

  it('counts above the min are not capped in the count', () => {
    const p = computeIdeaProgress({ idea: baseIdea, videos: [vid('raw'), vid('raw'), vid('raw'), vid('raw'), vid('raw')], assetCount: 0 })
    expect(p.stages.find((s) => s.key === 'material')!.count).toEqual({ current: 5, total: 4 })
    expect(p.percent).toBeLessThanOrEqual(100)
  })
})
```

- [ ] **Step 2: Run, verify it fails** — `npx vitest run lib/utils/idea-progress.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement `lib/utils/idea-progress.ts`**

```ts
import type { ContentIdea, ContentIdeaVideo, ContentIdeaVideoKind, IdeaApprovalStatus } from '@/lib/supabase/types'

export type StageKey = 'idea' | 'caption' | 'material' | 'edited' | 'assets' | 'approval' | 'published'

export interface StageProgress {
  key: StageKey
  label: string
  done: boolean
  count?: { current: number; total: number }
  detail?: string
}

export interface IdeaProgress {
  stages: StageProgress[]
  completed: number
  total: number
  percent: number
  missing: string[]
}

const MIN: Record<ContentIdeaVideoKind, number> = { raw: 4, broll: 4, edited: 2 }
const ACTIVE: ReadonlySet<ContentIdeaVideo['status']> = new Set(['uploading', 'uploaded', 'processing'])

const APPROVAL_DETAIL: Record<IdeaApprovalStatus, string> = {
  pending: 'Sin enviar',
  submitted: 'En revisión',
  approved: 'Aprobado',
  revision_needed: 'Cambios pedidos',
}

type ProgressIdea = Pick<ContentIdea, 'hook' | 'visual_brief' | 'generated_caption' | 'approval_status' | 'published_at'>

export function computeIdeaProgress(input: {
  idea: ProgressIdea
  videos: ContentIdeaVideo[]
  assetCount: number
}): IdeaProgress {
  const { idea, videos, assetCount } = input
  const active = (kind: ContentIdeaVideoKind) =>
    videos.filter((v) => v.kind === kind && ACTIVE.has(v.status)).length

  const rawN = active('raw')
  const editedN = active('edited')
  const filled = (s?: string | null) => !!s && s.trim().length > 0

  const stages: StageProgress[] = [
    { key: 'idea', label: 'Idea', done: filled(idea.hook) && filled(idea.visual_brief) },
    { key: 'caption', label: 'Caption', done: filled(idea.generated_caption) },
    { key: 'material', label: 'Material', done: rawN >= 1, count: { current: rawN, total: MIN.raw } },
    { key: 'edited', label: 'Editado', done: editedN >= 1, count: { current: editedN, total: MIN.edited } },
    { key: 'assets', label: 'Assets', done: assetCount >= 1, count: { current: assetCount, total: 1 } },
    { key: 'approval', label: 'Aprobación', done: idea.approval_status === 'approved', detail: APPROVAL_DETAIL[idea.approval_status] },
    { key: 'published', label: 'Publicado', done: idea.published_at != null },
  ]

  const completed = stages.filter((s) => s.done).length
  const total = stages.length
  return {
    stages,
    completed,
    total,
    percent: Math.min(100, Math.round((completed / total) * 100)),
    missing: stages.filter((s) => !s.done).map((s) => s.label),
  }
}
```

- [ ] **Step 4: Run, verify pass** — `npx vitest run lib/utils/idea-progress.test.ts` → PASS.

- [ ] **Step 5: Commit** — `git add lib/utils/idea-progress.ts lib/utils/idea-progress.test.ts && git commit -m "feat: idea stage progress helper"`

---

### Task 2: Timeline shows counts + new icons

**Files:**
- Modify: `components/produccion/pipeline-timeline.tsx`

- [ ] **Step 1: Extend the type + icons.** Add `'approval'` and `'published'` to the `icon` union and `ICONS` map (import `CheckCircle2`, `Megaphone` from lucide-react). Add optional fields:

```ts
export interface TimelineStage {
  id: string
  label: string
  icon: 'idea' | 'caption' | 'material' | 'edited' | 'assets' | 'approval' | 'published'
  done: boolean
  count?: { current: number; total: number }
  detail?: string
}
```

```ts
const ICONS: Record<TimelineStage['icon'], LucideIcon> = {
  idea: Lightbulb, caption: Sparkles, material: Scissors, assets: Palette,
  edited: Clapperboard, approval: CheckCircle2, published: Megaphone,
}
```

- [ ] **Step 2: Render the count/detail** next to the label inside the button (after the `<span>{s.label}</span>`):

```tsx
{s.count && (
  <span className="tabular-nums opacity-80">{s.count.current}/{s.count.total}</span>
)}
{s.detail && !s.count && (
  <span className="opacity-70">· {s.detail}</span>
)}
```

- [ ] **Step 3: Verify types** — `npx tsc --noEmit` → clean.

- [ ] **Step 4: Commit** — `git add components/produccion/pipeline-timeline.tsx && git commit -m "feat: timeline pills show stage counts + approval/published"`

---

### Task 3: Global progress bar component

**Files:**
- Create: `components/produccion/idea-progress-bar.tsx`
- Test: `components/produccion/idea-progress-bar.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IdeaProgressBar } from './idea-progress-bar'
import type { IdeaProgress } from '@/lib/utils/idea-progress'

const progress: IdeaProgress = {
  stages: [], completed: 4, total: 7, percent: 57, missing: ['Caption', 'Editado'],
}

describe('IdeaProgressBar', () => {
  it('shows percent, count and what is missing', () => {
    render(<IdeaProgressBar progress={progress} />)
    expect(screen.getByText(/57%/)).toBeInTheDocument()
    expect(screen.getByText(/4\/7 etapas/)).toBeInTheDocument()
    expect(screen.getByText(/Caption/)).toBeInTheDocument()
    expect(screen.getByText(/Editado/)).toBeInTheDocument()
  })

  it('shows a done message when nothing is missing', () => {
    render(<IdeaProgressBar progress={{ ...progress, completed: 7, percent: 100, missing: [] }} />)
    expect(screen.getByText(/100%/)).toBeInTheDocument()
    expect(screen.getByText(/completo/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run, verify it fails** — `npx vitest run components/produccion/idea-progress-bar.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

```tsx
'use client'

import { cn } from '@/lib/utils'
import type { IdeaProgress } from '@/lib/utils/idea-progress'

export function IdeaProgressBar({ progress }: { progress: IdeaProgress }) {
  const { percent, completed, total, missing } = progress
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
        <span className="font-semibold">{percent}%</span>
        <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">{completed}/{total} etapas</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full bg-primary transition-all', percent === 100 && 'bg-green-500')}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {missing.length === 0 ? '✓ Pipeline completo' : <>Falta: {missing.join(', ')}</>}
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Run, verify pass** — `npx vitest run components/produccion/idea-progress-bar.test.tsx` → PASS.

- [ ] **Step 5: Commit** — `git add components/produccion/idea-progress-bar.tsx components/produccion/idea-progress-bar.test.tsx && git commit -m "feat: idea progress bar component"`

---

### Task 4: Wire progress into the idea workspace

**Files:**
- Modify: `app/(dashboard)/produccion/idea/[ideaId]/page.tsx`

- [ ] **Step 1: Replace the hardcoded timeline + add the bar.** Import `computeIdeaProgress` and `IdeaProgressBar`. After `const vids = videos as ContentIdeaVideo[]`, compute progress and map to timeline stages:

```tsx
const progress = computeIdeaProgress({ idea, videos: vids, assetCount: (assets as ClientAsset[]).length })
const ICON_BY_KEY = { idea: 'idea', caption: 'caption', material: 'material', edited: 'edited', assets: 'assets', approval: 'approval', published: 'published' } as const
const ANCHOR_BY_KEY: Record<string, string> = { idea: 'stage-idea', caption: 'stage-caption', material: 'stage-material', edited: 'stage-material', assets: 'stage-assets', approval: 'stage-assets', published: 'stage-assets' }
const timeline: TimelineStage[] = progress.stages.map((s) => ({
  id: ANCHOR_BY_KEY[s.key], label: s.label, icon: ICON_BY_KEY[s.key], done: s.done, count: s.count, detail: s.detail,
}))
```

- [ ] **Step 2: Render `<IdeaProgressBar progress={progress} />`** directly under `<PipelineTimeline stages={timeline} />`.

- [ ] **Step 3: Verify** — `npx tsc --noEmit` → clean.

- [ ] **Step 4: Commit** — `git add "app/(dashboard)/produccion/idea/[ideaId]/page.tsx" && git commit -m "feat: idea workspace shows stage counts + progress bar"`

---

### Task 5: Stage chips on the video cards

**Files:**
- Modify: `lib/actions/video-pipeline.ts` (add `assetCount` to `ClientVideoPipeline`)
- Modify: `components/video-pipeline/client-video-section.tsx` (pass `assetCount` to each card)
- Modify: `components/video-pipeline/video-card.tsx` (render chips)
- Test: `components/video-pipeline/video-card.test.tsx` (extend)

- [ ] **Step 1: Add `assetCount` to the loader.** In `lib/actions/video-pipeline.ts`, add `assetCount: number` to `ClientVideoPipeline` and set it in the final map: `assetCount: (assetsByClient.get(client.id) ?? []).length`.

- [ ] **Step 2: Pass it down.** In `client-video-section.tsx`, where it maps `<VideoCard video={...} />`, add `assetCount={assets.length}` (the section already receives `assets`).

- [ ] **Step 3: Write the failing test** in `video-card.test.tsx`:

```tsx
it('renders stage chips with counts', () => {
  render(<VideoCard video={makeVideoCard()} assetCount={2} />)
  expect(screen.getByText('Material')).toBeInTheDocument()
  // count chip like "1/4" appears for material
})
```

- [ ] **Step 4: Implement chips in `video-card.tsx`.** Accept `assetCount` prop (default 0). Compute `const progress = computeIdeaProgress({ idea: video, videos: [...video.videos.raw, ...video.videos.broll, ...video.videos.edited], assetCount })`. Render a compact row of chips above the slot summary:

```tsx
<div className="relative z-10 flex flex-wrap gap-1">
  {progress.stages.map((s) => (
    <span key={s.key} className={cn('inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px]', s.done ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground')}>
      {s.label}{s.count ? ` ${s.count.current}/${s.count.total}` : s.done ? ' ✓' : ''}
    </span>
  ))}
</div>
```

- [ ] **Step 5: Run tests** — `npx vitest run components/video-pipeline/video-card.test.tsx` → PASS.

- [ ] **Step 6: Commit** — `git add lib/actions/video-pipeline.ts components/video-pipeline/ && git commit -m "feat: stage progress chips on video cards"`

---

### Task 6: Full verification

- [ ] `npx tsc --noEmit` → exit 0
- [ ] `npx vitest run` → all pass
- [ ] `npm run build` → exit 0 (no `next dev` running on this worktree)
- [ ] Commit any fixes.
