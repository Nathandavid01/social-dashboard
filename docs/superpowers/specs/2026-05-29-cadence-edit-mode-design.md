# Cadence Day Picker — Deliberate Edit Mode

**Date:** 2026-05-29
**Component:** `components/planning/inline-day-picker.tsx` (single usage: `components/planning/planning-board.tsx:214`)

## Problem

The inline day picker toggles a posting day and **saves immediately** on each click. In the
dense planning board an accidental tap silently changes a client's cadence. The user wants a
deliberate step before editing so they can't confuse themselves.

## Design

Introduce an explicit edit mode.

### Read mode (default)
- Days render with the same selected/unselected styling, but are **not interactive** (no toggle,
  no save). They are visual only.
- A small **✏️ Editar** button sits to the right of the days.

### Edit mode (after tapping "Editar")
- Days become clickable toggles operating on a **local draft** — nothing is persisted yet.
- **✓ Guardar** and **✕ Cancelar** buttons appear.
- **Guardar** calls `setClientPostingDays(clientId, draft)`. Optimistic per house style; while the
  request is in flight the buttons are disabled. On error → toast + stay in edit mode with the
  draft intact for retry. On success → exit edit mode, committed days become the draft.
- **Cancelar** discards the draft, reverts to the last committed days, exits edit mode.

### Edge cases
- **0 days selected + Guardar:** allowed (= "Sin cadencia"), matching current behavior. Guardar is
  never disabled for empty selection.
- **Save in flight:** all buttons disabled; Cancelar ignored until settled.
- **Save error:** edit mode stays open, draft preserved, destructive toast shown.

### Preserved behavior
- `onClick` `stopPropagation` is kept so editing never expands/collapses the client row.

## Tests (vitest + Testing Library)

1. Read mode renders days + "Editar"; clicking a day does **not** call `setClientPostingDays`.
2. Clicking "Editar" reveals Guardar/Cancelar and makes days clickable.
3. Toggling a day in edit mode changes the visual selection but does **not** call the action yet.
4. Guardar calls `setClientPostingDays` with the edited draft, then returns to read mode.
5. Cancelar reverts the draft to the initial days and returns to read mode without calling the action.
6. 0-day draft + Guardar still calls the action with `[]` (Sin cadencia allowed).
