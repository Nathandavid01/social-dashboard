import { describe, expect, it } from 'vitest'
import { ideaTieneEditadoEntregas } from './enviar-al-cliente'

describe('ideaTieneEditadoEntregas', () => {
  it('requires a live edited file in entregas-r2', () => {
    expect(ideaTieneEditadoEntregas({ videos: [] })).toBe(false)
    expect(
      ideaTieneEditadoEntregas({
        videos: [{ kind: 'raw', storage_provider: 'r2', status: 'uploaded', drive_file_id: 'x' } as never],
      }),
    ).toBe(false)
    expect(
      ideaTieneEditadoEntregas({
        videos: [
          {
            kind: 'edited',
            storage_provider: 'entregas-r2',
            status: 'uploaded',
            drive_file_id: 'entregas/i/edited/a.mp4',
          } as never,
        ],
      }),
    ).toBe(true)
    expect(
      ideaTieneEditadoEntregas({
        videos: [
          {
            kind: 'edited',
            storage_provider: 'entregas-r2',
            status: 'archived',
            drive_file_id: 'entregas/i/edited/a.mp4',
          } as never,
        ],
      }),
    ).toBe(false)
  })
})
