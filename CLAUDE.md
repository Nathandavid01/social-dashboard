# Nate Media — Social Dashboard

Next.js 14 (App Router) · Supabase (auth + Postgres + Storage + Realtime) · Anthropic SDK · Radix/shadcn + Tailwind.

## Mandatory: TDD for ALL work

Every change — feature, fix, refactor — is done **test-first (TDD)**. No exceptions.

1. **Write the test first.** Capture the expected behavior in a `*.test.ts(x)` before touching implementation. It should fail (red).
2. **Implement** the minimum to make it pass (green).
3. **Refactor** with the test as a safety net.
4. **Verify before claiming done:** run `npx vitest run <files> --exclude '**/.claude/**'` (the `.claude/worktrees/*` copies have their own `node_modules` and produce spurious "Cannot read properties of null (reading 'useState')" duplicate-React failures — always exclude them) and `npx tsc --noEmit`. Pure logic → unit test; UI → render/interaction test (React Testing Library + jsdom, already configured in `vitest.config.ts`).
5. **Commit frequently**, then merge to `main` once green (see "Workflow & commits" below).

If a requested task **cannot be completed now** (needs a DB migration to be applied, an external integration, a product decision), DO NOT drop it — leave it as a tracked TODO (in the session task list and/or `docs/TODO.md`) and implement it when the blocker clears.


## Hard merge rules (mandatory for everyone including Nathan)

See **`docs/MERGE_RULES.md`**. Short version:

1. **Never push to `main` directly** — only via **Pull Request**.
2. PR must be **verified**: CI jobs `merge-gate`, `test`, and relationship-guard must be green.
3. **Graph model** must pass: run `npm run merge-gate` (same ordered graph CI runs).
4. **≥1 approving review** before merge.
5. Dual-R2: editor media is **`entregas-r2`**; do not reintroduce pipeline-only assumptions.

Admin (once): `bash scripts/apply-branch-protection.sh`

## Workflow & commits

- Work on a feature branch (e.g. `eric/dev`). Commit in small, green increments — never leave large uncommitted work.
- After each green increment: commit, then merge the branch into `main` locally. Only push when explicitly asked.

## Mandatory: every new feature must respect RBAC

The 4 roles live in `lib/auth/permissions.ts`:

- **owner** — full access (`*`)
- **supervisor** — manages team + content, reads billing/contracts
- **editor** — content + captions, no billing, no team management
- **video** — recording calendar, video QC, video upload, no marca/brand edits

**When you add a new feature**, you MUST:

1. **Register a `Permission` slug** in `lib/auth/permissions.ts` (e.g. `'reports.export'`).
2. **Add it to the relevant role rows** in the `RBAC` map. Default to *least privilege* — only grant if the role really needs it. Don't add it to `team_member` (legacy).
3. **Gate the entry points**:
   - **Page route**: at the top of the server component call `await requirePermission('<slug>')` from `lib/auth/server.ts` (throws → Next 500 → handled by error.tsx). Or check + `notFound()` if you want a stealth deny.
   - **Server action**: `await requirePermission(...)` at the start before any mutation.
   - **UI button / region**: wrap with `<RoleGate perm="...">` from `components/auth/role-gate.tsx` (or hook `useHasPermission`).
4. **Sidebar entries** for new routes should ideally have a `requiredPermission` field in `nav-items.ts` and be filtered in `sidebar.tsx`. (TODO: implement the filter once the legacy items have permissions assigned.)
5. **Owner-only escalations** (delete clients, edit billing, change roles, edit workflow settings) → use `await assertOwner()` instead of `requirePermission`.

The Sidebar items themselves don't currently filter by permission (legacy). When you add a NEW route, add the permission check at the page level so unauthorized clicks 500 cleanly rather than appearing-then-failing.

## House style

- **TypeScript strict**. Run `npx tsc --noEmit` before claiming work is done — never `next build` while `next dev` is running (they share `.next/`).
- **Local auth**. Keep a `.env.local` with the Supabase URL and anon key in every checkout used for `npm run dev`; `npm run predev` checks this automatically before Next starts.
- **PostgREST joins between `content_ideas` and `content_idea_videos` — hard rules (regression: /revision PGRST201):**
  1. Always embed with the idea→videos FK: `videos:content_idea_videos!content_idea_videos_idea_id_fkey(...)`. Never a bare `content_idea_videos(...)`.
  2. **Never re-add a second FK** between those tables (e.g. `content_ideas.editing_source_video_id` → videos). A dual FK makes *every* bare embed fail and takes down `/revision`.
  3. Guards (must stay green):
     - `npm run check:db-relationships` — static scan of `app/`, `lib/`, `components/` (prebuild + pretest)
     - `npm run test:relationships` — unit + live schema probes
     - `npm run check:db-schema-relationships` — live: bare embed must not return PGRST201 (needs `.env.local`)
  4. See `supabase/migrations/0058_drop_editing_source_video_fk.sql` and `lib/actions/content-idea-video-relationship*.test.ts`.
- **Server-only utils** go in files imported only from server components / server actions. Anything imported by `'use client'` files must not transitively import `lib/supabase/server.ts` — split types into a `*-types.ts` companion (see `workflow-progress.ts` + `workflow-types.ts`).
- **Card headers** that have title + badges/actions must use `flex-wrap items-center justify-between gap-x-3 gap-y-2` on the container, `min-w-0` + `truncate` on the title, `shrink-0` + `whitespace-nowrap` on the right-side children. Narrow grid columns are the rule, not the exception.
- **Animations** use `tailwindcss-animate` utilities (`animate-in fade-in slide-in-from-bottom-1 duration-300`) with `animationDelay` for stagger. No framer-motion in this project.
- **Spanish UI**, technical identifiers stay English.
- **Changelog on every user-visible change.** Bump `lib/version.ts`, add a `## vX.Y` block to `CHANGELOG.md` in Spanish: one bold headline a non-technical person can forward, 2–5 bullets of what they will *see*, and a screenshot in `public/changelog/` when the change is visual (`![...](/changelog/vX.Y-….png)`). The `/changelog` page renders that file.
- **Optimistic updates** in mutations: use `useTransition` + immediate state update + toast on error rollback.

## Project shape (high level)

- `app/(auth)` — login/signup, no sidebar
- `app/(dashboard)` — authenticated app
- `app/(portal)` — public client portal (anon writes via `client_requests`)
- `lib/auth/` — RBAC permissions + server helpers
- `lib/actions/` — server actions (one file per domain)
- `lib/utils/` — pure helpers; server-only utils import `lib/supabase/server.ts`
- `lib/integrations/` — external APIs (Twilio, Metricool, Google Drive…)
- `components/` — organized by domain (`clients/`, `home/`, `notifications/`, `presence/`, `planning/`, `recording/`…)
- `supabase/migrations/` — sequential SQL; new schema gets a new `NNNN_*.sql` file, never edit old ones

## Loader

**No full-screen brand splash on route transitions** (no Nate Media logo between pages).

- `app/loading.tsx`, `app/(dashboard)/loading.tsx`, `app/(auth)/loading.tsx` return `null` — navigation feedback comes from `<NateTopProgress />` (top bar, already in the dashboard layout).
- Inline Suspense fallbacks use the minimal, logo-less `<PageSpinner />` (`components/shared/page-spinner.tsx`).
- The `NateLoader` component was removed; do not reintroduce a logo splash for loading states.

## When the user reports a "looks broken" UI bug

First check: is the offending header using the responsive card-header pattern above? Most overflow/clipping bugs in this app are missing `flex-wrap` + `min-w-0` + `shrink-0`.
