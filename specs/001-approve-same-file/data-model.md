# Data model: 001-approve-same-file

No new tables for P1. Publish uses existing rows. Identity rules are the model.

## Idea (`content_ideas`)

| Field | Role in a perfect Metricool upload |
|-------|--------------------------------------|
| `id` | The only idea that may be posted on this action |
| `client_id` | Must not be used to pick a *file* |
| `approval_status` | Must be `approved` before schedule |
| `generated_caption` | Non-empty; one caption for all networks |
| `publish_date` | Planned day; past dates clamp to +24h |
| `metricool_blog_id` (via client) | Destination blog; required |
| `metricool_post_id` / `posted_at` | Idempotency — never post twice |
| `posting_started_at` | Atomic claim |
| `posting_error` | Why the URL/file failed |
| `review_token` | Pipeline `/review` only |

**Validation**: Auto-post MUST refuse if caption empty, not approved, already posted, or no client blog id.

## Video file (`content_idea_videos`)

| Field | Role |
|-------|------|
| `id` | Preferred file id from the screen |
| `idea_id` | MUST equal the acted idea; other ideas of the same client are invalid |
| `kind` | Only `edited` may go to Metricool |
| `status` | Not `archived` |
| `storage_provider` | `entregas-r2` or `r2` — picks public URL builder |
| `drive_file_id` | Object key; MUST contain `/edited/` for pipeline public worker |
| `uploaded_at` | Tie-break **inside** the chosen board only |

**Validation**:
- Live = edited + not archived + key present + provider in {r2, entregas-r2}.
- Other `idea_id` → drop.
- `watchedOn: entregas` and no Entregas live file → no post (fail closed).
- `watchedOn: pipeline` and no r2 live file → no post (fail closed).

## Scheduled post (Metricool, not stored as a row)

Derived, not a table:

- `blogId` = client Metricool blog
- `text` = this idea's caption
- `media` = `[publicUrl(this file)]` exactly one URL
- `providers` = client's networks
- `publicationDate` = Puerto Rico wall-clock
- `autoPublish` = true on this path

## State transitions (idea)

```text
edited (pending)
  → submitted (review link minted)
    → approved  [staff or pipeline client vote]
      → Copy if no caption
      → Publicación if caption exists
        → Metricool claimed (posting_started_at)
          → posted (metricool_post_id + posted_at)
          → or claim released (posting_error)
    → revision_needed (reject)
```

Entregas public `/aprobacion` approve: item vote only. MUST NOT jump to Metricool.

## Relationships

```text
Client 1—* Idea 1—* VideoFile
Idea 0..1 ScheduledPost (via metricool_post_id)
```

Picking a file from another Idea of the same Client is a **model violation**, not a preference.
