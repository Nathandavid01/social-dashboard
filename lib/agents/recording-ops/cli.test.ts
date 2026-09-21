import { describe, expect, it } from 'vitest'
import { parseDigestArgs, runDigestCli } from './cli'
import { RECORDING_OPS_TIMEZONE } from './types'

describe('recording-ops:digest CLI', () => {
  it('parses an explicit window and stays fixture-only', () => {
    expect(parseDigestArgs(['--from', '2026-09-21', '--to', '2026-09-27'])).toEqual({
      window: { from: '2026-09-21', to: '2026-09-27' },
      fixtures: undefined,
    })
  })

  it('prints a dry-run digest JSON and refuses live source', () => {
    const lines: string[] = []
    const result = runDigestCli({
      argv: ['--from', '2026-09-21', '--to', '2026-09-27'],
      now: new Date('2026-09-21T14:00:00Z'),
      stdout: (line) => lines.push(line),
      stderr: () => undefined,
    })
    expect(result.exitCode).toBe(0)
    const digest = JSON.parse(result.digestJson) as { dryRun: boolean; timezone: string; sessionCount: number }
    expect(digest.dryRun).toBe(true)
    expect(digest.timezone).toBe(RECORDING_OPS_TIMEZONE)
    expect(digest.sessionCount).toBe(4)

    const blocked = runDigestCli({
      argv: [],
      env: { RECORDING_OPS_SOURCE: 'live' },
      stderr: () => undefined,
    })
    expect(blocked.exitCode).toBe(2)
    expect(blocked.digestJson).toBe('')
  })
})
