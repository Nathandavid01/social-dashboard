import type { WriteGate } from './types'

/** DRY_RUN defaults true. Only the explicit string "false" enables write consideration. */
type EnvMap = Record<string, string | undefined>

export function isDryRun(env: EnvMap = process.env): boolean {
  return env.DRY_RUN !== 'false'
}

export function writesEnabled(gate: WriteGate = {}, env: EnvMap = process.env): boolean {
  const dryRun = gate.dryRun ?? isDryRun(env)
  return dryRun === false && gate.ericApproved === true
}
