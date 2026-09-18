import { describe, expect, it } from 'vitest'
import {
  PRIMER_ROUND_UPLOAD_MAX_BYTES,
  assertPrimerRoundUploadSize,
  formatPrimerRoundUploadBytes,
} from './upload-limits'

describe('Primer Round upload size cap', () => {
  it('allows up to 500 MB', () => {
    expect(PRIMER_ROUND_UPLOAD_MAX_BYTES).toBe(500 * 1024 * 1024)
    expect(assertPrimerRoundUploadSize(1)).toBeNull()
    expect(assertPrimerRoundUploadSize(PRIMER_ROUND_UPLOAD_MAX_BYTES)).toBeNull()
  })

  it('rejects empty and oversized files with a Spanish 500 MB message', () => {
    expect(assertPrimerRoundUploadSize(0)).toMatch(/Falta el archivo/i)
    expect(assertPrimerRoundUploadSize(PRIMER_ROUND_UPLOAD_MAX_BYTES + 1)).toMatch(/500 MB/i)
  })

  it('formats bytes for the UI', () => {
    expect(formatPrimerRoundUploadBytes(PRIMER_ROUND_UPLOAD_MAX_BYTES)).toBe('500 MB')
  })
})
