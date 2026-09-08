# Exact-file public review — staged migration 0077

Use an **empty local database**, never production. Apply, in order:

1. `public-vote-fixture.sql`
2. `public-vote-file-fixture.sql`
3. `../../supabase/migrations/0076_guard_client_review_after_posting.sql`
4. `../../supabase/migrations/0077_client_review_exact_file.sql`
5. `public-vote-file-assertions.sql`

Run each with `psql -v ON_ERROR_STOP=1 -f <path>`. The fixture assumes cluster roles `anon` and `authenticated` exist. Assertions roll back their changes. Fixtures are intentionally minimal and are not production schema/RLS coverage.

The regression checks a displayed file replaced before voting, failed media, null file identity, persistence of the approved file despite later uploads, anonymous token/idea boundaries, correction activity and return to editor, sent-video protection, and legacy votes without a file seal. Initial run failed because the v2 RPC did not exist; assertions pass after migration.

## Rollout is incomplete

0077 adds separate v2 RPCs and does not replace the active RPCs. It requires 0071's `video_file_id` column. No application callers use v2 yet; current production votes are **not protected by this staged code**.

Before activation:

- Obtain access to Nathan's actual Supabase project and verify the real schema, roles and migrations.
- Return `video_file_id` through `getRevisionPublica`, send it from the rendered video into `submit_entregas_review_v2`, and handle `video_cambio` with a fresh preview requiring a new decision. Do not automatically retry a vote against the replacement file.
- Coordinate retirement of the legacy submit RPC so stale clients cannot bypass exact-file checks. Preserve read-only reconciliation of uncertain submissions.
- Check real upload races, archival, editor return, client approval and Metricool readiness against the same sealed file. Local fixtures do not prove the full workflow.
- Historical unsealed votes intentionally have no playback in v2; provide clear UI text and require a fresh review before using them as exact-file evidence.
