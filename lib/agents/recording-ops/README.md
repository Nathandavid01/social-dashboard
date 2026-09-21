# Recording-ops agent squad / Escuadrón Grabación

Scaffold **read-first** for the Grok Bot agents. It reads existing Nate Media
dashboard shapes (`recording_sessions`, `content_ideas`, `clients`) and prints a
`DailyDigest` JSON. **Dry-run by default. No production writes. No email/Slack send.**

Paquete de andamiaje: lee los datos de Grabación que ya existen y arma un digest
diario. **No muta filas. No manda recordatorios.**

## Agents / Roles

| Agent | File | Input | Output |
| --- | --- | --- | --- |
| **Orchestrator** | `orchestrator.ts` | snapshot + date window | `DailyDigest` JSON |
| **Scheduler** | `scheduler.ts` | scheduled sessions | assignment messages (who records which days) |
| **Client Confirmation** | `client-confirmation.ts` | unconfirmed sessions | `UnconfirmedClient[]` + draft `ReminderPayload` (`send: false`) |
| **Ideas** | `ideas.ts` | sessions + ideas + clients | `IdeaAssignment[]` (quota + editor) |
| **Videographer** | `videographer.ts` | SIN VIDEO gaps | `VideographerGap[]` (proposal only) |
| **Code** | `code-agent.ts` | fixtures (default) | snapshot + read helpers; write stubs |

Nate roles this maps to (unchanged RBAC):

- **owner / supervisor** — agenda + confirm (`recording.create`, `recording.brief`, `operations.overview`)
- **video** — graba (`recording.complete`); no `recording.brief`
- **editor** — ideas via `clients.assigned_to` (not a write from this package)

## Daily handoff sequence

1. **Code load** — sessions in the `America/Puerto_Rico` calendar window (scheduled only).
2. **Scheduler** — group by videographer / `SIN VIDEO`.
3. **Client Confirmation** — dual-party Confirmada (`client_confirmed_at` **and** `videographer_confirmed_at`). Draft reminders, do not send.
4. **Ideas** — `requiredForOnsite({ postingDays, ref })` (same quota as On Site / recording-pending) + editor assignee.
5. **Videographer** — detect `videographer_id` null (`SIN VIDEO` / calendar *Sin Videógrafo*). Propose only.
6. **Compose** one `DailyDigest` JSON.

Confirmada is **not** “has client + videographer + start_time”. Field-complete ≠ confirmed.

## Dry-run vs write

| Flag | Default | Effect |
| --- | --- | --- |
| `DRY_RUN` | **`true`** (any value except the string `false`) | No writes. CLI always behaves as dry-run. |
| `ericApproved` | `false` (function arg only) | Required together with `DRY_RUN=false` before a write stub even considers proceeding. |
| `RECORDING_OPS_SOURCE` | `fixtures` | CLI **refuses** `live`. This scaffold never opens Supabase. |

Write helper `applyVideographerAssignment` is **stubbed**: even with `DRY_RUN=false` and `ericApproved: true` it returns `{ applied: false }` and tells you to use existing `updateRecordingSession` (`recording.create` + `recording.brief`).

**CLI never calls write helpers.**

Live path (not implemented): inject a snapshot loaded with `recording.read` via current selects (`recording_sessions` + `content_ideas.recording_session_id`). Do not add a second FK between `content_ideas` and `content_idea_videos`. Do not weaken RLS.

## Env vars

```
DRY_RUN=true                          # default; omit or set anything except "false"
RECORDING_OPS_SOURCE=fixtures         # only supported CLI source
# RECORDING_OPS_SOURCE=live           # rejected by recording-ops:digest
```

Optional CLI args (not env):

```
--from YYYY-MM-DD     # inclusive, America/Puerto_Rico calendar day
--to YYYY-MM-DD       # inclusive
--fixtures <path>     # default: lib/agents/recording-ops/fixtures/snapshot.json
```

Default window: today in `America/Puerto_Rico` through +6 days.

## CLI

```bash
npm run recording-ops:digest
npm run recording-ops:digest -- --from 2026-09-21 --to 2026-09-27
```

Prints `DailyDigest` JSON to stdout. Exit `2` if `RECORDING_OPS_SOURCE=live`.

## Existing data (do not fork)

- `recording_sessions`: `session_date`, `client_id`, `videographer_id`, `start_time`, `status`, `confirmation_status`, `client_confirmed_at`, `videographer_confirmed_at`
- `content_ideas.recording_session_id` → `content_ideas_recording_session_id_fkey`
- Idea quota: `lib/onsite/slot-count.ts` `requiredForOnsite` (posting_days × 1.5 / month)
- Confirmation: `lib/utils/recording-confirmation.ts`
- Timezone: `todayISOInTimeZone('America/Puerto_Rico')`

## Tests

```bash
npx vitest run lib/agents/recording-ops --exclude '**/.claude/**'
```
