import { describe, it, expect } from 'vitest'
import { hasPermission } from './permissions'

/**
 * `planning.intake` gates the "Video ya grabado" intake — dropping an
 * already-recorded video straight into the board (Video/Edited/Approval) and
 * bulk-adding clients to the pipeline. Owner/supervisor/editor run the content
 * pipeline; the recording-focused video role uses the recording calendar, not
 * the board intake.
 */
describe('planning.intake permission (recorded-video intake + add clients)', () => {
  it('owner, supervisor and editor may use the intake', () => {
    expect(hasPermission('owner', 'planning.intake')).toBe(true)
    expect(hasPermission('supervisor', 'planning.intake')).toBe(true)
    expect(hasPermission('editor', 'planning.intake')).toBe(true)
  })

  it('the video role and legacy team_member may NOT use the intake', () => {
    expect(hasPermission('video', 'planning.intake')).toBe(false)
    expect(hasPermission('team_member', 'planning.intake')).toBe(false)
  })

  it('a null/undefined role may not use the intake', () => {
    expect(hasPermission(null, 'planning.intake')).toBe(false)
    expect(hasPermission(undefined, 'planning.intake')).toBe(false)
  })
})
