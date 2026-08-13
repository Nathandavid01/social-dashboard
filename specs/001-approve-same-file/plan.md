# Implementation Plan: Approve the same file that is scheduled

**Branch**: `eric/asignaciones-por-empleado` | **Date**: 2026-08-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-approve-same-file/spec.md`

**Focus (owner)**: videos must land on Metricool as the **same file** that was approved, playable, on the **client's** blog.

## Summary

When staff or a client approve this week's video, Metricool MUST receive that idea's live cut (Entregas if that is the delivery file), a public HTTPS URL that answers Range `206`, the client's `metricool_blog_id`, one caption for all networks, and Puerto Rico wall-clock. Never last week's idea of the same client, never the other board's leftover file, never the agency default blog.

v3.28–v3.32 already bind picker, card keys, Copy-by-idea, and pipeline-review-requires-r2. This plan locks the **Metricool ingest contract** and tasks only the remainder: fail-closed board mismatch, honest Entregas client vote (no auto-schedule), refuse unplayable URLs with the file id logged, and (optional SQL) hide archived cuts on `/aprobacion`.

## Technical Context

**Language/Version**: TypeScript 5 / Next.js 14 App Router (existing dashboard)

**Primary Dependencies**: Supabase (Postgres + RLS), Cloudflare R2 (pipeline + Entregas buckets), Metricool Scheduler API `POST /v2/scheduler/posts`, Vitest

**Storage**: `content_ideas`, `content_idea_videos` (`idea_id`, `kind`, `storage_provider`, `drive_file_id`, `status`, `uploaded_at`). No new table for P1. Optional SQL later for public review excluding `archived`.

**Testing**: Vitest (+ RTL). Must prove: other idea of same client never selected; Entregas cut wins on lote approve; Copy loads one idea; Metricool body `media` is the public URL of that file; health check blocks non-206.

**Target Platform**: Vercel (staging + prod). Public video URLs via R2 worker (`/edited/` only) and Entregas public domain.

**Project Type**: Existing web application (not a greenfield layout)

**Performance Goals**: Publish path MUST preflight the video URL (Range 0-1) before calling Metricool. Metricool fetch already times out at 15s so approval is not blocked forever.

**Constraints**: Constitution I–V. One caption all networks. Caption only if video exists. Client blog_id required (never fall back to agency `METRICOOL_BLOG_ID` on auto-publish). No `main` push except PR. Prod SQL only if owner pastes it.

**Scale/Scope**: One idea + one file per action. ~50 clients, multiple weekly ideas per client. Four existing publish edges collapse to one picker (`runIdeaPost`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | How this plan satisfies it |
|------|--------|----------------------------|
| I. One Action, One Record | PASS | `runIdeaPost` queries `idea_id = acted idea`; picker drops other `idea_id`; card key includes idea id; Copy loads by ideaId |
| II. Two Boards Stay Two Graphs | PASS | Entregas edges `watchedOn: 'entregas'`; `/review` requires live `r2` and posts that file; lote approve infers Entregas if that cut exists |
| III. Test-First | PASS | Remaining work starts with failing tests (board mismatch fail-closed, vote does not post, health + media URL) |
| IV. Staging Before Truth | PASS | Publish/auth changes verified on staging; no prod SQL in first ship |
| V. Visible Change, Visible Proof | PASS | Any UI copy change → version + Spanish changelog + `public/previews/` |

**Post-design re-check**: still PASS. No new tables required for P1. Optional archive filter is isolated SQL (FR-008), owner-applied.

## Project Structure

### Documentation (this feature)

```text
specs/001-approve-same-file/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── metricool-scheduler-post.md
│   └── run-idea-post.md
└── tasks.md             # /speckit-tasks — not created here
```

### Source Code (repository root)

```text
lib/actions/idea-posting-run.ts      # single Metricool sink
lib/actions/idea-posting.ts          # manual + auto wrappers
lib/utils/idea-posting-core.ts       # picker + inferWatchBoard + readiness
lib/metricool/post.ts                # Scheduler API body
lib/integrations/video-health.ts     # Range 206 preflight
lib/integrations/r2.ts               # pipeline public URL
lib/integrations/entregas-r2.ts      # Entregas public URL
infra/r2-public-edited-worker.js     # public /edited/ only
lib/actions/entregas-copy.ts         # Copy + schedule this idea
lib/actions/review-autopost.ts       # /review/ only, r2 file they saw
lib/actions/review-staff.ts          # mint /review/ only if r2 exists
lib/entregas/batches.ts              # entregaCardKey
components/entregas/entregas-board.tsx
components/entregas/copy-overlay.tsx
```

**Structure Decision**: Stay in the existing Next.js app. No new package. All Metricool media attachment goes through `runIdeaPost` → `createDraftPost`.

## Complexity Tracking

> No constitution violations. Empty on purpose.
