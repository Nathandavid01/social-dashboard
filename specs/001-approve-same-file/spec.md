# Feature Specification: Approve the same file that is scheduled

**Feature Branch**: `eric/asignaciones-por-empleado`

**Created**: 2026-08-13

**Status**: Draft

**Input**: User description: "When someone approves this week's video, Metricool must receive that same file — never last week's video of the same client. Use Spec Kit. Remaining graph work after v3.28–v3.32."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Approve this week's video, schedule this week's file (Priority: P1)

An editor or client approves the video they are looking at for Gym X this week. The post that is scheduled is that same recording, with that idea's caption.

**Why this priority**: This is the failure that already happened in production-like use.

**Independent Test**: Approve this week's Gym X video while last week's Gym X video is still in the same column. Confirm the scheduled post is this week's file.

**Acceptance Scenarios**:

1. **Given** Gym X has last week's video still in Review and this week's video in Review, **When** the team approves this week's card, **Then** the scheduled post uses this week's file and last week's card stays a separate card.
2. **Given** this week's idea has an old pipeline file and a new Entregas file, **When** they approve from the lote / Entregas, **Then** the Entregas file is scheduled.
3. **Given** they open Copy from this week's card, **When** they save and send to publish, **Then** only this idea is loaded and only this file is scheduled.

---

### User Story 2 - Pipeline review stays on the pipeline file (Priority: P2)

A client who received the pipeline review link watches the pipeline cut and, if they approve, that is the file that can be scheduled on that path.

**Why this priority**: Mixing boards is how last week's leftover file gets scheduled.

**Independent Test**: Try to create a pipeline review link when the only live cut is on Entregas. The action must refuse and tell the team to use the Entregas card link.

**Acceptance Scenarios**:

1. **Given** the live cut is only on Entregas, **When** someone tries to mint a pipeline review link, **Then** they are told to use the card link instead.
2. **Given** a pipeline review link exists, **When** the client approves there, **Then** the scheduled file is the pipeline file they were shown.

---

### User Story 3 - Entregas client vote is honest about what happens next (Priority: P3)

When a client approves on the Entregas public link, the team sees a clear next step. The vote does not silently schedule last week's leftover.

**Why this priority**: Today the public approve does not move the idea's approval state; comments say it goes to Publication. That mismatch causes people to use the wrong button.

**Independent Test**: Client approves on `/aprobacion`. Staff sees the vote. Nothing is scheduled until the Entregas publish path for **that** idea.

**Acceptance Scenarios**:

1. **Given** a client approves on the Entregas link, **When** staff look at the board, **Then** they can tell this idea was approved by the client and it is not last week's idea.
2. **Given** that vote, **When** nobody has saved copy / sent to publish for this idea, **Then** Metricool does not receive a file.

---

### Edge Cases

- Two videos of the same client in the same column: each card keeps its own identity after one is approved.
- Leftover pipeline file on the same idea as this week's Entregas cut.
- Copy opened for this idea while the client has older approved ideas.
- Archived Entregas file must not be the one the client watches.
- Empty caption: approve must not schedule.
- Already scheduled: must not schedule again.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST schedule the video file that belongs to the idea being acted on, never another idea of the same client.
- **FR-002**: Approving or sending to publish from Entregas MUST use the Entregas cut when that idea has one.
- **FR-003**: Opening Copy from a card MUST load only that card's idea.
- **FR-004**: Caption generate/save MUST look up files for that idea (the real idea-to-file relationship).
- **FR-005**: A pipeline review link MUST only be created when there is a live pipeline cut to show.
- **FR-006**: Each visible card MUST remain bound to one idea after other cards of the same client move.
- **FR-007**: The public Entregas approve MUST NOT schedule a file by itself.
- **FR-008**: An archived file MUST NOT be the file shown to the client for approval (remaining; needs data-store change).

### Key Entities

- **Idea**: One planned video for one client for one week.
- **Video file**: One uploaded cut attached to one idea (pipeline or Entregas).
- **Approval action**: A human saying yes on a specific screen (lote, `/review`, `/aprobacion`, Copy).
- **Scheduled post**: The outbound post for one idea, carrying one file and one caption for all networks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a dry-run with two Gym X videos in Review, approving this week schedules this week's file 100% of the time (0 times last week's).
- **SC-002**: After approving this week's card, last week's card is still visible as a different card (not replaced).
- **SC-003**: Opening Copy never shows another idea's title or file.
- **SC-004**: Staff can complete approve → schedule for this week's video without opening last week's card.

## Assumptions

- One caption still goes to all networks.
- Captions still require a video.
- Entregas is the current delivery board for weekly client work.
- Pipeline `/review` remains for Eric's original board.
- Remaining store change for archived files on the public Entregas review is out of this spec's first ship unless the owner applies the SQL.
- Work continues on the open PR, not on `main`.
