import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Las 3 verificaciones del QC (relevancia, captions quemados, caption)
 * solo corren si el browser dispara processUploadedVideo tras registrar
 * el editado. Si un uploader de editor se olvida, el video llega a
 * revisión sin análisis.
 */
const EDITOR_EDITED_UPLOADERS = [
  'components/pipeline/use-submit-videos.ts',
  'components/video-pipeline/editor-video-card.tsx',
  'components/recording/idea-video-panel.tsx',
]

describe('subida de editores dispara las 3 verificaciones QC', () => {
  it('cada uploader de video editado llama processUploadedVideo', () => {
    for (const rel of EDITOR_EDITED_UPLOADERS) {
      const src = readFileSync(join(process.cwd(), rel), 'utf8')
      expect(src, `${rel} no dispara processUploadedVideo`).toContain('processUploadedVideo')
    }
  })

  it('la revisión interna muestra las 3 bolitas (relevancia, captions, caption)', () => {
    const src = readFileSync(
      join(process.cwd(), 'components/entregas/review-overlay.tsx'),
      'utf8',
    )
    expect(src).toContain('QcProgressDots')
    expect(src).not.toContain('VideoAnalysisReport')
  })
})
