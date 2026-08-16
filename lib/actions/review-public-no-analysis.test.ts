import { describe, it, expect } from 'vitest'
import { join } from 'node:path'

/**
 * El QC IA es interno. Si alguien conecta la tabla de análisis a los flujos
 * públicos de cliente (/review/<token>, /aprobacion), este test lo delata.
 */
describe('el análisis IA no llega a superficies públicas', () => {
  const publicFiles = [
    'lib/actions/review-public.ts',
    'lib/actions/entregas-client-review.ts',
    'app/(review)',
  ]
  it('ningún archivo público referencia content_idea_video_analysis ni getVideoAnalysis', () => {
    const { execSync } = require('node:child_process') as typeof import('node:child_process')
    for (const target of publicFiles) {
      const out = (() => {
        try {
          return execSync(
            `grep -rn "content_idea_video_analysis\\|getVideoAnalysis\\|VideoAnalysisReport" "${join(process.cwd(), target)}"`,
            { encoding: 'utf8' },
          )
        } catch { return '' } // grep sale 1 si no hay matches — es lo que queremos
      })()
      expect(out, `${target} referencia el análisis IA (es interno)`).toBe('')
    }
  })
})
