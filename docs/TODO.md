# TODO — pending requests

Tracked work not yet done. Each is implemented **test-first (TDD)** when unblocked
(see CLAUDE.md). Check off + reference the commit when completed.

## Migraciones por aplicar en prod (Supabase SQL Editor)
Las features degradan seguro hasta aplicarlas (CLAUDE.md). Proyecto `bgqdtfhelknmfudcvrzz` → SQL Editor.
- [ ] **`0032_idea_posting.sql`** — columnas Metricool en `content_ideas` (auto-publish al aprobar). Sin esto, aprobar funciona pero no postea.
- [ ] **`0034_content_idea_deadline.sql`** — columna `content_ideas.deadline` (fecha límite por video). Sin esto, ver/leer funciona; **guardar** una fecha límite falla.
- [ ] **`0041_caption_feedback.sql`** — tabla `caption_feedback` (rating 👍/👎 por caption, learning loop fase 2). Sin esto, generar captions funciona; **guardar un voto** 👍/👎 falla. La aplica Eric desde su computadora (donde están las credenciales).

## Idea detail page (`/produccion/idea/[ideaId]`)
- [x] Make the **"La idea"** section collapsible (collapse once generated). — `IdeaBriefCard`
- [x] **Stage pills** fit on one screen (no h-scroll); done stages collapse to icon. — `pipeline-timeline.tsx`
- [x] Stage dialog has a **"Trabajar en este paso →"** link to the workspace anchored at that stage. — `idea-status-bar.tsx`
- [~] **Caption per social network** in step 1 (one caption per chosen platform, AI-generated simultaneously + editable). Migration **`0030_content_idea_captions.sql`** written (table `content_idea_captions`). **BLOCKED**: apply 0030 in Supabase, then build the per-platform caption editor (uses `InlineEdit`) + a `generateCaptionsForPlatforms` action that fans out per `client.default_platforms`. Editable step-1 card (date + brief) is already done; this is the caption upgrade on top.
- [ ] **Video Editado** section (`idea-video-panel.tsx`): add an **assign-to-person** control.

## Idea Lab (`/idea-lab`)
- [x] **Idea Lab tab** — AI idea generation (reels/posts/carruseles) with optional client, content-type toggles, manual + live trend chips, inline results. Reuses `/api/generate-ideas` (now supports general no-client mode + a `trends[]` input). Gated by `ideas.edit`. — `idea-lab.tsx`, `app/(dashboard)/idea-lab/page.tsx`
- [x] **Live trends — Google Trends** "trending now" RSS for PR (`lib/integrations/trends.ts` + `/api/trends`), parsed by pure `parseTrendingRss` (`lib/utils/trends.ts`). Degrades to manual entry on failure.
- [x] **Performance-aware ideas (#1)** — pulls the client's top-performing posts (last 90 days, ranked by engagement) from Metricool `getPosts` and feeds them to the model as "study why these worked" examples. `selectTopPosts` + `fetchTopPosts`. Falls back to recency if Metricool is unavailable.
- [x] **Strategize → critique pipeline (#3)** — `/api/generate-ideas` now runs on **claude-opus-4-8 with adaptive thinking** in two passes: generate, then a skeptical critique-and-refine pass. Adds `objective` + `funnel_stage` per idea (shown as a badge). `lib/utils/idea-prompt.ts`.
- [x] **Puerto Rican cultural lens (#2 partial)** — `PR_CULTURAL_LENS` baked into every generation (local Spanish, holidays/seasons, references, realities). Plus a `MARKETING_FRAMEWORKS` playbook (hooks, AIDA/PAS, objective-per-idea, CTA).
- [ ] **Live trends — TikTok Creative Center** (trending audio + hashtags, country-filtered). Produce the same `TrendItem` shape (`source: 'tiktok'`) and merge into `/api/trends`. Unofficial endpoint — build defensively with the same []-on-failure contract as the Google source. Then badge chip source in `idea-lab.tsx`.
- [ ] **Save Lab ideas to a client** — when a client is selected, offer a "Guardar" action per idea (reuse `saveContentIdea`) so brainstorms can flow into the pipeline.
- [~] **Approve/reject + learning loop (#4)** — ✓/✗ on each Lab idea (`rateIdea`); approved ideas show in **Ideas Aprobadas** (`/ideas-aprobadas`, gated `ideas.read`) for editors/designers; both verdicts feed back into generation (`getIdeaFeedbackForPrompt` → `formatFeedbackForPrompt`). Migration **`0033_idea_lab_feedback.sql`** written. **BLOCKED**: apply 0033 in Supabase, then it persists/works end-to-end (UI + reads degrade gracefully until then). Later: also pull the *posted* idea's real Metricool performance back in (close the full loop).
- [ ] **Tune cost/latency** — two Opus passes with thinking is the "expert" setting but slower/pricier; revisit `EFFORT`/single-pass if the wait or spend is too high.

## Workflow (`/planning`)
- [ ] Pipeline **"Esta semana / Este mes" published counts**: pull **actually-published** videos from Metricool (today it's internal idea status). Use `getMetricoolWeeklyPostsByClient` / Metricool API.
- [ ] **Reassign** the assigned person inline from the assignee chip on a video row (needs a `reassignVideo` action, gated by `planning.assign`).
- [ ] Suggest the next **posting day** (per cadence/contract) when no video is scheduled for it (the recording/publish "—" cells). *(from earlier)*
- [ ] Apply migration **`0029_client_recording_interval.sql`** in Supabase, then add per-client UI to edit the recording interval.

## Member profile (`/team/[memberId]`)
- [ ] Empty state: auto-list the person's assigned videos as a **summarized task list** (instead of only "Agregar Primera Tarea").

## Avatars & client branding
- [ ] A clear **self-service entry point** for a user to edit/choose their own profile photo (avatar upload is in the user menu; make it discoverable, e.g. on their profile).
- [x] **Client logo from Metricool** on the Workflow cards (resolveClientLogo + getMetricoolPicturesByBlogId). ⚠️ Needs `METRICOOL_USER_ID` in `.env.local` to actually fetch pictures; falls back to initials otherwise. TODO: also apply to the client profile header ("MA").
- [x] **Workflow toolbar stats** redesigned as colorful chips. — `WorkflowStats`

## Responsive
- [ ] Make the **client profile tabs** (Captions, Contenido, etc.) responsive on small screens.
