<!--
Sync Impact Report
- Version change: (none) → 1.0.0
- Modified principles: initial adoption
- Added sections: Core Principles (I–V), Product Constraints, Delivery Workflow, Governance
- Removed sections: none
- Deferred: none
-->

# Nate Media Social Dashboard Constitution

## Core Principles

### I. One Action, One Record
A human action (approve, save copy, send to publish) MUST travel with exactly one
idea and exactly one video file — the ones on the screen they used. A leftover
file from another week, another board, or another idea of the same client MUST
NOT ride that action.

**Rationale**: The team already lost work when last week's video of the same
client was scheduled after this week's approval.

### II. Two Boards Stay Two Graphs
Pipeline (Eric / `/review`) and Entregas (`/aprobacion`, Copy, Publicación)
MUST remain separate graphs until a row is proven to live on only one board.
Stage functions MUST NOT claim they stay in sync if they disagree.

**Rationale**: Shared `content_ideas.id` plus two media selectors is two graphs,
not one flow.

### III. Test-First (NON-NEGOTIABLE)
Every new behavior MUST have a failing test before the implementation is
considered done. Tests MUST cover the UI or the published artifact when the
change is visible. Edge cases (empty, leftover file, other idea of same client)
MUST be tested.

**Rationale**: Untested picker rules regressed into the wrong video on Metricool.

### IV. Staging Before Truth
A change is not "done" until it is verified against staging when it touches
auth, publish, or client-visible flow. Production SQL MUST NOT be applied
unless the owner pastes it. Secrets pasted in chat MUST NOT be written to git.

**Rationale**: The team always tests in staging; CLI often lacks prod DDL.

### V. Visible Change, Visible Proof
Every user-visible change MUST bump the app version, add a Spanish changelog
entry, and ship a production-faithful HTML preview. UI copy MUST be Spanish.

**Rationale**: Non-technical review happens in the preview, not in the PR diff.

## Product Constraints

- Captions exist only when there is a video.
- One caption is used for all networks of the client.
- Auto-publish to Metricool MUST use the file the approver saw, not "latest
  edited" across buckets or clients.
- Never push `main` except via PR.

## Delivery Workflow

1. Spec (this kit) before more graph changes to publish/approve.
2. Plan and tasks before implement.
3. TDD → staging check when required → PR. No merge unless asked.

## Governance

This constitution supersedes informal comments in code that contradict it
("these stage functions stay in step"). Amendments require a version bump,
a dated note here, and a PR. Reviews MUST reject a change that publishes
another idea's or another week's file for the same client.

**Version**: 1.0.0 | **Ratified**: 2026-08-13 | **Last Amended**: 2026-08-13
