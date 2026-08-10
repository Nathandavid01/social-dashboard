## Summary
<!-- What changed and why (1–5 bullets). -->

## Type of change
- [ ] Fix
- [ ] Feature
- [ ] Migration / data
- [ ] Docs / CI only

## Dual-R2 checklist (if touching video storage)
- [ ] Did **not** reintroduce a second FK between `content_ideas` and `content_idea_videos`
- [ ] Editor uploads still register as `storage_provider: 'entregas-r2'` (not pipeline `'r2'`)
- [ ] Previews use the matching provider (Entregas vs pipeline)

## Merge rules (mandatory)
This PR may only land on `main` if **all** are true:

1. **PR path only** — no direct commits/pushes to `main`
2. **CI green** — `merge-gate` + `test` + `relationship-guard` (static)
3. **Human review** — at least one approving review
4. **Graph model** — `scripts/merge-gate.mjs` passed (same graph CI runs)

## Test plan
- [ ] `npm run merge-gate` locally
- [ ] Manual path exercised (describe):

## Risk
<!-- What could break in production? -->
