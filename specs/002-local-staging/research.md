# Research: 002-local-staging

## Decision: Reuse the existing start command

**Decision**: `npm run dev:staging` remains the way to create/start local staging. It already loads `.env.staging` over process env and uses `.next-staging-dev` + port 3022.

**Rationale**: A second server would double cache and risk port 3020 (prod-local).

**Alternatives considered**: Docker Compose local Supabase. Too heavy; staging data already exists in the cloud project.

## Decision: Refuse production at boot

**Decision**: Same gate as `test:staging`: URL MUST contain `mnqgesxmtsxtsajxfesy`. Missing `.env.staging` is a hard fail (do not fall back to `.env.local`).

**Rationale**: `.env.local` in this repo has pointed at production. Falling back would schedule real Metricool posts.

**Alternatives considered**: Warn and continue. Rejected.

## Decision: Staging owner for click-through

**Decision**: Sign in with the staging owner in `.env.staging` (`STAGING_OWNER_EMAIL`). Do not use production emails.

**Rationale**: RLS and owner-only screens (Sesión) need that user.

**Alternatives considered**: Anonymous. Cannot reach Entregas.
