import { describe, it, expect } from 'vitest'
import { clientProfilePatchSchema } from './client-profile.schema'

describe('clientProfilePatchSchema — brand_fonts', () => {
  it('accepts primary/secondary font names', () => {
    const out = clientProfilePatchSchema.parse({
      brand_fonts: { primary: 'Montserrat Bold', secondary: 'Lato' },
    })
    expect(out.brand_fonts).toEqual({ primary: 'Montserrat Bold', secondary: 'Lato' })
  })

  it('normalizes empty strings to null', () => {
    const out = clientProfilePatchSchema.parse({ brand_fonts: { primary: '', secondary: 'Lato' } })
    expect(out.brand_fonts).toEqual({ primary: null, secondary: 'Lato' })
  })

  it('rejects absurdly long font names', () => {
    const res = clientProfilePatchSchema.safeParse({ brand_fonts: { primary: 'x'.repeat(200) } })
    expect(res.success).toBe(false)
  })

  it('stays optional — patches without fonts still parse', () => {
    const out = clientProfilePatchSchema.parse({ brand_voice: 'cercano' })
    expect(out.brand_fonts).toBeUndefined()
  })
})
