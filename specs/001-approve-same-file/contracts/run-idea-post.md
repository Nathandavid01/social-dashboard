# Contract: runIdeaPost (internal)

Single function that may attach a video to Metricool.

```ts
runIdeaPost(
  supabase,
  ideaId,                 // acted idea only
  userId,
  scheduleOverride?,      // YYYY-MM-DDTHH:MM Puerto Rico, optional
  opts?: {
    videoFileId?: string | null   // file shown on the screen
    watchedOn?: 'entregas' | 'pipeline'
  }
) → { ok, metricoolPostId } | { skipped: reason } | { error: reason }
```

## Preconditions

1. Load idea by `ideaId`. Missing → error.
2. Load videos `idea_id = ideaId`, `kind = edited`, provider r2|entregas-r2, not archived.
3. Pick file via `pickEditedVideoForPublish` with `ideaId` + `videoFileId` + `watchedOn` (or inferred board).
4. If pick is null → **skipped** "Falta el video editado" (fail closed; do not try the other board).
5. `ideaPostReadiness` must be ready (approved, caption, client blog, not already posted).
6. Claim row (`posting_started_at`) or skip "Ya se publicó…".

## Public URL

- Entregas provider → Entregas public base + key
- Else → pipeline public base + key
- Missing base or key → error, release claim

## Health

- `checkVideoPlayable(url)` must succeed
- Else error with health reason, release claim, **no Metricool POST**

## Call Metricool

- `createDraftPost(caption, clientBlogId, platforms, undefined, scheduledFor, { mediaUrls: [url], autoPublish: true, contentType })`
- On throw → release claim with message

## Callers (must keep this contract)

| Caller | videoFileId | watchedOn |
|--------|-------------|-----------|
| Copy / Enviar a Publicación | file on screen | `entregas` |
| Entregas Publicación button | none (infer Entregas) | `entregas` |
| Lote Aprobar / Publish button | none | infer (Entregas if live Entregas cut) |
| `/review` client vote | latest live r2 on this idea | `pipeline` |

No other function may POST media to Metricool for this flow.
