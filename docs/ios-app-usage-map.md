# Agency Social Dashboard — App usage map (iOS core scope)

Grounded in the live Next.js app under this repo. Primary sources:

- `components/layout/nav-items.ts` — sidebar destinations
- `lib/auth/areas.ts` — area catalogue + path access
- `lib/auth/permissions.ts` — RBAC roles
- `lib/utils/pipeline-stages.ts` — 4-column board placement
- `app/(dashboard)/*` — authenticated staff routes

This document originally froze **core** vs **secondary** for iOS v1. The native app
at `social-dashboard-ios` now implements the **full staff shell** (every `AREAS`
destination + home). Secondary rows below remain useful as product notes; they
are no longer “non-goals” for the iOS binary.

---

## Who uses the app

Staff at the agency — **not** end clients. Clients use the separate public portal / review links (`app/(portal)`, `app/(review)`), which are **out of scope** for the iOS staff app.

### Roles (`UserRole`)

| Role | Spanish label | Day-to-day focus |
|------|---------------|------------------|
| `owner` | Owner | Full access (`*`). Billing, contracts, role assignment, settings. |
| `supervisor` | Supervisor | Team + content ops; can see billing/contracts but not edit them; full production loop. |
| `editor` | Editor | Ideas, captions, production board, pipeline, clients (no billing). No team role admin. |
| `video` | Videógrafo | Recording calendar, video QC/upload, production read/edit, limited planning. |
| `team_member` | Team (legacy) | Treated like editor for permissions. |

Per-user `area_access` can further restrict destinations; owners always bypass. iOS mirrors **role defaults** when `area_access` is null.

---

## Staff production loop (core)

Typical day-to-day loop for content:

1. **Inicio (`/home`)** — landing, tasks/overview, cadence signals. Always reachable.
2. **Clientes (`/clients`)** — who the content is for; open client detail / batches.
3. **Grabación (`/recording-calendar`)** — schedule and complete shoots (especially `video` role).
4. **Pipeline (`/pipeline`)** — short board: cards are content ideas placed by furthest milestone.
5. Supporting loop surfaces (core-adjacent on web, secondary on iOS v1 unless noted):
   - Producción, Video QC, Posting — move work through edit → approve → publish.

### Pipeline board (defining product rule)

Four stages (labels as in product):

| Key | Label | Milestone rule |
|-----|-------|----------------|
| `video` | Video | Default / pre-edit (idea, grabada, hooks, captions still here) |
| `edited` | Edited Video | `status === 'producida'` and not yet in approval/publication |
| `approval` | Approval | `approval_status` is `submitted` or `approved` |
| `publication` | Publication | `published_at` set **or** `status === 'publicada'` |

**Furthest milestone wins** (checked in that order). Pure function: `computeStage` in `lib/utils/pipeline-stages.ts`. The iOS app **must** port this logic and unit-test it — not invent another board.

---

## Surfaces: core vs secondary

### Core for iOS staff app (must ship)

| Surface | Web route | Permission (area) | Why core |
|---------|-----------|-------------------|----------|
| Sign-in | `/login` (auth) | — | Session entry |
| Inicio | `/home` | always allowed | Landing / overview |
| Pipeline | `/pipeline` | `planning.read` | Production board |
| Clientes | `/clients` | `clients.read` | Client list + detail entry |
| Grabación | `/recording-calendar` | `recording.read` | Recording calendar |

Role-aware navigation: hide destinations the role cannot reach (same idea as `visibleNavItems` / `effectiveAreaHrefs`).

### Secondary on web (explicit non-goals for iOS v1)

| Surface | Route | Notes |
|---------|-------|-------|
| Runway | `/runway` | Content runway analytics |
| Lab de Ideas | `/idea-lab` | AI idea generation |
| Ideas Aprobadas | `/ideas-aprobadas` | Approval list |
| Video QC | `/video-reviews` | Full QC table (core-adjacent later) |
| Posting | `/posting` | Publish tooling / Metricool |
| Equipo | `/team` | Team admin |
| Producción | `/produccion` | Production board (later) |
| Cadencia | `/clients/cadence` | Cadence deep view |
| Calendario | `/calendar` | Editorial calendar |
| Rendimiento / Reportes / Eficiencia / Publicados | analytics | |
| Verificación / Automatización / Actividad | ops/admin | |
| Settings users/workflow | admin | |
| Inbox / Alerts / Operations / Planning | deep-link areas | |
| Client portal & review tokens | `(portal)` / `(review)` | Client-facing |

---

## iOS product intent

- **Native SwiftUI** (iPhone + iPad), adaptive shell: tabs on compact, split/sidebar on regular.
- Spanish UI labels matching staff vocabulary (Inicio, Pipeline, Clientes, Grabación).
- Same core features, iOS-native patterns — not a WKWebView of production web.
- Web remains system of record; data via repository protocol + fixtures (Supabase optional when configured).

---

## Permission gates for core destinations

| Destination | Required permission | owner | supervisor | editor | video |
|-------------|---------------------|-------|------------|--------|-------|
| Inicio | (always) | ✓ | ✓ | ✓ | ✓ |
| Pipeline | `planning.read` | ✓ | ✓ | ✓ | ✓ |
| Clientes | `clients.read` | ✓ | ✓ | ✓ | ✓ |
| Grabación | `recording.read` | ✓ | ✓ | ✓ | ✓ |

All four staff roles can reach the core set under default RBAC; finer action-level gates (create client, complete recording, etc.) still follow web permissions when mutations are wired.

---

## Sibling iOS project

Implementation lives at:

`/Users/ericperez/Nate Media/social-dashboard-ios`
