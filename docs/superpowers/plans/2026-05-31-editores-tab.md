# Editores Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Add an "Editores" tab to Video QC showing the editing queue (videos with raw uploaded, no edited) where editors download crudos/b-roll and upload the edited video inline.

**Architecture:** A pure `isReadyToEdit` filter selects the queue from the already-loaded pipeline; `EditorVideoCard` shows source material (download/preview) + an edited uploader (reusing the R2 actions); `EditoresTab` grids the cards; the page gates the tab on `video.upload`. No migration.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind, Vitest + RTL.

---

### Task 1: Edit-queue filter helpers

**Files:** Create `lib/utils/edit-queue.ts`; Test `lib/utils/edit-queue.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { activeVideoCount, isReadyToEdit } from './edit-queue'
import type { PipelineVideo } from '@/lib/actions/video-pipeline'
import type { ContentIdeaVideo } from '@/lib/supabase/types'

const vid = (status: ContentIdeaVideo['status'] = 'uploaded') => ({ status } as ContentIdeaVideo)
function pv(over: Partial<PipelineVideo['videos']> = {}, status = 'grabada'): PipelineVideo {
  return { status, videos: { raw: [], broll: [], edited: [], ...over } } as unknown as PipelineVideo
}

describe('edit-queue', () => {
  it('activeVideoCount ignores archived/failed', () => {
    expect(activeVideoCount([vid('uploaded'), vid('archived'), vid('failed'), vid('processing')])).toBe(2)
  })
  it('ready when raw>=1 active and edited==0 active', () => {
    expect(isReadyToEdit(pv({ raw: [vid()] }))).toBe(true)
  })
  it('not ready when no raw', () => {
    expect(isReadyToEdit(pv({ broll: [vid()] }))).toBe(false)
  })
  it('not ready when an edited already exists', () => {
    expect(isReadyToEdit(pv({ raw: [vid()], edited: [vid()] }))).toBe(false)
  })
  it('ready ignores an archived edited', () => {
    expect(isReadyToEdit(pv({ raw: [vid()], edited: [vid('archived')] }))).toBe(true)
  })
  it('excludes descartada', () => {
    expect(isReadyToEdit(pv({ raw: [vid()] }, 'descartada'))).toBe(false)
  })
})
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run lib/utils/edit-queue.test.ts` → FAIL.

- [ ] **Step 3: Implement `lib/utils/edit-queue.ts`**

```ts
import type { PipelineVideo } from '@/lib/actions/video-pipeline'
import type { ContentIdeaVideo } from '@/lib/supabase/types'

const ACTIVE: ReadonlySet<ContentIdeaVideo['status']> = new Set<ContentIdeaVideo['status']>([
  'uploading', 'uploaded', 'processing',
])

export function activeVideoCount(videos: ContentIdeaVideo[]): number {
  return videos.filter((v) => ACTIVE.has(v.status)).length
}

/** True when a video has source material (>=1 active raw) but no active edited yet. */
export function isReadyToEdit(video: PipelineVideo): boolean {
  if (video.status === 'descartada') return false
  return activeVideoCount(video.videos.raw) >= 1 && activeVideoCount(video.videos.edited) === 0
}
```

- [ ] **Step 4: Run, verify pass** — `npx vitest run lib/utils/edit-queue.test.ts` → PASS.

- [ ] **Step 5: Commit** — `git add lib/utils/edit-queue.ts lib/utils/edit-queue.test.ts && git commit -m "feat: edit-queue filter helpers"`

---

### Task 2: EditorVideoCard

**Files:** Create `components/video-pipeline/editor-video-card.tsx`; Test `components/video-pipeline/editor-video-card.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EditorVideoCard } from './editor-video-card'
import type { PipelineVideo } from '@/lib/actions/video-pipeline'
import type { ContentIdeaVideo } from '@/lib/supabase/types'

vi.mock('@/lib/actions/idea-videos-r2', () => ({
  getR2DownloadUrl: vi.fn(async () => ({ url: 'https://r2/get' })),
  getR2PreviewUrl: vi.fn(async () => ({ url: 'https://r2/preview' })),
  getR2UploadUrl: vi.fn(async () => ({ url: 'https://r2/put', key: 'k' })),
  registerR2Video: vi.fn(async () => ({ ok: true, id: 'e1' })),
}))
vi.mock('@/lib/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/components/clients/client-logo', () => ({ ClientLogo: () => <div data-testid="logo" /> }))

function mat(kind: ContentIdeaVideo['kind'], i: number): ContentIdeaVideo {
  return { id: `${kind}-${i}`, kind, name: `${kind}-${i}.mp4`, status: 'uploaded', storage_provider: 'r2', drive_file_id: 'k', drive_view_link: null } as ContentIdeaVideo
}
function video(): PipelineVideo {
  return {
    id: 'v1', client_id: 'c1', content_type: 'R', title: 'Reel 1', generated_caption: 'Cap', status: 'grabada',
    approval_status: 'pending', recording_date: null, publish_date: null,
    videos: { raw: [mat('raw', 0), mat('raw', 1)], broll: [mat('broll', 0)], edited: [] },
  } as unknown as PipelineVideo
}

describe('EditorVideoCard', () => {
  const item = { video: video(), client: { id: 'c1', name: 'Acme', logo_url: null } }

  it('lists crudos + b-roll source files with a download control each', () => {
    render(<EditorVideoCard item={item as any} />)
    expect(screen.getByText('raw-0.mp4')).toBeInTheDocument()
    expect(screen.getByText('broll-0.mp4')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Bajar/i }).length).toBe(3) // 2 raw + 1 broll
  })
  it('renders the edited uploader (video, multiple)', () => {
    const { container } = render(<EditorVideoCard item={item as any} />)
    const input = container.querySelector('input[type="file"]')
    expect(input).toHaveAttribute('multiple')
    expect(input).toHaveAttribute('accept', 'video/*')
    expect(screen.getByText(/Subir.*editad/i)).toBeInTheDocument()
  })
  it('shows the caption and links the title to the workspace', () => {
    render(<EditorVideoCard item={item as any} />)
    expect(screen.getByText('Cap')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Reel 1/i })).toHaveAttribute('href', '/produccion/idea/v1')
  })
})
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run components/video-pipeline/editor-video-card.test.tsx` → FAIL.

- [ ] **Step 3: Implement `components/video-pipeline/editor-video-card.tsx`** — a `'use client'` card:
  - Header: `<ClientLogo>` + client name + `<Link href={/produccion/idea/${video.id}}>` title + type badge + truncated `generated_caption` (or "Sin caption").
  - **Material a editar:** map active `[...raw, ...broll]` (filter by active status) to a `MaterialRow`:
    kind icon + name + **Bajar** button (`onClick` → `getR2DownloadUrl(v.id)` → `window.open(url)`; for
    Drive provider, open `drive_view_link`) + **Ver** button (`getR2PreviewUrl(v.id)` → toggle an
    inline `<video controls src>`).
  - **Subir editado:** an upload dropzone (`<input type="file" accept="video/*" multiple>` + drag/drop)
    driven by an in-file `useEditedUpload(video.id)` hook that, per file: `getR2UploadUrl({ ideaId, kind:'edited', fileName, contentType })`
    → XHR PUT with progress → `registerR2Video({ ideaId, kind:'edited', key, name, sizeBytes, mimeType })`;
    batch progress label "Subiendo editado… (1 de N)"; on success toast + `router.refresh()`. 5 GB cap per
    file with a toast (mirror `idea-video-panel`). Gate the uploader behind `useHasPermission('video.upload')`.

- [ ] **Step 4: Run, verify pass** — `npx vitest run components/video-pipeline/editor-video-card.test.tsx` → PASS. (Mock `@/components/auth/role-gate` `useHasPermission` to true in the test.)

- [ ] **Step 5: Commit** — `git add components/video-pipeline/editor-video-card.tsx components/video-pipeline/editor-video-card.test.tsx && git commit -m "feat: editor video card (download source + upload edited)"`

---

### Task 3: EditoresTab

**Files:** Create `components/video-pipeline/editores-tab.tsx`; Test `components/video-pipeline/editores-tab.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EditoresTab } from './editores-tab'

vi.mock('./editor-video-card', () => ({
  EditorVideoCard: ({ item }: { item: { video: { title: string } } }) => <div>{item.video.title}</div>,
}))

describe('EditoresTab', () => {
  it('renders a card per item', () => {
    const items = [
      { video: { id: '1', title: 'A' }, client: { id: 'c1', name: 'Acme', logo_url: null } },
      { video: { id: '2', title: 'B' }, client: { id: 'c1', name: 'Acme', logo_url: null } },
    ]
    render(<EditoresTab items={items as any} />)
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
  })
  it('shows an empty state when there is nothing to edit', () => {
    render(<EditoresTab items={[]} />)
    expect(screen.getByText(/Nada por editar/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run components/video-pipeline/editores-tab.test.tsx` → FAIL.

- [ ] **Step 3: Implement `components/video-pipeline/editores-tab.tsx`**

```tsx
import { Clapperboard } from 'lucide-react'
import { EditorVideoCard, type EditQueueItem } from './editor-video-card'

export function EditoresTab({ items }: { items: EditQueueItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <Clapperboard className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
        <p className="text-sm font-medium text-muted-foreground">Nada por editar 🎉</p>
        <p className="text-xs text-muted-foreground/70">
          Aquí aparecen los videos con material crudo listos para editar.
        </p>
      </div>
    )
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <EditorVideoCard key={item.video.id} item={item} />
      ))}
    </div>
  )
}
```

> Note: export `EditQueueItem` from `editor-video-card.tsx`:
> `export interface EditQueueItem { video: PipelineVideo; client: Pick<Client, 'id'|'name'|'logo_url'> }`.

- [ ] **Step 4: Run, verify pass** — `npx vitest run components/video-pipeline/editores-tab.test.tsx` → PASS.

- [ ] **Step 5: Commit** — `git add components/video-pipeline/editores-tab.tsx components/video-pipeline/editores-tab.test.tsx && git commit -m "feat: editores tab grid + empty state"`

---

### Task 4: Wire the tab into the page (gated)

**Files:** Modify `app/(dashboard)/video-reviews/page.tsx`

- [ ] **Step 1: Build the queue + gate.** Add imports: `import { currentUserHas } from '@/lib/auth/server'`,
  `import { isReadyToEdit } from '@/lib/utils/edit-queue'`, `import { EditoresTab } from '@/components/video-pipeline/editores-tab'`,
  `import type { EditQueueItem } from '@/components/video-pipeline/editor-video-card'`. After loading `pipeline`:

```tsx
  const canEdit = await currentUserHas('video.upload')
  const editQueue: EditQueueItem[] = canEdit
    ? pipeline.flatMap((p) =>
        p.videos.filter(isReadyToEdit).map((video) => ({
          video,
          client: { id: p.client.id, name: p.client.name, logo_url: p.client.logo_url },
        })),
      )
    : []
```

- [ ] **Step 2: Render the 3rd tab (only when `canEdit`).** Add to `<TabsList>`:

```tsx
        {canEdit && (
          <TabsTrigger value="editores">
            Editores{editQueue.length > 0 ? ` (${editQueue.length})` : ''}
          </TabsTrigger>
        )}
```

  And after the existing `<TabsContent>`s:

```tsx
      {canEdit && (
        <TabsContent value="editores" className="space-y-5">
          <EditoresTab items={editQueue} />
        </TabsContent>
      )}
```

- [ ] **Step 3: Verify** — `npx tsc --noEmit` → clean.

- [ ] **Step 4: Commit** — `git add "app/(dashboard)/video-reviews/page.tsx" && git commit -m "feat: Editores tab on Video QC (gated by video.upload)"`

---

### Task 5: Full verification

- [ ] `npx tsc --noEmit` → exit 0
- [ ] `npx vitest run` → all pass
- [ ] Stop any dev server, then `npm run build` → exit 0
- [ ] Commit any fixes.
