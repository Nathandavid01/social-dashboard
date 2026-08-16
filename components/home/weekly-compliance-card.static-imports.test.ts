/**
 * Regression guard for perf lote 1 (#2): recharts (~300-400kB) used to be
 * imported statically in weekly-compliance-card.tsx, which mounts on /home
 * unconditionally. It must load lazily via next/dynamic instead so it isn't
 * part of the initial JS for that route.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(__dirname, 'weekly-compliance-card.tsx'), 'utf8')

describe('weekly-compliance-card.tsx static imports', () => {
  it('does not statically import recharts', () => {
    expect(source).not.toMatch(/^import .*from ['"]recharts['"]/m)
  })

  it('loads the chart via next/dynamic', () => {
    expect(source).toMatch(/from ['"]next\/dynamic['"]/)
    expect(source).toMatch(/dynamic\(/)
  })
})
