import { describe, it, expect } from 'vitest'
import { uploadBatchSummary } from './upload-batch'
import type { UploadItem, UploadPhase } from '@/lib/stores/upload-store'

function item(phase: UploadPhase, sizeBytes: number, pct: number): Pick<UploadItem, 'phase' | 'sizeBytes' | 'pct'> {
  return { phase, sizeBytes, pct }
}

describe('uploadBatchSummary', () => {
  it('el avance pesa por tamaño: un archivo de 500 MB a la mitad no es lo mismo que uno de 10 MB', () => {
    const s = uploadBatchSummary([item('subiendo', 500, 50), item('listo', 10, 100), item('en-cola', 490, 0)])
    // (250 + 10 + 0) / 1000
    expect(s.pct).toBe(26)
  })

  it('cuenta listos, total y los que esperan en cola', () => {
    const s = uploadBatchSummary([item('listo', 1, 100), item('subiendo', 1, 10), item('en-cola', 1, 0), item('en-cola', 1, 0)])
    expect(s).toMatchObject({ done: 1, total: 4, queued: 2 })
  })

  it('cancelados y duplicados no cuentan en la tanda; un error cuenta en el total pero no suma avance', () => {
    const s = uploadBatchSummary([
      item('listo', 100, 100),
      item('cancelado', 100, 40),
      item('duplicado', 100, 0),
      item('error', 100, 60),
    ])
    expect(s).toMatchObject({ done: 1, total: 2, queued: 0 })
    expect(s.pct).toBe(100)
  })

  it('vacío o sin bytes: 0 %, nunca NaN', () => {
    expect(uploadBatchSummary([]).pct).toBe(0)
    expect(uploadBatchSummary([item('subiendo', 0, 50)]).pct).toBe(0)
  })
})
