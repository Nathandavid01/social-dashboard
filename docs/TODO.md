# TODO — pending requests

Tracked work not yet done. Each is implemented **test-first (TDD)** when unblocked
(see CLAUDE.md). Check off + reference the commit when completed.

## Idea detail page (`/produccion/idea/[ideaId]`)
- [x] Make the **"La idea"** section collapsible (collapse once generated). — `IdeaBriefCard`
- [x] **Stage pills** fit on one screen (no h-scroll); done stages collapse to icon. — `pipeline-timeline.tsx`
- [x] Stage dialog has a **"Trabajar en este paso →"** link to the workspace anchored at that stage. — `idea-status-bar.tsx`
- [ ] **Caption**: generate with AI **automatically and simultaneously per chosen social network** (one caption per platform in `client.default_platforms`), not a single platform. Needs schema for per-platform captions + multi-call generation. *Product decision: store where? `content_idea_captions` table?*
- [ ] **Video Editado** section (`idea-video-panel.tsx`): add an **assign-to-person** control.

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
