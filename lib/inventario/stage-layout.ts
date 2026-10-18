/**
 * Layout for the 3D "gradas" (bleachers): one tier per status, most urgent
 * tier in front. Each tier wraps into rows of `perRow`; every row steps back
 * and up, like stadium seating, so the back rows are never hidden.
 *
 * Pure geometry in world units — the scene only places meshes where this says.
 */
import type { ClientStock, StockHealth } from './video-stock-core'

export const STAGE_ORDER: StockHealth[] = ['agotado', 'critico', 'bajo', 'ok', 'sin_cadencia']

export const SEAT_SPACING = 1.85
export const ROW_DEPTH = 2.0
export const ROW_RISE = 0.75
/** Extra gap between two tiers so the groups read apart. */
export const TIER_GAP = 0.9

export interface StageItem {
  clientId: string
  health: StockHealth
  row: number
  col: number
  x: number
  y: number
  z: number
}

export interface StageTier {
  health: StockHealth
  count: number
  firstRow: number
  rows: number
  /** Front edge of the tier's first row. */
  z: number
  y: number
  /** Width of the tier's widest row. */
  width: number
}

export interface StageLayout {
  items: StageItem[]
  tiers: StageTier[]
  rows: number
  /** Widest row, for camera framing. */
  width: number
  /** z of the last row (negative). */
  depth: number
  height: number
}

export function layoutStage(clients: ClientStock[], perRow: number): StageLayout {
  const per = Math.max(1, Math.floor(perRow))
  const items: StageItem[] = []
  const tiers: StageTier[] = []
  let row = 0
  let z = 0
  let width = 0

  for (const health of STAGE_ORDER) {
    const group = clients.filter((c) => c.health === health)
    if (group.length === 0) continue
    if (tiers.length > 0) z -= TIER_GAP

    const rows = Math.ceil(group.length / per)
    let tierWidth = 0
    const tierStartZ = z
    const tierStartY = row * ROW_RISE
    for (let r = 0; r < rows; r++) {
      const seats = group.slice(r * per, (r + 1) * per)
      const y = row * ROW_RISE
      seats.forEach((client, col) => {
        items.push({
          clientId: client.clientId,
          health,
          row,
          col,
          x: (col - (seats.length - 1) / 2) * SEAT_SPACING,
          y,
          z,
        })
      })
      tierWidth = Math.max(tierWidth, seats.length * SEAT_SPACING)
      row++
      z -= ROW_DEPTH
    }
    width = Math.max(width, tierWidth)
    tiers.push({ health, count: group.length, firstRow: row - rows, rows, z: tierStartZ, y: tierStartY, width: tierWidth })
  }

  return { items, tiers, rows: row, width, depth: z + ROW_DEPTH, height: Math.max(row - 1, 0) * ROW_RISE }
}

/**
 * Bend a straight row into an amphitheater arc around a point `radius` in
 * front of the front row. Row offset `x` becomes arc length, so seat spacing
 * is preserved; deeper rows (more negative z) sit on larger radii.
 */
export function toArc(x: number, z: number, radius: number): { x: number; z: number; angle: number } {
  const r = radius - z
  const angle = x / r
  return { x: r * Math.sin(angle), z: radius - r * Math.cos(angle), angle }
}
