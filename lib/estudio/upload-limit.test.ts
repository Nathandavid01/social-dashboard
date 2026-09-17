import { describe, it, expect } from 'vitest'
import {
  EDITOR_STUDIO_MAX_BYTES,
  EDITOR_STUDIO_UPLOAD_LIMITS,
  assertEditorStudioFileSize,
  formatEditorStudioBytes,
} from './upload-limit'

describe('editor studio upload limit', () => {
  it('caps the product path at 500 MB', () => {
    expect(EDITOR_STUDIO_MAX_BYTES).toBe(500 * 1024 * 1024)
    expect(EDITOR_STUDIO_UPLOAD_LIMITS.productLabel).toBe('500 MB')
    expect(assertEditorStudioFileSize(500 * 1024 * 1024)).toBeNull()
    expect(assertEditorStudioFileSize(500 * 1024 * 1024 + 1)).toMatch(/500 MB/)
  })

  it('rejects empty files', () => {
    expect(assertEditorStudioFileSize(0)).toMatch(/Falta el archivo/)
    expect(assertEditorStudioFileSize(Number.NaN)).toMatch(/Falta el archivo/)
  })

  it('documents the Vercel body cap so we do not send bytes through Next', () => {
    expect(EDITOR_STUDIO_UPLOAD_LIMITS.vercelBody).toMatch(/4\.5 MB/)
    expect(EDITOR_STUDIO_UPLOAD_LIMITS.path).toMatch(/no pasa por Vercel/)
    expect(EDITOR_STUDIO_UPLOAD_LIMITS.sameOriginProxy).toMatch(/200 MB/)
  })

  it('formats byte sizes for the UI', () => {
    expect(formatEditorStudioBytes(EDITOR_STUDIO_MAX_BYTES)).toBe('500 MB')
    expect(formatEditorStudioBytes(48 * 1024 * 1024)).toBe('48 MB')
  })
})
