/**
 * Regression guard for perf lote 1 (#1): react-markdown + remark-gfm are
 * heavy deps that used to be imported statically in chat-bubble.tsx, which
 * mounts in the shared dashboard layout — so they shipped in EVERY route's
 * initial JS bundle. They must load lazily via next/dynamic instead.
 *
 * Style follows lib/actions/ui-events.staging.test.ts (readFileSync + assert
 * on the raw source, no module execution needed).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(resolve(__dirname, 'chat-bubble.tsx'), 'utf8')

describe('chat-bubble.tsx static imports', () => {
  it('does not statically import react-markdown', () => {
    expect(source).not.toMatch(/^import .*from ['"]react-markdown['"]/m)
  })

  it('does not statically import remark-gfm', () => {
    expect(source).not.toMatch(/^import .*from ['"]remark-gfm['"]/m)
  })

  it('loads the markdown renderer via next/dynamic', () => {
    expect(source).toMatch(/from ['"]next\/dynamic['"]/)
    expect(source).toMatch(/dynamic\(/)
  })
})
