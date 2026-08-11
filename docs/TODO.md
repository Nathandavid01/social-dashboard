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

## Cadencia (home widget — impulsado por Metricool)
- [x] Widget mide cadencia configurada (posting_days = meta) vs realidad de Metricool (publicado/atrasado/pendiente). Calendario de producción ya NO alimenta el widget.
- [ ] **Optimización:** cron `app/api/cron/metricool-sync` que escriba un snapshot semanal por cliente a una tabla nueva (req. migración nueva que aplica Nathan en Supabase), para que el widget lea de la DB en vez de barrer Metricool en vivo (~60 llamadas/cargas, hoy mitigado con unstable_cache 10 min).
- [ ] Considerar mostrar "sin meta" (clientes sin posting_days) con un CTA para configurar su cadencia, ya que publican pero no cuentan para el anillo.

## Entregas — fechas cruzadas (auditoría 11 ago 2026)

Contexto: el equipo reportó que "en entregas los videos se cruzan". Se arregló
lo que era de código (la tarjeta ya muestra su fecha; las dos pantallas usan un
único criterio de día; se avisa del archivo repetido). Queda lo que exige una
decisión humana:

- [ ] **Resolver los 9 grupos de archivo duplicado.** El mismo archivo editado
  está registrado como varios videos, varios de ellos con fechas DISTINTAS —o
  sea, el mismo corte anunciado para dos días. Nadie más que quien lo subió
  puede decir cuál de las dos fechas vale, así que el tablero solo lo señala
  (aviso "Mismo archivo que otro video"). Hay que entrar y descartar el sobrante
  o corregir la fecha:

  | Archivo | Cliente | Ideas (fecha) |
  |---|---|---|
  | `La Güira 42.mp4` | La Guira | `eeb2ddb2` (08-03), `1c3aef01` (08-07), `371ce5b3` (08-07) |
  | `La Güira 47.mp4` | La Guira | `27dbd057` (08-03), `d41b0e1a` (08-05) |
  | `Guarapera63.mp4` | La Guarapera | `f6acefef` (08-02), `8524e43f` (08-07) |
  | `DS6.mov` | Dr. Soler | `c03799da` (08-05), `f8dcba88` (08-10) |
  | `DS7.mov` | Dr. Soler | `540500c9` (08-07), `d476bd95` (08-12) |
  | `Restauco132.mp4` | Restauco | `8ce31a63` (08-06), `ff5fe658` (08-07) |
  | `37 ANOS.mov` | Futones Por Sangit | `0012745e` (08-04), `bc102c14` (08-04) |
  | `HYPE COCINAS Y MAS.mp4` | Beyond PVC | `c4937507` (08-07), `b4c9bcaa` (08-07) |
  | `EXTHYPEPVC.mp4` | Beyond PVC | `bfa827b6` (08-11), `8b0dd3ab` (08-11) |

  Los tres últimos son el mismo archivo dos veces en la MISMA fecha: doble clic
  en Enviar, sobra una tarjeta.

- [ ] **Decisión de producto: qué hacer con lo atrasado.** El tablero acumula
  todo lo vencido en la semana en curso a propósito (sigue pendiente), pero hoy
  eso son **89 de 128 videos activos** con fecha pasada mezclados en las
  pestañas de esta semana — 24 solo en la de Lunes. La fecha en la tarjeta y la
  etiqueta "Atrasado" ya permiten distinguirlos, pero conviene decidir si lo
  atrasado merece su propia agrupación en vez de mezclarse. Ver el comentario en
  `entregas-board.tsx` (`ideasDelDia`), que argumenta deliberadamente a favor de
  acumular.

- [ ] **Evitar el duplicado de raíz.** Hoy cada envío hace `INSERT` en
  `content_ideas` (`createSubmittedIdea`): no existe "reemplazar el video de
  esta tarjeta", así que reenviar tras un "cambios pedidos" crea una tarjeta
  nueva en vez de actualizar la que volvió. Sería el arreglo de fondo del punto
  anterior.
