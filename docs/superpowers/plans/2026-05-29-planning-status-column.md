# Planning Status Column Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Add a per-row STATUS column (7-segment pipeline bar) to the Planning 2-week plan table.

**Architecture:** Attach the linked idea's pipeline fields to each `ScheduleTask` (extend the planning page query), then render `<IdeaStatusBar>` (reusing `computeIdeaPipeline`) in a new STATUS column. Empty slots keep "Falta video", no bar. No migration.

**Tech Stack:** Next.js 14, Supabase, TypeScript, Tailwind, Vitest + RTL.

---

### Task 1: Carry the idea pipeline fields on each slot

**Files:** Modify `app/(dashboard)/planning/page.tsx`; Modify `components/planning/client-schedule.tsx` (type only)

- [ ] **Step 1: Extend the `ScheduleTask` type** in `components/planning/client-schedule.tsx` (top of file, near the existing interface):

```ts
import type { ContentIdea } from '@/lib/supabase/types'

export type ScheduleIdeaFields = Pick<
  ContentIdea,
  'hook' | 'visual_brief' | 'generated_caption' | 'status'
  | 'approval_status' | 'published_at' | 'recording_session_id' | 'recording_date'
>

export interface ScheduleTask {
  publishDate: string
  ideaId: string | null
  ideaTitle: string | null
  contentType: string | null
  hasCaption: boolean
  idea: ScheduleIdeaFields | null
}
```

- [ ] **Step 2: Extend the planning page query + build.** In `app/(dashboard)/planning/page.tsx`:
  - Change the content_ideas select (currently `select('id, title, generated_caption')`) to:
    `.select('id, title, generated_caption, hook, visual_brief, status, approval_status, published_at, recording_session_id, recording_date')`
  - Change the `ideaMap` value to store the full idea row, e.g. `ideaMap.set(i.id, i)`.
  - In the `ScheduleTask` build loop, add `idea: idea ? (idea as ScheduleIdeaFields) : null` (import the `ScheduleIdeaFields` type, or inline the fields). Keep `ideaTitle: idea?.title ?? null` and `hasCaption: !!idea?.generated_caption` reading from the stored row.

- [ ] **Step 3: Verify** — `npx tsc --noEmit` → clean.

- [ ] **Step 4: Commit** — `git add "app/(dashboard)/planning/page.tsx" components/planning/client-schedule.tsx && git commit -m "feat: carry idea pipeline fields on planning schedule slots"`

---

### Task 2: STATUS column with the segmented bar

**Files:** Modify `components/planning/client-schedule.tsx`; Test `components/planning/client-schedule.test.tsx`

- [ ] **Step 1: Write the failing test** (`components/planning/client-schedule.test.tsx`). Mock the caption action + toast; render `ClientSchedule` with one task that has an idea and assert the status bar + a "Falta video" row with no bar.

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ClientSchedule, type ScheduleTask } from './client-schedule'

vi.mock('@/lib/actions/idea-captions', () => ({ generateIdeaCaption: vi.fn() }))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

function task(over: Partial<ScheduleTask> = {}): ScheduleTask {
  return {
    publishDate: '2026-05-30', ideaId: 'i1', ideaTitle: 'Reel', contentType: 'R', hasCaption: false,
    idea: {
      hook: 'h', visual_brief: 'b', generated_caption: null, status: 'idea',
      approval_status: 'pending', published_at: null, recording_session_id: null, recording_date: null,
    },
    ...over,
  }
}

describe('ClientSchedule status column', () => {
  it('renders a status bar for a slot with an idea', () => {
    render(<ClientSchedule postingDays={[6]} tasks={[task()]} clientId="c1" clientName="Acme" />)
    expect(screen.getAllByTestId('stage-segment').length).toBeGreaterThanOrEqual(7)
  })
  it('does not render a status bar for an empty slot', () => {
    render(<ClientSchedule postingDays={[6]} tasks={[]} clientId="c1" clientName="Acme" />)
    expect(screen.queryByTestId('stage-segment')).not.toBeInTheDocument()
    expect(screen.getAllByText('Falta video').length).toBeGreaterThan(0)
  })
})
```

> Note: confirm `ClientSchedule`'s real prop names in Step 2 and adjust the test's props (e.g. `postingDays`, `tasks`, `clientId`, `clientName`) to match the actual signature.

- [ ] **Step 2: Run, verify fail** — `npx vitest run components/planning/client-schedule.test.tsx` → FAIL.

- [ ] **Step 3: Implement the column.** In `components/planning/client-schedule.tsx`:
  - Import: `import { IdeaStatusBar } from '@/components/ideas/idea-status-bar'` and `import { computeIdeaPipeline } from '@/lib/utils/idea-pipeline-stages'`.
  - Add a header cell `<th className="py-2 pr-3 text-left font-medium">Status</th>` after the "Idea del video" header.
  - Add a body cell after the "Idea del video" `<td>`:

```tsx
<td className="py-2.5 pr-3">
  {t?.ideaId && t.idea ? (
    <div className="w-40">
      <IdeaStatusBar
        pipeline={computeIdeaPipeline({ idea: t.idea, videos: [], recordingScheduled: false })}
      />
    </div>
  ) : (
    <span className="text-xs text-muted-foreground">—</span>
  )}
</td>
```

- [ ] **Step 4: Run, verify pass** — `npx vitest run components/planning/client-schedule.test.tsx` → PASS.

- [ ] **Step 5: Commit** — `git add components/planning/client-schedule.tsx components/planning/client-schedule.test.tsx && git commit -m "feat: per-row status column in the planning 2-week plan"`

---

### Task 3: Full verification

- [ ] `npx tsc --noEmit` → exit 0
- [ ] `npx vitest run` → all pass
- [ ] Stop any dev server, then `npm run build` → exit 0
- [ ] Commit any fixes.
