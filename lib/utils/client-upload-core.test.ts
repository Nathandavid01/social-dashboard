import { describe, it, expect } from 'vitest'
import {
  validateClientUpload,
  buildIdeaInsert,
  isValidFormat,
  isValidTheme,
  themeLabel,
} from './client-upload-core'

describe('client-upload-core', () => {
  describe('validateClientUpload', () => {
    const base = { format: 'R', theme: 'promocion', brief: 'algo', desiredDate: '' }

    it('passes a well-formed submission', () => {
      expect(validateClientUpload(base)).toEqual({ ok: true })
    })

    it('rejects an invalid format', () => {
      expect(validateClientUpload({ ...base, format: 'X' }).ok).toBe(false)
    })

    it('rejects an unknown theme', () => {
      expect(validateClientUpload({ ...base, theme: 'nope' }).ok).toBe(false)
    })

    it('accepts an empty desired date but rejects a malformed one', () => {
      expect(validateClientUpload({ ...base, desiredDate: '' }).ok).toBe(true)
      expect(validateClientUpload({ ...base, desiredDate: '2026/06/19' }).ok).toBe(false)
      expect(validateClientUpload({ ...base, desiredDate: '2026-06-19' }).ok).toBe(true)
    })
  })

  describe('helpers', () => {
    it('validates formats and themes', () => {
      expect(isValidFormat('R')).toBe(true)
      expect(isValidFormat('P')).toBe(true)
      expect(isValidFormat('C')).toBe(false)
      expect(isValidTheme('detras')).toBe(true)
      expect(isValidTheme('xx')).toBe(false)
      expect(themeLabel('detras')).toBe('Detrás de cámara')
    })
  })

  describe('buildIdeaInsert', () => {
    it('maps format → content_type, brief → visual_brief, date → deadline', () => {
      const row = buildIdeaInsert('client-1', {
        format: 'R',
        theme: 'testimonio',
        brief: '  Quiero algo corto  ',
        desiredDate: '2026-07-01',
      })
      expect(row.client_id).toBe('client-1')
      expect(row.content_type).toBe('R')
      expect(row.title).toContain('Testimonio de cliente')
      expect(row.theme).toBe('testimonio')
      expect(row.visual_brief).toBe('Quiero algo corto')
      expect(row.generation_prompt).toBe('Quiero algo corto')
      expect(row.deadline).toBe('2026-07-01')
      expect(row.status).toBe('idea')
    })

    it('nulls out empty brief and date', () => {
      const row = buildIdeaInsert('c', { format: 'P', theme: 'otro', brief: '   ', desiredDate: '' })
      expect(row.visual_brief).toBeNull()
      expect(row.generation_prompt).toBeNull()
      expect(row.deadline).toBeNull()
      expect(row.content_type).toBe('P')
    })
  })
})
