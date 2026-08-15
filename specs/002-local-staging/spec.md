# Feature Specification: Local staging

**Feature Branch**: `eric/asignaciones-por-empleado`

**Created**: 2026-08-13

**Status**: Draft

**Input**: User description: "Use the plan to create a local staging so we can verify videos and the dashboard without touching production."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open staging on this computer (Priority: P1)

A teammate starts local staging and signs in against the staging project. They can click Entregas, approve, and Copy without changing live client posts.

**Why this priority**: Production must not be the place we try Metricool uploads.

**Independent Test**: Start local staging, open the URL, log in with the staging owner. The data project is staging, not production.

**Acceptance Scenarios**:

1. **Given** staging credentials exist on disk, **When** they start local staging, **Then** the app is reachable in the browser on the staging port.
2. **Given** the env file accidentally points at production, **When** they start local staging, **Then** it refuses to start and says so in Spanish.

---

### User Story 2 - Prove we are not on production (Priority: P2)

The person looking at the screen can tell this is staging. Automated checks refuse to run if the project is production.

**Why this priority**: A silent prod connection would schedule real posts.

**Independent Test**: Point the env at a non-staging URL and start. Process exits with an error.

**Acceptance Scenarios**:

1. **Given** the staging project ref is missing from the URL, **When** start is attempted, **Then** nothing listens and an error names staging.
2. **Given** staging is running, **When** they load the app, **Then** they can sign in as the staging owner.

### Edge Cases

- Missing env file: refuse, do not fall back to `.env.local` (that may be production).
- Port already in use: next/dev reports it; do not silently switch to production port 3020.
- Staging server was killed after a long run: start again with the same command.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The team MUST be able to run a local copy of the dashboard that talks only to the staging data project.
- **FR-002**: Start MUST refuse if the configured project is not staging.
- **FR-003**: Start MUST refuse if the staging env file is missing.
- **FR-004**: Local staging MUST use its own build folder so it does not collide with the production-local server.
- **FR-005**: Login for verification MUST use the staging owner account, not a production user.

### Key Entities

- **Staging project**: Isolated data copy (not live clients).
- **Local staging server**: Dashboard process on this machine aimed at that project.
- **Staging owner**: Person used to click through approve / Copy.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From a cold start, a teammate reaches a sign-in screen in under 2 minutes.
- **SC-002**: A mis-pointed env never starts (0 successful boots against production).
- **SC-003**: They can complete a click-through of Entregas without writing to production.

## Assumptions

- Staging credentials already live in a local env file that is not committed.
- Staging port stays 3022; production-local stays 3020.
- Metricool on staging may be a sandbox or skipped; the important part is not production data.
