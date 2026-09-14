import { describe, it, expect } from 'vitest'
import {
  ENTREGAS_DIRECT_MAX_BYTES,
  assertEntregasDirectUpload,
  buildEntregasEditedKey,
  entregasDirectContentType,
  isEntregasIdeaId,
} from './entregas-direct-upload'

const ideaId = '7f4a8757-7811-4fb4-afc0-87dc0c50c56d'

describe('buildEntregasEditedKey', () => {
  it('usa el mismo prefijo entregas/{idea}/edited que el presign', () => {
    expect(buildEntregasEditedKey(ideaId, 'Primer_Round_Reel_GFX_H264.mov', 1700000000000)).toBe(
      `entregas/${ideaId}/edited/1700000000000-primer-round-reel-gfx-h264.mov`,
    )
  })

  it('rechaza un ideaId que no es uuid (path injection)', () => {
    expect(buildEntregasEditedKey('../etc/passwd', 'clip.mov')).toBeNull()
    expect(isEntregasIdeaId('not-a-uuid')).toBe(false)
  })
})

describe('assertEntregasDirectUpload', () => {
  it('acepta mov / quicktime', () => {
    expect(
      assertEntregasDirectUpload({
        ideaId,
        fileName: 'Primer_Round_Reel_GFX_H264.mov',
        contentType: 'video/quicktime',
        contentLength: 2_519_154,
      }),
    ).toBeNull()
  })

  it('rechaza html y archivos enormes antes de bufferizar', () => {
    expect(
      assertEntregasDirectUpload({
        ideaId,
        fileName: 'evil.html',
        contentType: 'text/html',
        contentLength: 12,
      }),
    ).toMatch(/no permitido/i)
    expect(
      assertEntregasDirectUpload({
        ideaId,
        fileName: 'huge.mov',
        contentType: 'video/quicktime',
        contentLength: ENTREGAS_DIRECT_MAX_BYTES + 1,
      }),
    ).toMatch(/200 MB/i)
  })
})

describe('entregasDirectContentType', () => {
  it('mapea .mov sin type a video/quicktime', () => {
    expect(entregasDirectContentType('clip.mov', '')).toBe('video/quicktime')
  })
})
