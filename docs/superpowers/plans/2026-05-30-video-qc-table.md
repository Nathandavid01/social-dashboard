# Video QC Data Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Replace the Video QC card grid with a clean, professional data table (one row per video, grouped by client).

**Architecture:** A `VideoPipelineRow` (`<tr>`) reuses `computeIdeaProgress` + `ApprovalButton`; a `VideoPipelineTable` wraps rows in a styled `<table>`; `client-video-section` swaps its grid for the table. The old `VideoCard` is deleted.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind, Vitest + RTL.

---

### Task 1: VideoPipelineRow

**Files:** Create `components/video-pipeline/video-pipeline-row.tsx`; Test `components/video-pipeline/video-pipeline-row.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VideoPipelineRow } from './video-pipeline-row'
import type { PipelineVideo } from '@/lib/actions/video-pipeline'

vi.mock('@/components/produccion/approval-button', () => ({
  ApprovalButton: ({ ideaId }: { ideaId: string }) => <button data-idea={ideaId}>Enviar a revisión</button>,
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

function video(over: Partial<PipelineVideo> = {}): PipelineVideo {
  return {
    id: 'v1', client_id: 'c1', content_type: 'C', title: 'Promo del finde',
    hook: 'h', visual_brief: 'b', caption_angle: null, hashtags_suggestion: null, rationale: null,
    status: 'asignada', production_task_id: null, recording_session_id: null, theme: null,
    generation_prompt: null, model: null, generated_caption: 'Mi caption', caption_platform: 'instagram',
    caption_generated_at: null, published_at: null, approval_status: 'pending', approved_by: null,
    approved_at: null, submitted_at: null, recording_date: '2026-05-10', publish_date: '2026-05-15',
    created_by: null, created_at: '', updated_at: '',
    videos: { raw: [], broll: [], edited: [] },
    ...over,
  } as PipelineVideo
}

describe('VideoPipelineRow', () => {
  it('renders the title as a link to the workspace', () => {
    render(<table><tbody><VideoPipelineRow video={video()} assetCount={0} /></tbody></table>)
    const link = screen.getByRole('link', { name: /Promo del finde/i })
    expect(link).toHaveAttribute('href', '/produccion/idea/v1')
  })
  it('shows material counts and both dates', () => {
    render(<table><tbody><VideoPipelineRow video={video()} assetCount={0} /></tbody></table>)
    expect(screen.getByText('0/4')).toBeInTheDocument()       // crudos (one of several 0/4)
    expect(screen.getByText('0/2')).toBeInTheDocument()       // edited
    expect(screen.getByText(/10/)).toBeInTheDocument()        // recording day
    expect(screen.getByText(/15/)).toBeInTheDocument()        // publish day
  })
  it('renders the approval action', () => {
    render(<table><tbody><VideoPipelineRow video={video()} assetCount={0} /></tbody></table>)
    expect(screen.getByText('Enviar a revisión')).toBeInTheDocument()
  })
  it('shows a "Sin caption" fallback when there is no caption', () => {
    render(<table><tbody><VideoPipelineRow video={video({ generated_caption: null })} assetCount={0} /></tbody></table>)
    expect(screen.getByText(/Sin caption/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run components/video-pipeline/video-pipeline-row.test.tsx` → FAIL.

- [ ] **Step 3: Implement `components/video-pipeline/video-pipeline-row.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { Film, ImageIcon, LayoutGrid, Circle, Camera, Video, Clapperboard, Calendar, CalendarCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ApprovalButton } from '@/components/produccion/approval-button'
import { computeIdeaProgress } from '@/lib/utils/idea-progress'
import type { ContentIdeaType, ContentIdeaStatus, IdeaApprovalStatus, ContentIdeaVideo } from '@/lib/supabase/types'
import type { PipelineVideo } from '@/lib/actions/video-pipeline'

const TYPE_CFG: Record<ContentIdeaType, { label: string; icon: typeof Film; color: string }> = {
  R: { label: 'Reel', icon: Film, color: 'text-pink-600' },
  P: { label: 'Post', icon: ImageIcon, color: 'text-blue-600' },
  C: { label: 'Carrusel', icon: LayoutGrid, color: 'text-purple-600' },
  S: { label: 'Story', icon: Circle, color: 'text-amber-600' },
}
const STATUS_CFG: Record<ContentIdeaStatus, { label: string; cls: string }> = {
  idea: { label: 'Idea', cls: 'bg-zinc-500/10 text-zinc-600 border-zinc-500/20' },
  asignada: { label: 'Asignada', cls: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  grabada: { label: 'Grabada', cls: 'bg-green-500/10 text-green-600 border-green-500/20' },
  producida: { label: 'En producción', cls: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  publicada: { label: 'Publicada', cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  descartada: { label: 'Descartada', cls: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20' },
}
const APPROVAL_CFG: Record<IdeaApprovalStatus, { label: string; cls: string }> = {
  pending: { label: 'Sin enviar', cls: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20' },
  submitted: { label: 'En revisión', cls: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  approved: { label: 'Aprobado', cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  revision_needed: { label: 'Cambios', cls: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
}

const ACTIVE: ReadonlySet<ContentIdeaVideo['status']> = new Set(['uploading', 'uploaded', 'processing'])
const activeLen = (vs: ContentIdeaVideo[]) => vs.filter((v) => ACTIVE.has(v.status)).length

function fmt(value: string | null): string {
  if (!value) return '—'
  const d = new Date(value.length <= 10 ? value + 'T00:00:00' : value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-PR', { day: 'numeric', month: 'short' })
}

const pill = 'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap'

export function VideoPipelineRow({ video, assetCount }: { video: PipelineVideo; assetCount: number }) {
  const type = TYPE_CFG[video.content_type] ?? TYPE_CFG.R
  const TypeIcon = type.icon
  const status = STATUS_CFG[video.status] ?? STATUS_CFG.idea
  const approval = APPROVAL_CFG[video.approval_status] ?? APPROVAL_CFG.pending
  const caption = video.generated_caption?.trim() || null
  const progress = computeIdeaProgress({
    idea: video,
    videos: [...video.videos.raw, ...video.videos.broll, ...video.videos.edited],
    assetCount,
  })
  const current = progress.stages.find((s) => !s.done)
  const counts = [
    { icon: Camera, n: activeLen(video.videos.raw), total: 4 },
    { icon: Video, n: activeLen(video.videos.broll), total: 4 },
    { icon: Clapperboard, n: activeLen(video.videos.edited), total: 2 },
  ]

  return (
    <tr className={cn('group relative transition-colors hover:bg-muted/40', video.status === 'descartada' && 'opacity-60')}>
      {/* VIDEO */}
      <td className="max-w-0 py-2.5 pl-3 pr-3 align-middle">
        <div className="flex min-w-0 items-center gap-2">
          <TypeIcon className={cn('h-4 w-4 shrink-0', type.color)} />
          <div className="min-w-0">
            <Link
              href={`/produccion/idea/${video.id}`}
              className="relative z-10 block truncate text-sm font-medium hover:text-primary"
            >
              {video.title || 'Sin título'}
            </Link>
            <p className={cn('truncate text-xs', caption ? 'text-muted-foreground' : 'italic text-muted-foreground/50')}>
              {caption ?? 'Sin caption'}
            </p>
          </div>
        </div>
      </td>
      {/* ESTADO */}
      <td className="py-2.5 pr-3 align-middle">
        <div className="flex flex-wrap items-center gap-1">
          <span className={cn(pill, status.cls)}>{status.label}</span>
          <span className={cn(pill, approval.cls)}>{approval.label}</span>
        </div>
      </td>
      {/* PROGRESO */}
      <td className="py-2.5 pr-3 align-middle">
        <div className="w-36">
          <div className="flex items-center gap-0.5">
            {progress.stages.map((s, i) => (
              <span
                key={s.key}
                title={s.label}
                className={cn('h-1.5 flex-1 rounded-full', s.done ? 'bg-emerald-500' : current && progress.stages.indexOf(current) === i ? 'bg-primary' : 'bg-muted')}
              />
            ))}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {current ? current.label : 'Completo'} · {progress.percent}%
          </p>
        </div>
      </td>
      {/* MATERIAL */}
      <td className="py-2.5 pr-3 align-middle">
        <div className="flex items-center gap-2 text-[11px] tabular-nums text-muted-foreground">
          {counts.map((c, i) => {
            const Icon = c.icon
            return (
              <span key={i} className={cn('inline-flex items-center gap-0.5', c.n >= c.total && 'text-emerald-600')}>
                <Icon className="h-3 w-3" />{c.n}/{c.total}
              </span>
            )
          })}
        </div>
      </td>
      {/* FECHAS */}
      <td className="whitespace-nowrap py-2.5 pr-3 align-middle text-[11px] text-muted-foreground">
        <div className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{fmt(video.recording_date)}</div>
        <div className="inline-flex items-center gap-1"><CalendarCheck className="h-3 w-3" />{fmt(video.publish_date)}</div>
      </td>
      {/* ACCIÓN */}
      <td className="py-2.5 pr-3 text-right align-middle">
        <div className="relative z-10 inline-flex">
          <ApprovalButton ideaId={video.id} approvalStatus={video.approval_status} clientName={null} />
        </div>
      </td>
    </tr>
  )
}
```

> Note: `ApprovalButton`'s exact props were extended on main (it now accepts `clientName`); confirm its signature in Step 4 and pass what it requires (`clientName={null}` if optional). If it requires more, pass minimal valid values.

- [ ] **Step 4: Run, verify pass** — `npx vitest run components/video-pipeline/video-pipeline-row.test.tsx` → PASS. (Adjust `ApprovalButton` props / the `0/4` query if needed.)

- [ ] **Step 5: Commit** — `git add components/video-pipeline/video-pipeline-row.tsx components/video-pipeline/video-pipeline-row.test.tsx && git commit -m "feat: video pipeline table row"`

---

### Task 2: VideoPipelineTable

**Files:** Create `components/video-pipeline/video-pipeline-table.tsx`; Test `components/video-pipeline/video-pipeline-table.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VideoPipelineTable } from './video-pipeline-table'
import type { PipelineVideo } from '@/lib/actions/video-pipeline'

vi.mock('./video-pipeline-row', () => ({
  VideoPipelineRow: ({ video }: { video: PipelineVideo }) => <tr><td>{video.title}</td></tr>,
}))

function v(id: string, title: string) {
  return { id, title, videos: { raw: [], broll: [], edited: [] } } as unknown as PipelineVideo
}

describe('VideoPipelineTable', () => {
  it('renders a row per video and the column headers', () => {
    render(<VideoPipelineTable videos={[v('1', 'A'), v('2', 'B')]} assetCount={0} />)
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.getByText('Video')).toBeInTheDocument()
    expect(screen.getByText('Progreso')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run components/video-pipeline/video-pipeline-table.test.tsx` → FAIL.

- [ ] **Step 3: Implement `components/video-pipeline/video-pipeline-table.tsx`**

```tsx
import { VideoPipelineRow } from './video-pipeline-row'
import type { PipelineVideo } from '@/lib/actions/video-pipeline'

const HEAD = 'py-2 pr-3 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground'

export function VideoPipelineTable({ videos, assetCount }: { videos: PipelineVideo[]; assetCount: number }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/30">
            <th className={`${HEAD} pl-3`}>Video</th>
            <th className={HEAD}>Estado</th>
            <th className={HEAD}>Progreso</th>
            <th className={HEAD}>Material</th>
            <th className={HEAD}>Fechas</th>
            <th className={`${HEAD} text-right pr-3`}>&nbsp;</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {videos.map((video) => (
            <VideoPipelineRow key={video.id} video={video} assetCount={assetCount} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Run, verify pass** — `npx vitest run components/video-pipeline/video-pipeline-table.test.tsx` → PASS.

- [ ] **Step 5: Commit** — `git add components/video-pipeline/video-pipeline-table.tsx components/video-pipeline/video-pipeline-table.test.tsx && git commit -m "feat: video pipeline table"`

---

### Task 3: Wire into the section + remove the card

**Files:** Modify `components/video-pipeline/client-video-section.tsx`; Delete `components/video-pipeline/video-card.tsx`, `video-card.test.tsx`

- [ ] **Step 1: Swap the grid for the table.** In `client-video-section.tsx`: replace the `import { VideoCard } from './video-card'` with `import { VideoPipelineTable } from './video-pipeline-table'`, and replace the `<div className="grid ...">{videos.map(<VideoCard .../>)}</div>` block with:

```tsx
        <VideoPipelineTable videos={videos} assetCount={assets.length} />
```

- [ ] **Step 2: Delete the old card** — `git rm components/video-pipeline/video-card.tsx components/video-pipeline/video-card.test.tsx`.

- [ ] **Step 3: Verify** — `npx tsc --noEmit` → clean (no remaining imports of `video-card`).

- [ ] **Step 4: Commit** — `git add components/video-pipeline/client-video-section.tsx && git commit -m "feat: Video QC uses the data table; remove the old card"`

---

### Task 4: Full verification

- [ ] `npx tsc --noEmit` → exit 0
- [ ] `npx vitest run` → all pass
- [ ] Stop any dev server, then `npm run build` → exit 0
- [ ] Commit any fixes.
