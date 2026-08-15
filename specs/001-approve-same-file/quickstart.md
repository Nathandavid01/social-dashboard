# Quickstart: prove this week's video is what Metricool gets

## Prerequisites

- Repo: `Nate Media/social-dashboard`, branch `eric/asignaciones-por-empleado`
- `npx vitest` works
- Staging env if checking a live post (`npm run test:staging` is for session log; publish is unit + optional staging click)

## 1. File identity (must pass)

```bash
npx vitest run lib/utils/idea-posting-core.test.ts lib/entregas/batches.test.ts lib/actions/entregas-copy.test.ts
```

Expect:

- Other idea of the same client is never picked
- Entregas cut wins on board-agnostic approve
- Copy with `ideaId` returns one video
- Card keys differ for two videos of Gym X in Review

## 2. Metricool body (must pass)

```bash
npx vitest run lib/metricool/post.test.ts lib/integrations/video-health.test.ts
```

Expect:

- `media` is exactly the public URL passed in
- Auto-publish sets `draft: false`, timezone `America/Puerto_Rico`
- Health check fails on 200/404 so a bad URL never goes out

## 3. Manual staging (publish path)

1. Client with two ideas in Review (this week + last week).
2. Open **this week's** card. Title is this week's.
3. Entregas: Copy → Enviar a Publicación (or lote Aprobar if caption already exists).
4. In Actividad, `posted_to_metricool` `videoKey` MUST contain this week's object key, not last week's.
5. In Metricool planner, the preview plays **this** cut (not last week's).

If step 4 shows last week's key, stop — do not "retry" from the other card.

## 4. Fail cases (must not POST)

- No caption → skipped, no Metricool call
- No client blog id → skipped
- Pipeline `/review` on an Entregas-only idea → link mint refused
- Public URL 404 / not 206 → `posting_error` set, claim released

## Done when

SC-001: 0 last-week files scheduled from a this-week approve in the dry-run above.
