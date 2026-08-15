# Tasks: Approve the same file that is scheduled

**Input**: Design documents from `/specs/001-approve-same-file/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Required (constitution III + project TDD)

## Phase 1: Setup

- [x] T001 Spec Kit constitution + spec in `specs/001-approve-same-file/`
- [x] T002 Plan, research, data-model, contracts, quickstart in `specs/001-approve-same-file/`

---

## Phase 2: Foundational (shipped v3.28–v3.32)

- [x] T003 Picker never selects another idea of the same client in `lib/utils/idea-posting-core.ts`
- [x] T004 Entregas cut wins on lote approve (`inferWatchBoard`) in `lib/utils/idea-posting-core.ts`
- [x] T005 Card key per video in `lib/entregas/batches.ts` + `components/entregas/entregas-board.tsx`
- [x] T006 Copy loads by ideaId in `lib/actions/entregas-copy.ts`
- [x] T007 Caption queries `idea_id` in `lib/actions/idea-captions.ts`
- [x] T008 Pipeline `/review` mint requires live r2 in `lib/actions/review-staff.ts`

---

## Phase 3: User Story 1 — this week's file is scheduled (P1) 🎯 MVP

**Goal**: Metricool never gets the other board's leftover when the watched board has no file.

**Independent Test**: `watchedOn: 'pipeline'` with only an Entregas file → pick is null (no post).

- [x] T009 [US1] Fail closed when `watchedOn` board has zero live files in `lib/utils/idea-posting-core.ts`
- [x] T010 [US1] Test fail-closed in `lib/utils/idea-posting-core.test.ts`
- [x] T011 [US1] Include public URL on `posted_to_metricool` in `lib/actions/idea-posting-run.ts`

---

## Phase 4: User Story 2 — pipeline review stays on pipeline file (P2)

**Independent Test**: Mint `/review` with Entregas-only idea → Spanish refuse (already T008).

- [x] T012 [US2] `generateReviewLink` requires `storage_provider = r2` in `lib/actions/review-staff.ts`
- [x] T013 [US2] `/review` autopost uses preferred r2 only; if missing, skip — verify `lib/actions/review-autopost.ts`

---

## Phase 5: User Story 3 — Entregas vote does not schedule (P3)

**Independent Test**: `votarRevisionPublica` never calls `runIdeaPost` / `maybeAutoPostIdea`.

- [x] T014 [US3] Test Entregas public approve does not post in `lib/actions/entregas-client-review.metricool.test.ts`
- [ ] T015 [US3] Spanish staff copy that client vote ≠ Metricool (only if UI is missing)

---

## Phase 6: Polish

- [x] T016 Changelog + version if user-visible; otherwise note in `CHANGELOG.md`
- [x] T017 Run `npx vitest run` on touched tests

## Dependencies

US1 (T009–T011) first. US2 mostly done. US3 independent.

## MVP

T009–T011 + T017. That is the remaining hole for “perfect Metricool upload”.
