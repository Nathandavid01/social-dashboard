# Pencil prompt — "Cadencia" homepage widget

Paste everything inside the fenced block below into Pencil.

---

```
Design a dashboard widget called the "Cadencia" card — a real-time posting cadence
tracker for a social-media agency's internal dashboard. It lives at the top of the
home page and answers one question at a glance: "Where are we today, this week, and
per client, with our posts going out?"

PRODUCT CONTEXT
- Internal tool for "Nate Media", a social media agency that posts content for many
  clients (Instagram, Facebook, TikTok, LinkedIn).
- Source of truth is a production calendar: each scheduled post has a client, a
  publish date, a posting time, target platforms, and a live status that moves
  pendiente → en edición → en revisión → revisiones → aprobado → publicado.
  For this widget collapse that into 3 user-facing states:
    • PUBLICADO  (it went out)            → success / green
    • PENDIENTE  (planned, not out yet)   → neutral / amber
    • ATRASADO   (past its time, not out) → danger / red   (also covers "fallido")
- UI language is SPANISH. Keep all labels in Spanish.

DESIGN SYSTEM (match exactly — this plugs into a shadcn/ui + Tailwind app)
- Dark-first. Default to a dark theme; also provide a light variant.
- Brand primary = warm gold/amber, hsl(43, 80%, 46%). Use it for: today's highlight,
  ring accents, the live pulse, key numbers.
- Semantic colors: success = green (publicado), warning/amber = pendiente,
  destructive = red (atrasado/fallido), muted gray for ring tracks and empty states.
- Rounded cards (rounded-xl), soft 1px border, subtle shadow, generous padding (~20px).
- Type: clean sans (Inter-like). Big tabular numbers for the ring fractions.
- Icons: line icons (Lucide style) — Target, Radio, Clock, AlertTriangle, Check,
  small platform glyphs for Instagram/Facebook/TikTok/LinkedIn.

THE CARD — TWO STACKED REGIONS IN ONE CARD

1) HEADER ROW
   - Left: title "Cadencia" with a small Target icon.
   - Right: a live status pill — a pulsing dot + "en vivo" in green, small, pill-shaped
     (rounded-full, green/10 background). This signals real-time updates.
   - Header must wrap gracefully on narrow widths (title truncates, pill stays put).

2) OVERVIEW ROW — TWO PROGRESS RINGS, side by side
   - Ring A "HOY": a circular progress ring showing publicados / planeados for today,
     e.g. big "4/7" centered inside the ring. The arc fills proportionally; arc color
     is green when on pace, gold as the default accent. Sublabel under it: "publicados"
     and a second tiny line of stats: "2 pendientes · 1 atrasado" (hide a stat when 0;
     atrasado count shown in red).
   - Ring B "ESTA SEMANA": same ring style showing the week, e.g. "18/31", sublabel
     "publicados" and a "57%" completion line.
   - Rings are the visual anchor — make them prominent and satisfying. Animate the arc
     filling in on load.

3) DAY SELECTOR — a horizontal row of 7 day chips: Lun Mar Mié Jue Vie Sáb Dom
   - Today is highlighted (gold ring/underline + bold).
   - Each chip carries a tiny status hint: a small progress dot or micro-bar showing
     that day's completion (e.g. faint = future, filled green = done, red ring =
     has an overdue post).
   - The currently SELECTED day is visually distinct from "today" (selected = solid
     gold fill or strong border). Default selected = today.
   - A subtle hint "elige un día" / down-chevron showing the panel below reacts to it.

4) PER-CLIENT DRILL-DOWN PANEL (below the selector, reacts to the selected day)
   - Section label: the selected day, e.g. "Jueves · por cliente".
   - A list of rows, one per client that has posts that day. Each row:
       • Client name (truncates if long), optional tiny client avatar/logo circle.
       • A compact progress indicator: a row of small dots, one per planned post,
         filled green = publicado, hollow = pendiente, red = atrasado. (e.g. ●●●○)
       • A fraction "3/4".
       • The posting time "14:00" (Clock icon) OR a red "⚠ atrasado" chip if past due
         and unpublished.
       • Small platform glyphs (IG/FB/TikTok/LinkedIn) for that client.
   - Rows have a quiet hover state (whole row is clickable → would deep-link to the
     production calendar filtered to that client+day).
   - Animate the panel: when a different day is selected, the rows cross-fade /
     slide-in-from-bottom with a short stagger.

STATES TO DESIGN (show them as variants)
- DEFAULT: today selected, a mix of publicado / pendiente / atrasado.
- ALL DONE (today): both rings full and green, a small celebratory check + line
  "Todo publicado hoy 🎉", drill-down rows all green.
- HAS OVERDUE: at least one atrasado — red accents on the HOY ring stat line, red
  chip in the affected client row. This should feel urgent but not alarming.
- EMPTY DAY: selected day has no posts → friendly empty state "Sin publicaciones
  programadas" with a muted calendar icon.
- LOADING / SKELETON: ring placeholders (two gray circles) + 3 shimmer rows. No logo
  splash — minimal skeletons only.
- LIVE UPDATE MOMENT: show a subtle flash/pulse on a row when its status flips to
  publicado (a brief green glow), reinforcing the "en vivo" promise.

LAYOUT & RESPONSIVE
- Full-width card. On desktop the two rings sit side by side with comfortable space;
  the day selector and drill-down span the full card width below them.
- On a narrow/mobile width: rings stack or shrink, day chips become horizontally
  scrollable, client rows stay readable (name truncates, right-side meta wraps to a
  second line rather than overflowing).
- Everything must survive long client names and small column widths — truncate with
  ellipsis, never overflow the card.

TONE
- Calm, premium, glanceable. A manager should read "are we on track right now?" in
  under two seconds from the rings, then click a day to see exactly which client is
  behind. Gold-accented, dark, modern SaaS — not playful, not corporate-stiff.

Deliver: the default desktop state as the hero, plus the variants listed above, and a
mobile width. Use real-looking Spanish sample data (clients like "Estancias del Bosque",
"PR Cardiología", times like 12:00 / 14:00 / 18:30, a mix of statuses).
```

---

## Notes for when we build it (after Pencil)

These map the design back onto the real app — no need to put them in Pencil, they're
for the implementation step:

- **Data**: query `production_tasks` joined to `clients`, filtered by `publish_date`
  for the current ISO week. Group by `client_id` for the drill-down. "Planeados" =
  count of tasks for the day; "publicados" = status `publicado`; "atrasado" = status
  not `publicado` AND `client.posting_time` already passed for today.
- **Per-client meta**: `clients.posting_time`, `clients.platforms`, `clients.name`,
  optional logo. `weekly_post_quota` can sanity-check the weekly denominator.
- **Live**: reuse the existing pattern from `components/home/weekly-compliance-card.tsx`
  — a Supabase Realtime `postgres_changes` channel (extend it to `production_tasks`)
  that debounces into `router.refresh()`, plus the "en vivo" Radio badge. Keep the
  5-min poll for Metricool-backed publish confirmations.
- **Home placement**: add near the top of `app/(dashboard)/home/page.tsx`, above or
  beside `WeeklyComplianceCard`. Server component fetches the week; the rings/drill-down
  interactivity is a `'use client'` child.
- **RBAC**: gate behind a new `cadence.read` (or reuse `weekly_compliance.read`)
  permission per CLAUDE.md, granted to owner + supervisor (+ editor if they should see it).
- **TDD**: pure day/status bucketing logic → unit tests first; the ring + drill-down →
  render/interaction tests.
```
