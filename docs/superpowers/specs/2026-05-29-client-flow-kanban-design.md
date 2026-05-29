# Client Flow — Kanban Board

**Date:** 2026-05-29
**Replaces:** `components/clients/profile/pipeline-flow-table.tsx` (the flat checkmark table)
**Rendered in:** the "Flujo" tab of the client profile (`app/(dashboard)/clients/[id]/page.tsx`).

## Goal

Turn the per-client production flow from a checkmark table into a **Kanban board** so
you can see at a glance where every video is and what's stuck.

## Columns (in order)

`Idea → Grabado → Editado → Caption → Publicado`. Each column header shows its name +
count, and a ⚠ with the overdue count when any card in it is late.

## Card placement (current stage = furthest reached)

```
publicada                          → Publicado
producida (edited) + has caption   → Caption
producida (edited), no caption     → Editado
grabada                            → Grabado
idea | asignada                    → Idea
descartada                         → not shown (discarded)
```

## Card content

- Title (clamped), type badge (Reel/Post/Carrusel/Story from `content_type`).
- Relevant date (publish_date if set, else created_at).
- **5 mini stage dots** (●●●○○) from the existing per-stage done logic, so caption
  state stays visible even when the card sits in another column.
- Overdue → amber accent + ⚠.
- Whole card links to `/produccion/idea/[id]`.

## Overdue rule

A non-published video (`status !== 'publicada'`) is overdue when EITHER:
1. `publish_date` is set and in the past, OR
2. it's **stale**: `updated_at` older than `STALE_DAYS` (= 7) days.

`STALE_DAYS` is a named constant. `updated_at` is an approximation of "no activity"
(no per-stage history exists); documented as such.

## Behavior

- **Read-only** — no drag & drop. Stages derive from data; you advance a video by
  working it in its detail page. Keeps scope tight and risk-free.
- Horizontal scroll on narrow screens (5 columns); columns grow vertically.
- Empty client → keep "Sin videos en el pipeline todavía." Empty column → "· 0".
- `descartada` ideas are excluded from the board.

## Tests (vitest + Testing Library)

1. Each status/caption combination lands in the correct column (the 5 cases).
2. Per-column counts are correct.
3. Overdue: past `publish_date` + not published → ⚠; stale `updated_at` → ⚠;
   published or no signal → no ⚠.
4. A card links to `/produccion/idea/[id]`.
5. `descartada` is not rendered.
6. Empty state renders the "Sin videos…" message.
