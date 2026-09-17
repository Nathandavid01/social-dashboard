import { describe, expect, it } from 'vitest'
import {
  EDITOR_UPLOAD_MAX_BYTES,
  assertEditorUploadSize,
  formatEditorUploadBytes,
} from './limits'

describe('editor upload size cap', () => {
  it('allows up to 500 MB', () => {
    expect(EDITOR_UPLOAD_MAX_BYTES).toBe(500 * 1024 * 1024)
    expect(assertEditorUploadSize(1)).toBeNull()
    expect(assertEditorUploadSize(EDITOR_UPLOAD_MAX_BYTES)).toBeNull()
  })

  it('rejects empty and oversized files with a Spanish 500 MB message', () => {
    expect(assertEditorUploadSize(0)).toMatch(/Falta el archivo/i)
    expect(assertEditorUploadSize(EDITOR_UPLOAD_MAX_BYTES + 1)).toMatch(/500 MB/i)
  })

  it('formats bytes for the UI', () => {
    expect(formatEditorUploadBytes(EDITOR_UPLOAD_MAX_BYTES)).toBe('500 MB')
  })
})
