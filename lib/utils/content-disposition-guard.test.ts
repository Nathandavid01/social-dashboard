import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'

/**
 * Guard de clase: ninguna descarga arma `attachment; filename="${…}"` a mano.
 * R2 reenvía ese header con bytes UTF-8 crudos y los nombres con acentos o «—»
 * llegan rotos. Toda descarga pasa por attachmentDisposition().
 */
describe('Content-Disposition de descargas', () => {
  it('no hay filename interpolado a mano en app/, lib/ ni components/', () => {
    const hits = execSync(
      `git grep -nE "attachment; filename=\\"\\\\$\\{" -- app lib components ':!*.test.ts' ':!*.test.tsx' || true`,
      { encoding: 'utf8' },
    ).trim()
    expect(hits).toBe('')
  })
})
