// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'

/**
 * Guard de clase: cada URL firmada de R2 se sirve `'inline'` o con
 * attachmentDisposition(). Un `attachment; filename="…"` armado a mano viaja con
 * bytes UTF-8 crudos y los nombres con acentos o «—» llegan rotos.
 */
describe('Content-Disposition de descargas', () => {
  it("todo ResponseContentDisposition es 'inline' o attachmentDisposition()", () => {
    const lines = execSync(
      `git grep -n "ResponseContentDisposition:" -- app lib components ':!*.test.ts' ':!*.test.tsx' || true`,
      { encoding: 'utf8' },
    ).trim().split('\n').filter(Boolean)
    expect(lines.length).toBeGreaterThan(0)
    const offenders = lines.filter(
      (line) => !/ResponseContentDisposition:\s*('inline'|attachmentDisposition\()/.test(line),
    )
    expect(offenders).toEqual([])
  })
})
