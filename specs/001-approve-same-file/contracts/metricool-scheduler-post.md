# Contract: Metricool Scheduler POST

**Endpoint**: `POST https://app.metricool.com/api/v2/scheduler/posts?userId={userId}&blogId={clientBlogId}`

**Auth**: `X-Mc-Auth: {METRICOOL_TOKEN}`

**Timeout**: 15s. Format hints retry once without format if first response is not ok.

## Request body (auto-publish path)

```json
{
  "text": "<generated_caption of THIS idea>",
  "draft": false,
  "autoPublish": true,
  "providers": [{ "network": "instagram" }, { "network": "tiktok" }],
  "publicationDate": {
    "dateTime": "YYYY-MM-DDTHH:MM:SS",
    "timezone": "America/Puerto_Rico"
  },
  "media": ["https://<public-domain>/<key-of-THIS-edited-file>"],
  "instagramData": { "type": "REEL", "showReelOnFeed": true }
}
```

`instagramData` / `facebookData` are best-effort from idea `content_type`. If Metricool rejects them, retry **without** format, **with the same media URL**.

## Invariants (perfect upload)

| Rule | Fail if |
|------|---------|
| Exactly one media URL | `media` missing, empty, or >1 |
| URL is this idea's file | Key belongs to another idea or last week's leftover |
| URL matches bucket | Entregas key on pipeline domain or vice versa |
| URL playable | Range GET is not 206 + Accept-Ranges |
| blogId is the client's | Agency default blog used because client blog was blank |
| Caption is this idea's | Empty or another idea's draft |

## Success

- HTTP 2xx
- Body includes `data.id` and/or `data.uuid`
- Dashboard writes `metricool_post_id`, `metricool_uuid`, `posted_at`, clears `posting_error`
- Activity `posted_to_metricool` includes `videoId`, `videoKey`, `storageProvider`

## Failure

- Do not leave a scheduled post without bookkeeping
- Release `posting_started_at` and set `posting_error` when health or URL build fails **before** POST
- After POST succeeds, retry bookkeeping 3 times; do not release claim (prevents double post)
