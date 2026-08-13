# Implementation Plan: Local staging

**Branch**: `eric/asignaciones-por-empleado` | **Date**: 2026-08-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-local-staging/spec.md`

## Summary

Run the dashboard on this computer against **natemedia-staging only**, on port 3022, with a separate Next cache. Refuse to boot if the env file is missing or the URL is not the staging project. Reuse `npm run dev:staging`; add the production-refusal gate that `test:staging` already has.

## Technical Context

**Language/Version**: Node.js (existing `scripts/dev-staging.mjs`) + Next.js 14

**Primary Dependencies**: `.env.staging` (not committed), `lib/utils/staging-env.ts`, Next `dev`

**Storage**: Staging Supabase project `mnqgesxmtsxtsajxfesy` only

**Testing**: Vitest for `assertStagingUrl` / start-gate helpers

**Target Platform**: Developer Mac, browser at `http://localhost:3022`

**Project Type**: Existing web app + one start script

**Performance Goals**: Sign-in screen in under 2 minutes from a cold start

**Constraints**: Never boot against production. Never commit secrets. Staging owner login for click-through.

**Scale/Scope**: One local process. Does not provision a new Supabase project.

## Constitution Check

| Gate | Status | How |
|------|--------|-----|
| I. One Action, One Record | PASS | Staging is where we verify the approve-same-file path without touching live ideas |
| II. Two Boards Stay Two Graphs | PASS | Same app, staging data |
| III. Test-First | PASS | Gate tests before changing the start script |
| IV. Staging Before Truth | PASS | This feature *is* the staging boot path |
| V. Visible Change, Visible Proof | N/A for a start script (no user-facing UI). Spanish errors on refuse. |

**Post-design re-check**: PASS. No new tables.

## Project Structure

### Documentation (this feature)

```text
specs/002-local-staging/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/dev-staging.md
```

### Source Code (repository root)

```text
scripts/dev-staging.mjs
lib/utils/staging-env.ts
lib/utils/staging-env.test.ts
.env.staging          # local only, not git
```

**Structure Decision**: Extend the existing start script. Do not add a second server.

## Complexity Tracking

> No constitution violations.
