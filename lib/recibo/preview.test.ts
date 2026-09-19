import { describe, expect, it } from 'vitest'
import { editedEntregasVideoId } from './preview'

function vid(partial: Record<string, unknown>) {
  return partial as never
}

describe('editedEntregasVideoId', () => {
  it('returns null when there is no edited entregas file', () => {
    expect(editedEntregasVideoId({ videos: [] })).toBeNull()
    expect(
      editedEntregasVideoId({
        videos: [vid({ id: 'r1', kind: 'raw', storage_provider: 'r2', status: 'uploaded', drive_file_id: 'x' })],
      }),
    ).toBeNull()
  })

  it('picks the latest live edited entregas-r2 video', () => {
    expect(
      editedEntregasVideoId({
        videos: [
          vid({
            id: 'old',
            kind: 'edited',
            storage_provider: 'entregas-r2',
            status: 'uploaded',
            drive_file_id: 'k1',
            uploaded_at: '2026-09-01T00:00:00Z',
          }),
          vid({
            id: 'new',
            kind: 'edited',
            storage_provider: 'entregas-r2',
            status: 'uploaded',
            drive_file_id: 'k2',
            uploaded_at: '2026-09-19T12:00:00Z',
          }),
          vid({
            id: 'arch',
            kind: 'edited',
            storage_provider: 'entregas-r2',
            status: 'archived',
            drive_file_id: 'k3',
            uploaded_at: '2026-09-20T00:00:00Z',
          }),
        ],
      }),
    ).toBe('new')
  })
})
