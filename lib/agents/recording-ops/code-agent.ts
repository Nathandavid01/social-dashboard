/**
 * Code agent — source-of-truth adapter.
 *
 * Read helpers are pure over an injected snapshot (fixtures by default).
 * They do not import `lib/supabase/server.ts` or `'use server'` actions.
 *
 * A future live reader should load the same snapshot shape via existing
 * `getRecordingSessions` / `content_ideas` selects, gated by `recording.read`.
 * Never add a second FK between content_ideas and content_idea_videos.
 *
 * Write helpers are stubbed. CLI must not call them.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  effectiveConfirmationStatus,
  hasClientConfirmed,
  hasVideographerConfirmed,
} from '../../utils/recording-confirmation'
import { isDryRun, writesEnabled } from './flags'
import type {
  DateWindow,
  RecordingOpsSnapshot,
  RecordingSession,
  SessionIdea,
  WriteGate,
} from './types'

const FIXTURE_FILE = 'fixtures/snapshot.json'

function packageDir(): string {
  return dirname(fileURLToPath(import.meta.url))
}

export function defaultFixturePath(): string {
  return join(packageDir(), FIXTURE_FILE)
}

export function loadFixtureSnapshot(path: string = defaultFixturePath()): RecordingOpsSnapshot {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as RecordingOpsSnapshot
  return {
    sessions: raw.sessions ?? [],
    ideas: raw.ideas ?? [],
    clients: raw.clients ?? [],
    videographers: raw.videographers ?? [],
  }
}

export function listSessionsInWindow(
  sessions: RecordingSession[],
  window: DateWindow,
): RecordingSession[] {
  return sessions
    .filter((session) => session.session_date >= window.from && session.session_date <= window.to)
    .slice()
    .sort((a, b) => a.session_date.localeCompare(b.session_date) || a.id.localeCompare(b.id))
}

export function listScheduledInWindow(
  sessions: RecordingSession[],
  window: DateWindow,
): RecordingSession[] {
  return listSessionsInWindow(sessions, window).filter((session) => session.status === 'scheduled')
}

/** Missing videographer = `videographer_id` null / blank (calendar: Sin Videógrafo). */
export function listMissingVideographer(sessions: RecordingSession[]): RecordingSession[] {
  return sessions.filter((session) => !session.videographer_id?.trim())
}

export function listUnconfirmed(sessions: RecordingSession[]): RecordingSession[] {
  return sessions.filter((session) => effectiveConfirmationStatus(session) !== 'confirmed')
}

export function countLinkedIdeas(session: RecordingSession, ideas: SessionIdea[]): number {
  const ids = new Set(
    ideas
      .filter(
        (idea) =>
          idea.recording_session_id === session.id &&
          idea.client_id === session.client_id &&
          idea.status !== 'descartada' &&
          Boolean(idea.title?.trim()),
      )
      .map((idea) => idea.id),
  )
  return ids.size
}

export function confirmationMissingSides(
  session: RecordingSession,
): Array<'client' | 'videographer'> {
  const missing: Array<'client' | 'videographer'> = []
  if (!hasClientConfirmed(session)) missing.push('client')
  if (!hasVideographerConfirmed(session)) missing.push('videographer')
  return missing
}

/**
 * Write stub. Default path is dry-run.
 * Even with DRY_RUN=false and ericApproved, this scaffold does not mutate rows —
 * production writes stay on `updateRecordingSession` (`recording.create` + `recording.brief`).
 */
export function applyVideographerAssignment(
  _input: { sessionId: string; videographerId: string },
  gate: WriteGate = {},
): { applied: false; reason: string } {
  if (!writesEnabled(gate)) {
    const dry = gate.dryRun ?? isDryRun()
    return {
      applied: false,
      reason: dry
        ? 'blocked: DRY_RUN=true (default). No production write.'
        : 'blocked: ericApproved=false. Recording-ops writes need an Eric-approved path.',
    }
  }
  return {
    applied: false,
    reason:
      'stubbed: this scaffold does not write. After Eric approval use updateRecordingSession (recording.create + recording.brief).',
  }
}
