# Anti-wrong-client safeguard — confirmation on Approve

**Date:** 2026-05-29
**Scope (buildable now):** add a deliberate confirmation step to the **Aprobar** action,
showing the client's identity, so a video is never green-lit for the wrong client.

## Context

The risk the user wants to prevent: posting a video to the wrong client's social
accounts. There is **no in-app publish/schedule flow yet** (Metricool is blocked
account-side), so the closest real "commit" point is **approval** — `approveIdea`,
triggered from `ApprovalButton` inside the per-client `VideoCard` (`/video-reviews`).

`VideoCard` already receives `clientName` + `clientLogoUrl` (from `ClientVideoSection`)
and already shows `ClientLogo` on the card. So client identity is present; what's
missing is a deliberate confirm before approving.

## Design

**Confirmation dialog on "Aprobar".** Clicking *Aprobar* (only shown for
`approval_status === 'submitted'`) opens a shadcn `Dialog` that shows:
- `ClientLogo` + **client name** (prominent),
- the video title,
- *"Verifica que sea del cliente correcto."*
- Footer: **Cancelar** / **Sí, aprobar**.

`approveIdea(ideaId)` fires **only** after "Sí, aprobar". *Enviar a revisión* and
*Pedir revisión* stay one-click (lower stakes). If `clientName` is absent (other
callers), the dialog still works with a generic label.

**Wiring:** `VideoCard` passes `clientName`, `clientLogoUrl`, `ideaTitle={video.title}`
to `ApprovalButton` (new optional props).

## Deferred — structural lock

A hard `assertVideoBelongsToClient(videoId, clientId)` guard belongs in the future
Metricool/publish action, where a video and a target social account are chosen
separately and could mismatch. Today no action crosses video↔client (a video is bound
to its idea→client), so the guard would have no caller. Documented here as its home.

## Tests (extend `approval-button.test.tsx`)

1. Clicking *Aprobar* does **not** call `approveIdea` immediately (opens the dialog).
2. Confirming ("Sí, aprobar") calls `approveIdea` with the idea id.
3. The dialog surfaces the client name.
4. Existing role/status matrix tests still pass.
