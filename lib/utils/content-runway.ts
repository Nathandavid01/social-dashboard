/**
 * Content "runway" — how many WEEKS of content a client has buffered at each
 * pipeline stage, relative to their posting cadence. The goal is to always keep
 * at least one month (TARGET_WEEKS) ahead in Ideas, Recording, and Editing.
 *
 *   ideasWeeks    = ideas backlog       / weekly cadence   (status 'idea')
 *   recordedWeeks = recorded footage    / weekly cadence   (status 'grabada' → porEditar)
 *   editedWeeks   = edited, to publish  / weekly cadence   (status 'producida' → porPublicar)
 */

export const TARGET_WEEKS = 4

export type RunwayStatus = 'ok' | 'warn' | 'risk' | 'no_cadence'

export interface Runway {
  ideasWeeks: number | null
  recordedWeeks: number | null
  editedWeeks: number | null
  /** The weakest stage (weeks). Null when the client has no cadence. */
  minWeeks: number | null
  status: RunwayStatus
}

function weeks(count: number, weeklyCadence: number): number | null {
  if (weeklyCadence <= 0) return null
  return Math.round((count / weeklyCadence) * 10) / 10
}

export function computeRunway(input: {
  ideas: number
  porEditar: number
  porPublicar: number
  weeklyCadence: number
}): Runway {
  const { ideas, porEditar, porPublicar, weeklyCadence } = input

  if (weeklyCadence <= 0) {
    return { ideasWeeks: null, recordedWeeks: null, editedWeeks: null, minWeeks: null, status: 'no_cadence' }
  }

  const ideasWeeks = weeks(ideas, weeklyCadence)!
  const recordedWeeks = weeks(porEditar, weeklyCadence)!
  const editedWeeks = weeks(porPublicar, weeklyCadence)!
  const minWeeks = Math.min(ideasWeeks, recordedWeeks, editedWeeks)

  const status: RunwayStatus = minWeeks >= TARGET_WEEKS ? 'ok' : minWeeks >= 2 ? 'warn' : 'risk'

  return { ideasWeeks, recordedWeeks, editedWeeks, minWeeks, status }
}
