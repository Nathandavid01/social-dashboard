/**
 * Orchestrator — ordered daily cycle.
 * Code load → Scheduler → Client Confirmation → Ideas → Videographer → DailyDigest.
 * Always dry-run unless the caller passes dryRun=false (CLI never does).
 */

import { draftConfirmationReminders, listUnconfirmedClients } from './client-confirmation'
import { listScheduledInWindow } from './code-agent'
import { isDryRun } from './flags'
import { buildIdeaAssignments } from './ideas'
import { buildSchedulerAssignments } from './scheduler'
import {
  RECORDING_OPS_TIMEZONE,
  type CycleInput,
  type DailyDigest,
} from './types'
import { detectVideographerGaps } from './videographer'

export function runRecordingOpsCycle(input: CycleInput): DailyDigest {
  const dryRun = input.dryRun ?? isDryRun()
  const scheduled = listScheduledInWindow(input.snapshot.sessions, input.window)
  const scheduler = buildSchedulerAssignments(scheduled)
  const unconfirmed = listUnconfirmedClients(scheduled)
  const reminders = draftConfirmationReminders(unconfirmed)
  const ideas = buildIdeaAssignments(scheduled, input.snapshot.ideas, input.snapshot.clients)
  const videographerGaps = detectVideographerGaps(scheduled, input.snapshot.videographers)

  return {
    generatedAt: (input.now ?? new Date()).toISOString(),
    timezone: RECORDING_OPS_TIMEZONE,
    window: input.window,
    dryRun,
    sessionCount: scheduled.length,
    scheduler,
    unconfirmed,
    reminders,
    ideas,
    videographerGaps,
    writeActions: [],
  }
}
