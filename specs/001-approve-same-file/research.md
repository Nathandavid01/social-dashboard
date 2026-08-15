# Research: 001-approve-same-file

All Technical Context unknowns resolved. Decisions lock how a video **successfully** lands on Metricool.

## Decision: One sink, one media URL

**Decision**: Every schedule path calls `runIdeaPost` → `createDraftPost` with `media: [publicUrl]` of the **picked** edited file. No Drive-only posts on auto-publish. No second Metricool client.

**Rationale**: Metricool fetches the URL itself. Two clients or two media lists is how last week's file sneaks in.

**Alternatives considered**: Upload bytes to Metricool's media library first (more moving parts, no existing code). Attach last Metricool media id (reuses last week's asset). Rejected.

## Decision: Public URL must match the file's bucket

**Decision**: `storage_provider === 'entregas-r2'` → `entregasR2PublicUrl(key)`. Else pipeline `r2PublicUrl(key)`. Pipeline public worker 404s anything not under `/edited/`.

**Rationale**: Wrong domain returns 404. Metricool then shows invalid/spinning media — or appears to keep last week's asset.

**Alternatives considered**: One public base for both buckets. Rejected; buckets and workers are separate on purpose.

## Decision: Preflight Range 206 or do not POST

**Decision**: `checkVideoPlayable(url)` MUST return ok (HTTP 206 + `Accept-Ranges`) before `createDraftPost`. On failure, release the claim, store `posting_error` with the reason, do not call Metricool.

**Rationale**: A 200 without ranges made Metricool's preview spin forever. Blocking here is how uploads stay "perfect" instead of silently scheduled-broken.

**Alternatives considered**: Trust R2 and POST anyway. Already failed in production.

## Decision: Client blog_id only — never agency default on auto-publish

**Decision**: `ideaPostReadiness` refuses empty `clients.metricool_blog_id`. `createDraftPost` receives that blog id. Agency `METRICOOL_BLOG_ID` is credentials fallback only, not a destination for real client posts.

**Rationale**: Falling back publishes a real video to the agency feed.

**Alternatives considered**: Silent fallback to env blog. Explicitly forbidden by existing comments and this spec.

## Decision: File identity = this idea + watched board

**Decision**:
1. Query videos `eq('idea_id', actedIdeaId)` only.
2. Drop rows whose `idea_id` is another idea (same client last week).
3. Preferred file id (Copy preview / `/review` r2) wins if it is live on this idea.
4. Entregas actions: `watchedOn: 'entregas'`.
5. Board-agnostic approve/publish: `inferWatchBoard` → Entregas if a live Entregas cut exists.
6. `/review` autopost: preferred = latest live `r2` on this idea; `watchedOn: 'pipeline'`. If no r2, fail closed (do not send Entregas leftover).

**Rationale**: "Latest edited of the client" and "latest of either bucket" both scheduled last week's file.

**Alternatives considered**: Always newest `uploaded_at`. Rejected (v3.28). Always Entregas even on `/review`. Rejected — client saw the pipeline file.

## Decision: Health + activity must name the file

**Decision**: `posted_to_metricool` metadata MUST include `videoId`, `videoKey`, `storageProvider`, and the public URL. `posting_error` MUST include why the URL failed (404 / not 206).

**Rationale**: Without that, "Metricool got the wrong video" cannot be proven from the log.

**Alternatives considered**: Log only Metricool post id. Insufficient for SC-001.

## Decision: Remainder vs already shipped

**Decision**: Treat v3.28–v3.32 as done. Remaining implement (after `/speckit-tasks`):
- Fail closed if `watchedOn` board has zero live files (do not fall through to the other bucket).
- Entregas `/aprobacion` approve does not call Metricool (FR-007) — verify + make staff-visible state honest without auto-post.
- Optional: exclude `archived` in `get_entregas_review` (FR-008, owner SQL).

**Rationale**: Spec Kit plan must not re-open shipped picker/card-key work.

**Alternatives considered**: Rewrite publish from scratch. Rejected; sink is already correct if the file identity is correct.
