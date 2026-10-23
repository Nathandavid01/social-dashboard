/**
 * recording-ops:digest — fixture-backed dry-run. Prints DailyDigest JSON.
 *
 * Never calls write helpers. Ignores DRY_RUN=false and RECORDING_OPS_SOURCE=live.
 *
 * Usage:
 *   npm run recording-ops:digest
 *   npm run recording-ops:digest -- --from 2026-09-21 --to 2026-09-27
 */

import { addDaysISO, todayISOInTimeZone } from '../../utils/deadlines'
import { loadFixtureSnapshot } from './code-agent'
import { runRecordingOpsCycle } from './orchestrator'
import { RECORDING_OPS_TIMEZONE, type DateWindow } from './types'

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

function argValue(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag)
  if (index === -1) return undefined
  return argv[index + 1]
}

export function defaultWindow(now: Date = new Date()): DateWindow {
  const from = todayISOInTimeZone(RECORDING_OPS_TIMEZONE, now)
  return { from, to: addDaysISO(from, 6) }
}

export function parseDigestArgs(
  argv: string[],
  now: Date = new Date(),
): { window: DateWindow; fixtures: string | undefined } {
  const from = argValue(argv, '--from')
  const to = argValue(argv, '--to')
  const fixtures = argValue(argv, '--fixtures')
  const fallback = defaultWindow(now)
  if (from && !ISO_DAY.test(from)) throw new Error(`Invalid --from ${from}`)
  if (to && !ISO_DAY.test(to)) throw new Error(`Invalid --to ${to}`)
  return {
    window: { from: from ?? fallback.from, to: to ?? fallback.to },
    fixtures,
  }
}

export function runDigestCli(options: {
  argv?: string[]
  env?: Record<string, string | undefined>
  now?: Date
  stdout?: (line: string) => void
  stderr?: (line: string) => void
}): { digestJson: string; exitCode: number } {
  const env = options.env ?? process.env
  const stderr = options.stderr ?? ((line) => console.error(line))
  const stdout = options.stdout ?? ((line) => console.log(line))

  if (env.RECORDING_OPS_SOURCE === 'live') {
    stderr('recording-ops:digest is fixture-only in this scaffold. Live reads are disabled.')
    return { digestJson: '', exitCode: 2 }
  }
  if (env.DRY_RUN === 'false') {
    stderr('recording-ops:digest ignores DRY_RUN=false; CLI always stays dry-run (no writes).')
  }

  const { window, fixtures } = parseDigestArgs(options.argv ?? process.argv.slice(2), options.now)
  const snapshot = loadFixtureSnapshot(fixtures)
  const digest = runRecordingOpsCycle({
    snapshot,
    window,
    now: options.now,
    dryRun: true,
  })
  const digestJson = JSON.stringify(digest, null, 2)
  stdout(digestJson)
  return { digestJson, exitCode: 0 }
}

const isDirect = process.argv[1] && /recording-ops\/cli\.(ts|js)$/.test(process.argv[1].replaceAll('\\', '/'))
if (isDirect) {
  const result = runDigestCli({})
  process.exit(result.exitCode)
}
