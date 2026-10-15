/**
 * Camera rules for the 3D inventory. The scene flies the camera when you pick
 * a client or reset; between flights the person drives: wheel / pinch zooms
 * toward the cursor, drag tilts, right-drag / two fingers move.
 */
export interface CameraControlsConfig {
  enableZoom: boolean
  zoomToCursor: boolean
  enablePan: boolean
  screenSpacePanning: boolean
  minDistance: number
  maxDistance: number
}

export function cameraControls(overviewDist: number): CameraControlsConfig {
  return {
    enableZoom: true,
    zoomToCursor: true,
    enablePan: true,
    screenSpacePanning: true,
    minDistance: 3.5,
    maxDistance: overviewDist * 1.6,
  }
}

/** A flight ends when the target is within `targetGap` and distance within `distGap` of the goal. */
export function flightArrived(targetGap: number, distGap: number): boolean {
  return targetGap < 0.05 && distGap < 0.05
}
