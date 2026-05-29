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
- **Server-only utils** go in files imported only from server components / server actions. Anything imported by `'use client'` files must not transitively import `lib/supabase/server.ts` — split types into a `*-types.ts` companion (see `workflow-progress.ts` + `workflow-types.ts`).
- **Card headers** that have title + badges/actions must use `flex-wrap items-center justify-between gap-x-3 gap-y-2` on the container, `min-w-0` + `truncate` on the title, `shrink-0` + `whitespace-nowrap` on the right-side children. Narrow grid columns are the rule, not the exception.
- **Animations** use `tailwindcss-animate` utilities (`animate-in fade-in slide-in-from-bottom-1 duration-300`) with `animationDelay` for stagger. No framer-motion in this project.
- **Spanish UI**, technical identifiers stay English.
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

All Suspense fallbacks for major route transitions should use `<NateLoader />` (full-screen splash with the company logo) — placed in `app/loading.tsx`, `app/(dashboard)/loading.tsx`, `app/(auth)/loading.tsx`. Inline loaders use `variant="inline"`.

## When the user reports a "looks broken" UI bug

First check: is the offending header using the responsive card-header pattern above? Most overflow/clipping bugs in this app are missing `flex-wrap` + `min-w-0` + `shrink-0`.
