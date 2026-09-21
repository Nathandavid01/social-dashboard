import { describe, expect, it } from 'vitest'
import { requiredForOnsite } from '../../onsite/slot-count'
import { applyVideographerAssignment, loadFixtureSnapshot } from './code-agent'
import { runRecordingOpsCycle } from './orchestrator'
import { RECORDING_OPS_TIMEZONE, SIN_VIDEO_LABEL } from './types'

const WINDOW = { from: '2026-09-21', to: '2026-09-27' }

describe('recording-ops orchestrator digest', () => {
  const snapshot = loadFixtureSnapshot()
  const digest = runRecordingOpsCycle({
    snapshot,
    window: WINDOW,
    now: new Date('2026-09-21T14:00:00Z'),
  })

  it('emits the DailyDigest shape (dry-run, no writes)', () => {
    expect(digest.timezone).toBe(RECORDING_OPS_TIMEZONE)
    expect(digest.window).toEqual(WINDOW)
    expect(digest.dryRun).toBe(true)
    expect(digest.writeActions).toEqual([])
    expect(digest.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(Array.isArray(digest.scheduler)).toBe(true)
    expect(Array.isArray(digest.unconfirmed)).toBe(true)
    expect(Array.isArray(digest.reminders)).toBe(true)
    expect(Array.isArray(digest.ideas)).toBe(true)
    expect(Array.isArray(digest.videographerGaps)).toBe(true)
  })

  it('counts only scheduled sessions inside the date window', () => {
    expect(digest.sessionCount).toBe(4)
    expect(digest.scheduler.flatMap((row) => row.sessionIds).sort()).toEqual(
      ['s1', 's2', 's3', 's5'].sort(),
    )
  })

  it('groups scheduler messages by videographer, including SIN VIDEO', () => {
    const names = digest.scheduler.map((row) => row.videographerName)
    expect(names).toContain('Ana Rivera')
    expect(names).toContain(SIN_VIDEO_LABEL)
    const ana = digest.scheduler.find((row) => row.videographerId === 'v1')
    expect(ana?.days).toEqual(['2026-09-22', '2026-09-24'])
    expect(ana?.message).toMatch(/Ana Rivera/)
  })

  it('lists unconfirmed scheduled clients and drafts unsent reminders', () => {
    const ids = digest.unconfirmed.map((row) => row.sessionId).sort()
    expect(ids).toEqual(['s1', 's2', 's5'])
    expect(digest.unconfirmed.find((row) => row.sessionId === 's5')?.missingSides).toEqual([
      'videographer',
    ])
    expect(digest.reminders).toHaveLength(digest.unconfirmed.length)
    expect(digest.reminders.every((row) => row.send === false)).toBe(true)
  })

  it('uses requiredForOnsite quotas and the existing editor assignee', () => {
    const cafe = digest.ideas.find((row) => row.sessionId === 's1')
    const expected = requiredForOnsite({
      postingDays: [1, 4],
      ref: new Date('2026-09-22T12:00:00'),
    }).slotTarget
    expect(cafe?.requiredCount).toBe(expected)
    expect(cafe?.linkedCount).toBe(2)
    expect(cafe?.pendingCount).toBe(Math.max(0, expected - 2))
    expect(cafe?.assigneeId).toBe('e1')
    expect(cafe?.assigneeName).toBe('Marta Editor')
  })

  it('flags SIN VIDEO gaps and never applies a write from the cycle', () => {
    const gap = digest.videographerGaps.find((row) => row.sessionId === 's2')
    expect(gap?.label).toBe(SIN_VIDEO_LABEL)
    expect(gap?.currentVideographerId).toBeNull()
    expect(gap?.proposedVideographerId).toBe('v1')
    expect(digest.writeActions).toEqual([])
  })
})

describe('recording-ops write gate', () => {
  it('refuses writes by default and stays stubbed even with Eric approval', () => {
    expect(applyVideographerAssignment({ sessionId: 's2', videographerId: 'v1' })).toEqual({
      applied: false,
      reason: expect.stringMatching(/DRY_RUN/i),
    })
    expect(
      applyVideographerAssignment(
        { sessionId: 's2', videographerId: 'v1' },
        { dryRun: false, ericApproved: true },
      ),
    ).toEqual({
      applied: false,
      reason: expect.stringMatching(/stubbed/i),
    })
  })
})
